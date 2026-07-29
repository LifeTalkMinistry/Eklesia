import {
  apiRequest,
  checkApiHealth,
  clearAccessToken,
  getAccessToken,
  isApiConfigured,
  saveAccessToken,
} from './apiClient.js';

export const BACKEND_SESSION_UPDATED_EVENT = 'ekklesia-pulse:backend-session-updated';

function dispatchSessionUpdated(session) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(BACKEND_SESSION_UPDATED_EVENT, { detail: { session } }));
}

function normalizeSession(payload) {
  if (!payload?.user) return null;
  return {
    user: payload.user,
    profile: payload.profile || null,
    church: payload.church || null,
    connectedAt: new Date().toISOString(),
  };
}

export function hasBackendSession() {
  return isApiConfigured() && Boolean(getAccessToken());
}

export async function inspectBackendConnection() {
  if (!isApiConfigured()) {
    return { configured: false, online: false, session: null, error: null };
  }

  try {
    const health = await checkApiHealth();
    return { configured: true, online: true, health, session: null, error: null };
  } catch (error) {
    return { configured: true, online: false, session: null, error };
  }
}

export async function restoreBackendSession() {
  if (!hasBackendSession()) return { ok: false, session: null, reason: 'not-connected' };

  try {
    const payload = await apiRequest('/api/ekklesia/me');
    const session = normalizeSession(payload);
    dispatchSessionUpdated(session);
    return { ok: true, session };
  } catch (error) {
    if (error.status === 401) clearAccessToken();
    dispatchSessionUpdated(null);
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
    const session = normalizeSession(me);
    dispatchSessionUpdated(session);
    return { ok: true, session };
  } catch (error) {
    clearAccessToken();
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
  const session = normalizeSession(restored);
  dispatchSessionUpdated(session);
  return { ok: true, profile: payload.profile, session };
}

export function disconnectBackendAccount() {
  clearAccessToken();
  dispatchSessionUpdated(null);
  return { ok: true };
}
