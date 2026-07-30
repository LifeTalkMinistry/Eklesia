import {
  SYNC_OUTBOX_STORE,
  requestToPromise,
  runStoreTransaction,
} from '../../lib/indexedDb.js';
import { STORAGE_KEYS } from '../storageRegistry.js';
import { requireActiveAccountId } from './accountContext.js';
import { readAccountStorage } from './accountScopedStorage.js';

const MAX_ACCOUNT_OUTBOX_RECORDS = 2000;

function parseFallback(raw) {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function listAllPendingMutationKeys() {
  const accountId = requireActiveAccountId();
  const keys = new Set();

  try {
    const all = await runStoreTransaction(
      SYNC_OUTBOX_STORE,
      'readonly',
      (store) => requestToPromise(store.getAll()),
    );
    (Array.isArray(all) ? all : [])
      .filter((item) => String(item.accountId) === accountId)
      .slice(0, MAX_ACCOUNT_OUTBOX_RECORDS)
      .forEach((item) => keys.add(`${item.entityType}:${item.clientRecordId}`));
  } catch {
    // The fallback queue is inspected below.
  }

  const fallback = parseFallback(
    readAccountStorage(STORAGE_KEYS.syncOutboxFallback, '[]').value,
  );
  fallback
    .filter((item) => String(item.accountId) === accountId)
    .slice(0, MAX_ACCOUNT_OUTBOX_RECORDS)
    .forEach((item) => keys.add(`${item.entityType}:${item.clientRecordId}`));

  return keys;
}

export { MAX_ACCOUNT_OUTBOX_RECORDS };
