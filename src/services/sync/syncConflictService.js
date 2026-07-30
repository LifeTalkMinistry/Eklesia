import { applyCanonicalRecords } from './localSyncRepository.js';
import {
  listRemoteSyncConflicts,
  resolveRemoteSyncConflict,
} from './remoteSyncRepository.js';
import { confirmMutations, listPendingMutations } from './syncOutbox.js';
import { updateSyncState } from './syncStateService.js';

function recordKey(value) {
  return `${value?.entityType || ''}:${value?.clientRecordId || ''}`;
}

export async function getSyncConflicts() {
  const result = await listRemoteSyncConflicts();
  return Array.isArray(result?.conflicts) ? result.conflicts : [];
}

export async function resolveSyncConflict(conflict, resolution) {
  if (!conflict?.id) throw new Error('The sync conflict is unavailable.');
  if (!['keep_local', 'keep_server'].includes(resolution)) {
    throw new Error('Choose which devotion version should be kept.');
  }

  const result = await resolveRemoteSyncConflict(conflict.id, resolution);
  if (result.canonical) applyCanonicalRecords([result.canonical]);

  const pending = await listPendingMutations(200);
  const matchingIds = pending
    .filter((mutation) => recordKey(mutation) === recordKey(conflict))
    .map((mutation) => mutation.id);
  await confirmMutations(matchingIds);

  const remaining = await listPendingMutations(200);
  updateSyncState({
    cursor: String(result.cursor || '0'),
    status: remaining.length ? 'attention' : 'synced',
    pendingCount: remaining.length,
    lastSyncedAt: new Date().toISOString(),
    lastError: remaining.length ? 'Other synchronized changes still need attention.' : '',
  });

  return result;
}

export function summarizeConflictVersion(version = {}) {
  const payload = version.payload || {};
  return {
    reference: payload.reference || payload.title || 'Private devotion',
    reflection: payload.personalReflection || '',
    word: payload.wgapWord || '',
    gratitude: payload.wgapGratitude || '',
    application: payload.wgapApplication || '',
    prayer: payload.wgapPrayer || '',
  };
}
