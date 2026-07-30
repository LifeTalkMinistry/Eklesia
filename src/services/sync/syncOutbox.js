import {
  SYNC_OUTBOX_STORE,
  requestToPromise,
  runStoreTransaction,
} from '../../lib/indexedDb.js';
import { STORAGE_KEYS } from '../storageRegistry.js';
import { requireActiveAccountId } from './accountContext.js';
import { readAccountStorage, writeAccountStorage } from './accountScopedStorage.js';

const MAX_OUTBOX_RECORDS = 2000;

function createId() {
  return globalThis.crypto?.randomUUID?.()
    || `outbox-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeFallbackRecords(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readFallback() {
  return normalizeFallbackRecords(readAccountStorage(STORAGE_KEYS.syncOutboxFallback, '[]').value);
}

function writeFallback(records) {
  return writeAccountStorage(STORAGE_KEYS.syncOutboxFallback, JSON.stringify(records.slice(-MAX_OUTBOX_RECORDS)));
}

function normalizeMutation(mutation, accountId) {
  const entityType = String(mutation?.entityType || '').trim();
  const clientRecordId = String(mutation?.clientRecordId || '').trim();
  const operation = mutation?.operation === 'delete' ? 'delete' : 'upsert';
  if (!entityType || !clientRecordId) throw new Error('A sync mutation needs an entity type and client record ID.');

  return {
    id: mutation.id || createId(),
    accountId: String(accountId),
    entityType,
    clientRecordId,
    operation,
    baseVersion: Number.isSafeInteger(Number(mutation.baseVersion)) ? Number(mutation.baseVersion) : 0,
    payload: mutation.payload && typeof mutation.payload === 'object' ? mutation.payload : {},
    createdAt: mutation.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attempts: Number(mutation.attempts) || 0,
    lastError: mutation.lastError || '',
  };
}

export async function enqueueSyncMutation(mutation) {
  const accountId = requireActiveAccountId();
  const record = normalizeMutation(mutation, accountId);

  try {
    await runStoreTransaction('syncOutbox', 'readwrite', async (store) => {
      const all = await requestToPromise(store.getAll());
      const sameAccount = (Array.isArray(all) ? all : []).filter((item) => String(item.accountId) === accountId);
      if (sameAccount.length >= MAX_OUTBOX_RECORDS) throw new Error('The offline sync queue is full. Sync this device before adding more changes.');

      const duplicate = sameAccount.find((item) => (
        item.entityType === record.entityType
        && item.clientRecordId === record.clientRecordId
      ));
      if (duplicate) {
        record.id = duplicate.id;
        record.createdAt = duplicate.createdAt;
        record.attempts = duplicate.attempts || 0;
      }
      await requestToPromise(store.put(record));
    });
    return { ok: true, persisted: true, data: record };
  } catch (error) {
    const records = readFallback();
    const index = records.findIndex((item) => (
      item.entityType === record.entityType
      && item.clientRecordId === record.clientRecordId
    ));
    if (index >= 0) record.id = records[index].id;
    if (index >= 0) records[index] = record;
    else records.push(record);
    const fallback = writeFallback(records);
    return { ok: true, persisted: fallback.persisted, fallback: true, data: record, warning: error.message };
  }
}

export async function listPendingMutations(limit = 50) {
  const accountId = requireActiveAccountId();
  const boundedLimit = Math.max(1, Math.min(200, Number(limit) || 50));

  try {
    const all = await runStoreTransaction(SYNC_OUTBOX_STORE, 'readonly', (store) => requestToPromise(store.getAll()));
    const records = (Array.isArray(all) ? all : [])
      .filter((item) => String(item.accountId) === accountId)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
      .slice(0, boundedLimit);
    if (records.length) return records;
  } catch {
    // Fall through to the localStorage fallback.
  }

  return readFallback()
    .filter((item) => String(item.accountId) === accountId)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .slice(0, boundedLimit);
}

export async function confirmMutations(ids = []) {
  const accountId = requireActiveAccountId();
  const idSet = new Set(ids.map(String));
  if (!idSet.size) return { confirmed: 0 };
  let confirmed = 0;

  try {
    await runStoreTransaction(SYNC_OUTBOX_STORE, 'readwrite', async (store) => {
      for (const id of idSet) {
        const record = await requestToPromise(store.get(id));
        if (!record || String(record.accountId) !== accountId) continue;
        await requestToPromise(store.delete(id));
        confirmed += 1;
      }
    });
  } catch {
    // The fallback copy is still cleared below.
  }

  const fallback = readFallback();
  const remaining = fallback.filter((item) => !(
    String(item.accountId) === accountId && idSet.has(String(item.id))
  ));
  confirmed += fallback.length - remaining.length;
  writeFallback(remaining);
  return { confirmed };
}

export async function markMutationFailures(ids = [], error) {
  const accountId = requireActiveAccountId();
  const idSet = new Set(ids.map(String));
  const message = String(error?.message || error || 'Sync failed').slice(0, 300);

  try {
    await runStoreTransaction(SYNC_OUTBOX_STORE, 'readwrite', async (store) => {
      for (const id of idSet) {
        const record = await requestToPromise(store.get(id));
        if (!record || String(record.accountId) !== accountId) continue;
        await requestToPromise(store.put({
          ...record,
          attempts: (Number(record.attempts) || 0) + 1,
          lastError: message,
          updatedAt: new Date().toISOString(),
        }));
      }
    });
  } catch {
    const fallback = readFallback().map((item) => (
      String(item.accountId) === accountId && idSet.has(String(item.id))
        ? { ...item, attempts: (Number(item.attempts) || 0) + 1, lastError: message, updatedAt: new Date().toISOString() }
        : item
    ));
    writeFallback(fallback);
  }
}

export async function clearAccountOutbox() {
  const accountId = requireActiveAccountId();
  let removed = 0;
  try {
    await runStoreTransaction(SYNC_OUTBOX_STORE, 'readwrite', async (store) => {
      const all = await requestToPromise(store.getAll());
      for (const record of Array.isArray(all) ? all : []) {
        if (String(record.accountId) !== accountId) continue;
        await requestToPromise(store.delete(record.id));
        removed += 1;
      }
    });
  } catch {
    // Continue clearing the fallback.
  }
  const fallback = readFallback();
  const remaining = fallback.filter((item) => String(item.accountId) !== accountId);
  removed += fallback.length - remaining.length;
  writeFallback(remaining);
  return { removed };
}
