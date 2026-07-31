import { hasBackendSession } from '../backendSessionService.js';
import {
  applyCanonicalRecords,
  getSyncableLocalSnapshot,
} from './localSyncRepository.js';
import {
  bootstrapRemoteSync,
  pullRemoteChanges,
  pushRemoteChanges,
} from './remoteSyncRepository.js';
import {
  confirmMutations,
  enqueueSyncMutation,
  listPendingMutations,
  markMutationFailures,
} from './syncOutbox.js';
import { clearSyncBatch, getOrCreateSyncBatch } from './syncBatchState.js';
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

function recordKey(record) {
  return `${record.entityType}:${record.clientRecordId}`;
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

async function enqueueUnsyncedSnapshot({ entityTypes = null } = {}) {
  const allowedTypes = entityTypes ? new Set(entityTypes) : null;
  const mutations = getSyncableLocalSnapshot({ unsyncedOnly: true })
    .filter((mutation) => !allowedTypes || allowedTypes.has(mutation.entityType));
  for (const mutation of mutations) await enqueueSyncMutation(mutation);
  return mutations.length;
}

async function pushPendingBatches(device, startingCursor) {
  let cursor = String(startingCursor || '0');
  let processedBatches = 0;

  while (processedBatches < 100) {
    const pending = await listPendingMutations(50);
    if (!pending.length) return { ok: true, cursor };
    const batch = getOrCreateSyncBatch(pending);

    const response = await pushRemoteChanges({
      device,
      batchId: batch.batchId,
      changes: pending.map(({ entityType, clientRecordId, operation, baseVersion, payload }) => ({
        entityType,
        clientRecordId,
        operation,
        baseVersion,
        payload,
      })),
    });
    clearSyncBatch(batch.batchId);

    applyCanonicalRecords(response.accepted || []);
    const acceptedKeys = new Set((response.accepted || []).map(recordKey));
    const confirmedIds = pending
      .filter((record) => acceptedKeys.has(recordKey(record)))
      .map((record) => record.id);
    await confirmMutations(confirmedIds);
    cursor = String(response.cursor || cursor);

    if (response.conflicts?.length) {
      response.conflicts.forEach((conflict) => {
        if (conflict.entityType !== 'devotion-entry' && conflict.canonical) {
          applyCanonicalRecords([conflict.canonical]);
        }
      });
      const conflictKeys = new Set(response.conflicts.map(recordKey));
      const conflictIds = pending
        .filter((record) => conflictKeys.has(recordKey(record)))
        .map((record) => record.id);
      await markMutationFailures(conflictIds, new Error('A newer server version needs review.'));
      return { ok: false, conflicts: response.conflicts, cursor };
    }

    processedBatches += 1;
  }

  throw new Error('The sync queue exceeded the safe batch processing limit.');
}

async function executeSync({ bootstrap = false } = {}) {
  if (!hasBackendSession()) return { ok: false, reason: 'not-connected' };

  const device = getDeviceDescriptor();
  let cursor = getSyncState().cursor || '0';
  let queuedLocal = 0;

  try {
    if (bootstrap) {
      // Capture additive local content before any server record is applied.
      // This prevents a second device's bootstrap payload from replacing a
      // devotion that exists only on this device.
      queuedLocal += await enqueueUnsyncedSnapshot({ entityTypes: ['devotion-entry'] });
    }

    let pendingBefore = await listPendingMutations(200);
    setSyncing(pendingBefore.length);

    if (bootstrap) {
      const initial = await bootstrapRemoteSync(device);
      const pendingKeys = new Set(pendingBefore.map(recordKey));
      const safeBootstrapRecords = (initial.records || []).filter((record) => !(
        record.entityType === 'devotion-entry' && pendingKeys.has(recordKey(record))
      ));
      applyCanonicalRecords(safeBootstrapRecords);
      cursor = String(initial.cursor || cursor);

      // Profile identity is intentionally evaluated after the canonical
      // account profile has been restored. Local-only devotion records were
      // already protected above.
      queuedLocal += await enqueueUnsyncedSnapshot();
      pendingBefore = await listPendingMutations(200);
      setSyncing(pendingBefore.length);
    }

    const pushed = await pushPendingBatches(device, cursor);
    cursor = pushed.cursor;
    if (!pushed.ok) {
      const remaining = await listPendingMutations(200);
      setNeedsAttention('A synchronized devotion changed on another device and needs review.', remaining.length);
      return { ...pushed, queuedLocal };
    }

    const pulled = await pullAllChanges(cursor);
    cursor = pulled.cursor;
    const pendingAfter = await listPendingMutations(200);
    setSynced({ cursor, pendingCount: pendingAfter.length });
    clearRetry();
    return {
      ok: true,
      cursor,
      pendingCount: pendingAfter.length,
      queuedLocal,
      appliedRemote: pulled.applied.filter((result) => result?.applied).length,
    };
  } catch (error) {
    const pending = await listPendingMutations(200).catch(() => []);
    if (isOfflineError(error)) {
      setOffline(error, pending.length);
      scheduleRetry();
    } else {
      setNeedsAttention(error, pending.length);
    }
    return { ok: false, error, queuedLocal };
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

export async function mergeCurrentDeviceRecords() {
  if (activeSyncPromise) await activeSyncPromise;
  return synchronizeNow({ bootstrap: true, reason: 'manual-device-merge' });
}

export function installAutomaticSyncTriggers() {
  if (automaticTriggersInstalled || typeof window === 'undefined') return;
  automaticTriggersInstalled = true;

  window.addEventListener('online', () => { void synchronizeNow({ reason: 'online' }); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void synchronizeNow({ reason: 'visible' });
  });
}
