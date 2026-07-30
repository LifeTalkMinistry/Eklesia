import {
  apiRequest,
  checkApiHealth,
  clearAccessToken,
  getAccessToken,
  isApiConfigured,
  saveAccessToken,
} from './apiClient.js';
import {
  clearActiveAccountId,
  getActiveAccountId,
  setActiveAccountId,
} from './sync/accountContext.js';

export const BACKEND_SESSION_UPDATED_EVENT = 'ekklesia-pulse:backend-session-updated';

let currentSession = null;

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
  setActiveAccountId(session.user.id);
  currentSession = session;
  dispatchSessionUpdated(session);
  return session;
}

function clearSessionState() {
  currentSession = null;
  clearActiveAccountId();
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

export async function restoreBackendSession() {
  if (!hasBackendSession()) {
    clearSessionState();
    return { ok: false, session: null, reason: 'not-connected' };
  }

  try {
    const payload = await apiRequest('/api/ekklesia/me');
    const session = activateSession(normalizeSession(payload));
    return { ok: true, session };
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
