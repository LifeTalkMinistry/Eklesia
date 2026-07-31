import { getBrowserStorage, STORAGE_KEYS } from './storageRegistry.js';

const API_TIMEOUT_MS = 12000;
const API_OVERRIDE_STORAGE_KEY = 'ekklesia.runtimeApiBaseUrl';

function normalizeApiBaseUrl(value) {
  const text = String(value || '').trim().replace(/\/+$/, '');
  if (!text) return '';

  try {
    const parsed = new URL(text);
    const isLocalHttp = parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' && !isLocalHttp) return '';
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function getRuntimeApiOverride() {
  const storage = getBrowserStorage();

  if (typeof window !== 'undefined') {
    const query = new URLSearchParams(window.location.search);
    const supplied = query.get('api');

    if (supplied === 'default') {
      storage?.removeItem(API_OVERRIDE_STORAGE_KEY);
    } else if (supplied) {
      const normalized = normalizeApiBaseUrl(supplied);
      if (normalized) storage?.setItem(API_OVERRIDE_STORAGE_KEY, normalized);
    }
  }

  return normalizeApiBaseUrl(storage?.getItem(API_OVERRIDE_STORAGE_KEY));
}

export function getApiBaseUrl() {
  return getRuntimeApiOverride()
    || normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
}

export function isApiConfigured() {
  return Boolean(getApiBaseUrl());
}

export function getAccessToken() {
  const storage = getBrowserStorage();
  return storage?.getItem(STORAGE_KEYS.backendAccessToken) || '';
}

export function saveAccessToken(token) {
  const storage = getBrowserStorage();
  if (!storage) return false;
  if (token) storage.setItem(STORAGE_KEYS.backendAccessToken, token);
  else storage.removeItem(STORAGE_KEYS.backendAccessToken);
  return true;
}

export function clearAccessToken() {
  return saveAccessToken('');
}

function createApiError(message, options = {}) {
  const error = new Error(message);
  error.code = options.code || 'API_ERROR';
  error.status = options.status || 0;
  error.details = options.details;
  error.isNetworkError = Boolean(options.isNetworkError);
  return error;
}

export async function apiRequest(path, options = {}) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw createApiError('The backend URL is not configured for this deployment.', {
      code: 'API_NOT_CONFIGURED',
    });
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs || API_TIMEOUT_MS);
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');

  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (options.auth !== false) {
    const token = getAccessToken();
    if (!token) throw createApiError('Sign in to connect Ekklesia Pulse.', { code: 'AUTH_REQUIRED', status: 401 });
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      throw createApiError(payload?.message || `Request failed with status ${response.status}.`, {
        code: payload?.code || 'API_REQUEST_FAILED',
        status: response.status,
        details: payload?.details,
      });
    }

    return payload;
  } catch (error) {
    if (error?.code) throw error;
    const timedOut = error?.name === 'AbortError';
    throw createApiError(
      timedOut ? 'The backend did not respond in time.' : 'The backend could not be reached.',
      { code: timedOut ? 'API_TIMEOUT' : 'API_UNREACHABLE', isNetworkError: true },
    );
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function checkApiHealth() {
  return apiRequest('/api/ekklesia/health', { auth: false, timeoutMs: 7000 });
}
