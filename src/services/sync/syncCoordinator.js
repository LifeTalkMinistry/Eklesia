import { hasBackendSession } from '../backendSessionService.js';
import { applyCanonicalRecords } from './localSyncRepository.js';
import {
  bootstrapRemoteSync,
  pullRemoteChanges,
  pushRemoteChanges,
} from './remoteSyncRepository.js';
import {
  confirmMutations,
  listPendingMutations,
  markMutationFailures,
} from './syncOutbox.js';
import {
  getDeviceDescriptor,
  getSyncState,
  setNeedsAttention,
  setOffline,
  setSynced,
  setSyncing,
} from './syncStateService.js';

let activeSyncPromise = null;
let automaticTriggersInstalled = false;
let retryTimer = null;
let retryAttempt = 0;

function createBatchId() {
  return `batch-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}

function isOfflineError(error) {
  return Boolean(error?.isNetworkError || error?.code === 'API_UNREACHABLE' || error?.code === 'API_TIMEOUT');
}

function scheduleRetry() {
  if (retryTimer || typeof window === 'undefined') return;
  const delay = Math.min(60_000, 1000 * (2 ** Math.min(retryAttempt, 6)));
  retryAttempt += 1;
  retryTimer = window.setTimeout(() => {
    retryTimer = null;
    void synchronizeNow({ reason: 'retry' });
  }, delay);
}

function clearRetry() {
  retryAttempt = 0;
  if (retryTimer && typeof window !== 'undefined') window.clearTimeout(retryTimer);
  retryTimer = null;
}

async function pullAllChanges(startCursor) {
  let cursor = String(startCursor || '0');
  let hasMore = true;
  const applied = [];

  while (hasMore) {
    const result = await pullRemoteChanges(cursor, 100);
    const changes = Array.isArray(result.changes) ? result.changes : [];
    applied.push(...applyCanonicalRecords(changes.map((change) => ({
      ...change,
      version: change.recordVersion,
    }))));
    cursor = String(result.cursor || cursor);
    hasMore = Boolean(result.hasMore);
  }

  return { cursor, applied };
}

async function executeSync({ bootstrap = false } = {}) {
  if (!hasBackendSession()) return { ok: false, reason: 'not-connected' };

  const device = getDeviceDescriptor();
  let cursor = getSyncState().cursor || '0';
  const pendingBefore = await listPendingMutations(50);
  setSyncing(pendingBefore.length);

  try {
    if (bootstrap) {
      const initial = await bootstrapRemoteSync(device);
      applyCanonicalRecords(initial.records || []);
      cursor = String(initial.cursor || cursor);
    }

    const pending = await listPendingMutations(50);
    if (pending.length) {
      const response = await pushRemoteChanges({
        device,
        batchId: createBatchId(),
        changes: pending.map(({ entityType, clientRecordId, operation, baseVersion, payload }) => ({
          entityType,
          clientRecordId,
          operation,
          baseVersion,
          payload,
        })),
      });

      applyCanonicalRecords(response.accepted || []);
      const acceptedKeys = new Set((response.accepted || []).map((record) => `${record.entityType}:${record.clientRecordId}`));
      const confirmedIds = pending
        .filter((record) => acceptedKeys.has(`${record.entityType}:${record.clientRecordId}`))
        .map((record) => record.id);
      await confirmMutations(confirmedIds);

      if (response.conflicts?.length) {
        response.conflicts.forEach((conflict) => {
          if (conflict.canonical) applyCanonicalRecords([conflict.canonical]);
        });
        const conflictKeys = new Set(response.conflicts.map((item) => `${item.entityType}:${item.clientRecordId}`));
        const conflictIds = pending
          .filter((record) => conflictKeys.has(`${record.entityType}:${record.clientRecordId}`))
          .map((record) => record.id);
        await markMutationFailures(conflictIds, new Error('A newer server version needs review.'));
        setNeedsAttention('A synchronized record changed on another device and needs review.', pending.length - confirmedIds.length);
        return { ok: false, conflicts: response.conflicts, cursor: response.cursor || cursor };
      }

      cursor = String(response.cursor || cursor);
    }

    const pulled = await pullAllChanges(cursor);
    cursor = pulled.cursor;
    const pendingAfter = await listPendingMutations(200);
    setSynced({ cursor, pendingCount: pendingAfter.length });
    clearRetry();
    return { ok: true, cursor, pendingCount: pendingAfter.length };
  } catch (error) {
    const pending = await listPendingMutations(200).catch(() => []);
    if (isOfflineError(error)) {
      setOffline(error, pending.length);
      scheduleRetry();
    } else {
      setNeedsAttention(error, pending.length);
    }
    return { ok: false, error };
  }
}

export function synchronizeNow(options = {}) {
  if (activeSyncPromise) return activeSyncPromise;
  activeSyncPromise = executeSync(options).finally(() => {
    activeSyncPromise = null;
  });
  return activeSyncPromise;
}

export function bootstrapAccountSync() {
  return synchronizeNow({ bootstrap: true, reason: 'login' });
}

export function installAutomaticSyncTriggers() {
  if (automaticTriggersInstalled || typeof window === 'undefined') return;
  automaticTriggersInstalled = true;

  window.addEventListener('online', () => { void synchronizeNow({ reason: 'online' }); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void synchronizeNow({ reason: 'visible' });
  });
}
