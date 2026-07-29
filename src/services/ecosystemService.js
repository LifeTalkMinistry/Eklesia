import { mockEcosystems } from '../data/mockEcosystems.js';
import { apiRequest } from './apiClient.js';
import { hasBackendSession } from './backendSessionService.js';
import { clearActiveWorkspace } from './organizationPrototypeService.js';
import { getBrowserStorage, STORAGE_KEYS } from './storageRegistry.js';

const JOINED_ECOSYSTEM_STORAGE_KEY = STORAGE_KEYS.joinedEcosystemId;
const VALIDATION_DELAY_MS = 550;
const JOIN_DELAY_MS = 650;
const LEAVE_DELAY_MS = 250;

function wait(milliseconds) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

function copyEcosystem(ecosystem) {
  return ecosystem ? JSON.parse(JSON.stringify(ecosystem)) : null;
}

function resultError(code, message, extra = {}) {
  return { ok: false, error: { code, message }, ...extra };
}

function findLocalChurch(identifier) {
  const normalized = String(identifier || '').trim().toUpperCase();
  return mockEcosystems.find((item) => (
    item.id === identifier
    || normalizeEcosystemCode(item.code) === normalized
    || normalizeEcosystemCode(item.organizationCode) === normalized
  ));
}

function hydrateServerChurch(serverChurch) {
  if (!serverChurch) return null;
  const local = findLocalChurch(serverChurch.id) || findLocalChurch(serverChurch.code);
  return {
    ...(local ? copyEcosystem(local) : {
      type: 'church-organization',
      ministries: [],
      groups: [],
      members: [],
      policies: {},
      memberVisibility: {},
      currentMember: {},
    }),
    ...serverChurch,
    id: serverChurch.id,
    code: serverChurch.code,
    organizationCode: serverChurch.organizationCode || serverChurch.code,
    backendConnected: true,
    backendMembership: serverChurch.membership || null,
    prototypeFeatureData: true,
  };
}

function saveJoinedChurchCache(church) {
  const storage = getBrowserStorage();
  if (!storage || !church?.id) return false;
  storage.setItem(JOINED_ECOSYSTEM_STORAGE_KEY, church.id);
  return true;
}

function clearJoinedChurchCache() {
  const storage = getBrowserStorage();
  storage?.removeItem(JOINED_ECOSYSTEM_STORAGE_KEY);
}

function localLookup(code) {
  const normalizedCode = normalizeEcosystemCode(code);
  if (!normalizedCode) return resultError('EMPTY_CODE', 'Enter a church organization code to continue.');
  const ecosystem = findLocalChurch(normalizedCode);
  if (!ecosystem) return resultError('INVALID_CODE', 'We could not find a church organization using that code.');
  if (ecosystem.memberCount >= ecosystem.memberLimit) return resultError('MEMBER_LIMIT_REACHED', 'This church organization has reached its member limit.');
  return { ok: true, data: copyEcosystem(ecosystem), source: 'local-prototype' };
}

function localCurrentChurch() {
  const storage = getBrowserStorage();
  if (!storage) return { ok: true, data: null, persisted: false, source: 'local-prototype' };
  const joinedEcosystemId = storage.getItem(JOINED_ECOSYSTEM_STORAGE_KEY);
  if (!joinedEcosystemId) return { ok: true, data: null, source: 'local-prototype' };
  const ecosystem = findLocalChurch(joinedEcosystemId);
  if (!ecosystem) {
    clearJoinedChurchCache();
    clearActiveWorkspace();
    return { ok: true, data: null, source: 'local-prototype' };
  }
  return { ok: true, data: copyEcosystem(ecosystem), source: 'local-prototype' };
}

export function normalizeEcosystemCode(code) {
  return String(code ?? '').trim().toUpperCase();
}

export async function findEcosystemByCode(code) {
  if (hasBackendSession()) {
    try {
      const payload = await apiRequest('/api/ekklesia/churches/lookup', {
        method: 'POST',
        body: { code: normalizeEcosystemCode(code) },
      });
      return { ok: true, data: hydrateServerChurch(payload.church), source: 'backend' };
    } catch (error) {
      if (!error.isNetworkError) return resultError(error.code, error.message, { source: 'backend' });
      const fallback = localLookup(code);
      return { ...fallback, source: 'local-fallback', backendError: error.message };
    }
  }

  await wait(VALIDATION_DELAY_MS);
  return localLookup(code);
}

export async function getJoinedEcosystem() {
  if (hasBackendSession()) {
    try {
      const payload = await apiRequest('/api/ekklesia/churches/current');
      const church = hydrateServerChurch(payload.church);
      if (!church) {
        clearJoinedChurchCache();
        clearActiveWorkspace();
        return { ok: true, data: null, source: 'backend' };
      }
      saveJoinedChurchCache(church);
      return { ok: true, data: church, source: 'backend' };
    } catch (error) {
      if (!error.isNetworkError) return resultError(error.code, error.message, { source: 'backend' });
      const fallback = localCurrentChurch();
      return { ...fallback, source: 'local-fallback', backendError: error.message };
    }
  }

  return localCurrentChurch();
}

export async function joinEcosystem(ecosystemId) {
  if (hasBackendSession()) {
    try {
      const payload = await apiRequest('/api/ekklesia/churches/join', {
        method: 'POST',
        body: { churchId: ecosystemId },
      });
      const church = hydrateServerChurch(payload.church);
      const persisted = saveJoinedChurchCache(church);
      return { ok: true, data: church, persisted, source: 'backend' };
    } catch (error) {
      if (!error.isNetworkError) return resultError(error.code, error.message, { source: 'backend' });
      const local = findLocalChurch(ecosystemId);
      if (!local) return resultError('BACKEND_UNAVAILABLE', 'The backend is unavailable and this church is not cached on this device.');
      const persisted = saveJoinedChurchCache(local);
      return { ok: true, data: copyEcosystem(local), persisted, source: 'local-fallback', backendError: error.message };
    }
  }

  await wait(JOIN_DELAY_MS);
  const ecosystem = findLocalChurch(ecosystemId);
  if (!ecosystem) return resultError('INVALID_ECOSYSTEM', 'This church organization is unavailable.');
  if (ecosystem.memberCount >= ecosystem.memberLimit) return resultError('MEMBER_LIMIT_REACHED', 'This church organization has reached its member limit.');
  const persisted = saveJoinedChurchCache(ecosystem);
  return { ok: true, data: copyEcosystem(ecosystem), persisted, source: 'local-prototype' };
}

export async function leaveEcosystem() {
  if (hasBackendSession()) {
    try {
      await apiRequest('/api/ekklesia/churches/leave', { method: 'POST', body: {} });
    } catch (error) {
      return resultError(error.code || 'BACKEND_UNAVAILABLE', error.message, { source: 'backend' });
    }
  } else {
    await wait(LEAVE_DELAY_MS);
  }

  clearJoinedChurchCache();
  clearActiveWorkspace();
  return { ok: true, data: null, persisted: Boolean(getBrowserStorage()), source: hasBackendSession() ? 'backend' : 'local-prototype' };
}

export async function getEcosystemMembers(ecosystemId) {
  if (hasBackendSession()) {
    try {
      const payload = await apiRequest('/api/ekklesia/churches/current/members');
      const local = findLocalChurch(ecosystemId) || findLocalChurch(payload.church?.code);
      const prototypeMembers = copyEcosystem(local?.members || []);
      const serverMembers = Array.isArray(payload.members) ? payload.members : [];
      const merged = [...serverMembers];
      const ids = new Set(serverMembers.map((member) => String(member.id)));
      prototypeMembers.forEach((member) => {
        if (!ids.has(String(member.id))) merged.push({ ...member, prototype: true });
      });
      return { ok: true, data: merged, source: 'backend-with-prototype-features' };
    } catch (error) {
      if (!error.isNetworkError) return resultError(error.code, error.message, { source: 'backend' });
    }
  }

  const ecosystem = findLocalChurch(ecosystemId);
  if (!ecosystem) return resultError('INVALID_ECOSYSTEM', 'This church organization is unavailable.');
  return { ok: true, data: copyEcosystem(ecosystem.members), source: hasBackendSession() ? 'local-fallback' : 'local-prototype' };
}

export { JOINED_ECOSYSTEM_STORAGE_KEY };
