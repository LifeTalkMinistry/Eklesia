import {
  apiRequest,
  checkApiHealth,
  clearAccessToken,
  getAccessToken,
  isApiConfigured,
  saveAccessToken,
} from './apiClient.js';
import { STORAGE_KEYS, getRawBrowserStorage } from './storageRegistry.js';
import {
  clearActiveAccountId,
  getActiveAccountId,
  setActiveAccountId,
} from './sync/accountContext.js';

export const BACKEND_SESSION_UPDATED_EVENT = 'ekklesia-pulse:backend-session-updated';

let currentSession = null;

function restoreStoredAccountScope() {
  const storage = getRawBrowserStorage();
  const accountId = storage?.getItem(STORAGE_KEYS.backendAccountId) || '';
  if (!getAccessToken() || !/^[1-9]\d*$/.test(accountId)) return;
  try {
    setActiveAccountId(accountId);
  } catch {
    storage?.removeItem(STORAGE_KEYS.backendAccountId);
  }
}

restoreStoredAccountScope();

function dispatchSessionUpdated(session) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(BACKEND_SESSION_UPDATED_EVENT, { detail: { session } }));
}

function normalizeSession(payload) {
  if (!payload?.user?.id) return null;
  return {
    user: payload.user,
    profile: payload.profile || null,
    church: payload.church || null,
    connectedAt: new Date().toISOString(),
  };
}

function activateSession(session) {
  if (!session?.user?.id) throw new Error('The backend session does not contain a valid account ID.');
  const accountId = setActiveAccountId(session.user.id);
  getRawBrowserStorage()?.setItem(STORAGE_KEYS.backendAccountId, accountId);
  currentSession = session;
  dispatchSessionUpdated(session);
  return session;
}

async function startRestoredSessionSync() {
  try {
    const [{ bootstrapAccountSync, installAutomaticSyncTriggers }, { getSyncState }] = await Promise.all([
      import('./sync/syncCoordinator.js'),
      import('./sync/syncStateService.js'),
    ]);
    const cursorBeforeSync = getSyncState().cursor;
    installAutomaticSyncTriggers();
    const result = await bootstrapAccountSync();
    return { ...result, cursorBeforeSync };
  } catch (error) {
    console.warn('Ekklesia Pulse could not start account synchronization.', error);
    return { ok: false, error };
  }
}

function refreshAfterStartupPull(sync) {
  if (typeof window === 'undefined' || !sync?.ok) return false;
  if (String(sync.cursor || '0') === String(sync.cursorBeforeSync || '0')) return false;
  window.location.reload();
  return true;
}

async function needsLegacyConfirmation() {
  const { inspectLegacyDataClaim } = await import('./sync/legacyDataClaimService.js');
  const snapshot = await inspectLegacyDataClaim();
  return Boolean(snapshot.needed);
}

function clearSessionState({ removeAccountMarker = true } = {}) {
  currentSession = null;
  clearActiveAccountId();
  if (removeAccountMarker) getRawBrowserStorage()?.removeItem(STORAGE_KEYS.backendAccountId);
  dispatchSessionUpdated(null);
}

export function hasBackendSession() {
  return isApiConfigured() && Boolean(getAccessToken());
}

export function getCurrentBackendSession() {
  return currentSession;
}

export function getBackendAccountId() {
  return String(currentSession?.user?.id || getActiveAccountId() || '');
}

export async function inspectBackendConnection() {
  if (!isApiConfigured()) {
    return { configured: false, online: false, session: null, error: null };
  }

  try {
    const health = await checkApiHealth();
    return { configured: true, online: true, health, session: currentSession, error: null };
  } catch (error) {
    return { configured: true, online: false, session: currentSession, error };
  }
}

export async function restoreBackendSession({ startSync = true } = {}) {
  if (!hasBackendSession()) {
    clearSessionState();
    return { ok: false, session: null, reason: 'not-connected' };
  }

  try {
    const payload = await apiRequest('/api/ekklesia/me');
    const session = activateSession(normalizeSession(payload));
    if (startSync && await needsLegacyConfirmation()) {
      return { ok: false, session, reason: 'legacy-claim-required' };
    }
    const sync = startSync ? await startRestoredSessionSync() : null;
    const refreshing = refreshAfterStartupPull(sync);
    return { ok: true, session, sync, refreshing };
  } catch (error) {
    if (error.status === 401 || error.status === 403) clearAccessToken();
    clearSessionState();
    return { ok: false, session: null, error };
  }
}

export async function loginBackendAccount({ email, password }) {
  const payload = await apiRequest('/api/login', {
    method: 'POST',
    auth: false,
    body: { email, password },
  });
  saveAccessToken(payload.token);

  try {
    const me = await apiRequest('/api/ekklesia/me');
    const session = activateSession(normalizeSession(me));
    return { ok: true, session };
  } catch (error) {
    clearAccessToken();
    clearSessionState();
    throw error;
  }
}

export async function registerBackendAccount({ name, email, password }) {
  await apiRequest('/api/users', {
    method: 'POST',
    auth: false,
    body: { name, email, password },
  });
  return loginBackendAccount({ email, password });
}

export async function updateBackendProfile(displayName) {
  const payload = await apiRequest('/api/ekklesia/me', {
    method: 'PATCH',
    body: { displayName },
  });
  const restored = await apiRequest('/api/ekklesia/me');
  const session = activateSession(normalizeSession(restored));
  return { ok: true, profile: payload.profile, session };
}

export function disconnectBackendAccount() {
  clearAccessToken();
  clearSessionState();
  return { ok: true };
}
