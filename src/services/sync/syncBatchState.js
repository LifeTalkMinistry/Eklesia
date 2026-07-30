import { STORAGE_KEYS } from '../storageRegistry.js';
import {
  readAccountStorage,
  removeAccountStorage,
  writeAccountStorage,
} from './accountScopedStorage.js';

function createBatchId() {
  return `batch-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
  }
  return value;
}

function batchFingerprint(records) {
  const changes = records.map(({ entityType, clientRecordId, operation, baseVersion, payload }) => ({
    entityType,
    clientRecordId,
    operation,
    baseVersion,
    payload,
  }));
  return JSON.stringify(canonicalize(changes));
}

function readBatchState() {
  const raw = readAccountStorage(STORAGE_KEYS.syncActiveBatch, '').value;
  if (!raw) return null;
  try {
    const state = JSON.parse(raw);
    if (!state?.batchId || !state?.fingerprint) return null;
    return state;
  } catch {
    return null;
  }
}

export function getOrCreateSyncBatch(records = []) {
  if (!records.length) return null;
  const fingerprint = batchFingerprint(records);
  const existing = readBatchState();
  if (existing?.fingerprint === fingerprint) return existing;

  const state = {
    batchId: createBatchId(),
    fingerprint,
    recordIds: records.map((record) => String(record.id)),
    createdAt: new Date().toISOString(),
  };
  writeAccountStorage(STORAGE_KEYS.syncActiveBatch, JSON.stringify(state));
  return state;
}

export function clearSyncBatch(batchId) {
  const existing = readBatchState();
  if (!existing || (batchId && existing.batchId !== batchId)) return { removed: false };
  return removeAccountStorage(STORAGE_KEYS.syncActiveBatch);
}

export function getSyncBatchState() {
  return readBatchState();
}
