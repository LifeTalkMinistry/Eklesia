import { STORAGE_KEYS, getRawBrowserStorage } from '../storageRegistry.js';
import { readAccountStorage, writeAccountStorage } from './accountScopedStorage.js';

export const SYNC_STATE_CHANGED_EVENT = 'ekklesia-pulse:sync-state-changed';

const DEFAULT_STATE = Object.freeze({
  status: 'idle',
  cursor: '0',
  lastSyncedAt: '',
  lastAttemptAt: '',
  lastError: '',
  pendingCount: 0,
});

function normalizeState(value = {}) {
  return {
    status: ['idle', 'syncing', 'synced', 'offline', 'attention'].includes(value.status)
      ? value.status
      : DEFAULT_STATE.status,
    cursor: /^\d+$/.test(String(value.cursor || '0')) ? String(value.cursor || '0') : '0',
    lastSyncedAt: typeof value.lastSyncedAt === 'string' ? value.lastSyncedAt : '',
    lastAttemptAt: typeof value.lastAttemptAt === 'string' ? value.lastAttemptAt : '',
    lastError: typeof value.lastError === 'string' ? value.lastError.slice(0, 500) : '',
    pendingCount: Math.max(0, Number(value.pendingCount) || 0),
  };
}

function dispatch(state) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SYNC_STATE_CHANGED_EVENT, { detail: { state } }));
}

export function getSyncState() {
  const raw = readAccountStorage(STORAGE_KEYS.syncState, '');
  if (!raw.value) return { ...DEFAULT_STATE };
  try {
    return normalizeState(JSON.parse(raw.value));
  } catch {
    return { ...DEFAULT_STATE, status: 'attention', lastError: 'The saved sync state could not be read.' };
  }
}

export function updateSyncState(changes = {}) {
  const state = normalizeState({ ...getSyncState(), ...changes });
  writeAccountStorage(STORAGE_KEYS.syncState, JSON.stringify(state));
  dispatch(state);
  return state;
}

export function setSyncing(pendingCount = getSyncState().pendingCount) {
  return updateSyncState({
    status: 'syncing',
    pendingCount,
    lastAttemptAt: new Date().toISOString(),
    lastError: '',
  });
}

export function setSynced({ cursor, pendingCount = 0 } = {}) {
  return updateSyncState({
    status: 'synced',
    cursor: cursor ?? getSyncState().cursor,
    pendingCount,
    lastSyncedAt: new Date().toISOString(),
    lastError: '',
  });
}

export function setOffline(error, pendingCount = getSyncState().pendingCount) {
  return updateSyncState({
    status: 'offline',
    pendingCount,
    lastError: String(error?.message || error || 'The backend is unavailable.').slice(0, 500),
  });
}

export function setNeedsAttention(error, pendingCount = getSyncState().pendingCount) {
  return updateSyncState({
    status: 'attention',
    pendingCount,
    lastError: String(error?.message || error || 'Sync needs attention.').slice(0, 500),
  });
}

export function getOrCreateDeviceId() {
  const storage = getRawBrowserStorage();
  if (!storage) return `web-${globalThis.crypto?.randomUUID?.() || Date.now().toString(36)}`;
  const existing = storage.getItem(STORAGE_KEYS.syncDeviceId);
  if (existing && /^[A-Za-z0-9._:-]{8,128}$/.test(existing)) return existing;
  const generated = `web-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
  storage.setItem(STORAGE_KEYS.syncDeviceId, generated);
  return generated;
}

export function getDeviceDescriptor() {
  const navigatorValue = typeof navigator === 'undefined' ? null : navigator;
  return {
    deviceId: getOrCreateDeviceId(),
    displayName: navigatorValue?.platform ? `Browser on ${navigatorValue.platform}` : 'Ekklesia browser',
    platform: navigatorValue?.userAgentData?.platform || navigatorValue?.platform || 'web',
    appVersion: '1.0.0',
  };
}
