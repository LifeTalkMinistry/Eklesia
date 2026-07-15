import { getBrowserStorage, STORAGE_KEYS } from './storageRegistry.js';

const PROTOTYPE_VERSION = 1;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Ekklesia Pulse organization prototype data could not be parsed.', error);
    return fallback;
  }
}

function createInitialWorkspace(organization) {
  return {
    version: PROTOTYPE_VERSION,
    organizationId: organization.id,
    organizationCode: organization.organizationCode || organization.code || '',
    approvalMode: organization.approvalMode || 'Admin approval',
    pulse: clone(organization.pulse) || {
      activeMembers: organization.memberCount || 0,
      completedToday: 0,
      rebuildingRhythm: 0,
      careSignals: 0,
    },
    policies: clone(organization.policies) || {
      wholeChurchRhythm: false,
      ministryRhythm: true,
      circleRhythm: true,
      privateMode: true,
      profileDirectory: true,
    },
    memberVisibility: clone(organization.memberVisibility) || {
      profileScope: 'church',
      rhythmScope: 'circles',
      selectedCircleIds: [],
    },
    currentMember: clone(organization.currentMember) || {
      id: 'current-member',
      organizationRole: 'Church Member',
      roles: [],
    },
    ministries: clone(organization.ministries) || [],
    members: clone(organization.members) || [],
  };
}

function normalizeWorkspace(organization, stored) {
  const defaults = createInitialWorkspace(organization);
  if (!stored || stored.organizationId !== organization.id) return defaults;

  return {
    ...defaults,
    ...stored,
    version: PROTOTYPE_VERSION,
    pulse: { ...defaults.pulse, ...(stored.pulse || {}) },
    policies: { ...defaults.policies, ...(stored.policies || {}) },
    memberVisibility: { ...defaults.memberVisibility, ...(stored.memberVisibility || {}) },
    currentMember: { ...defaults.currentMember, ...(stored.currentMember || {}) },
    ministries: Array.isArray(stored.ministries) ? stored.ministries : defaults.ministries,
    members: Array.isArray(stored.members) ? stored.members : defaults.members,
  };
}

export function getOrganizationPrototypeState(organization) {
  const storage = getBrowserStorage();
  if (!storage) return createInitialWorkspace(organization);

  try {
    const allOrganizations = safeParse(storage.getItem(STORAGE_KEYS.organizationPrototype), {});
    return normalizeWorkspace(organization, allOrganizations?.[organization.id]);
  } catch (error) {
    console.warn('Ekklesia Pulse could not restore the organization prototype.', error);
    return createInitialWorkspace(organization);
  }
}

export function saveOrganizationPrototypeState(organizationId, workspace) {
  const storage = getBrowserStorage();
  if (!storage) {
    return { ok: false, persisted: false, error: { code: 'STORAGE_UNAVAILABLE', message: 'Changes are available only during this session.' } };
  }

  try {
    const allOrganizations = safeParse(storage.getItem(STORAGE_KEYS.organizationPrototype), {});
    allOrganizations[organizationId] = {
      ...clone(workspace),
      version: PROTOTYPE_VERSION,
      organizationId,
      updatedAt: new Date().toISOString(),
    };
    storage.setItem(STORAGE_KEYS.organizationPrototype, JSON.stringify(allOrganizations));
    return { ok: true, persisted: true };
  } catch (error) {
    console.warn('Ekklesia Pulse could not save the organization prototype.', error);
    return { ok: false, persisted: false, error: { code: 'SAVE_FAILED', message: 'This prototype change could not be saved on this device.' } };
  }
}

export function getActiveWorkspace() {
  const storage = getBrowserStorage();
  if (!storage) return { ok: true, persisted: false, data: null };

  try {
    const raw = storage.getItem(STORAGE_KEYS.activeWorkspace);
    if (!raw) return { ok: true, persisted: true, data: null };

    const parsed = JSON.parse(raw);
    if (parsed?.type !== 'church' || typeof parsed.organizationId !== 'string' || !parsed.organizationId.trim()) {
      storage.removeItem(STORAGE_KEYS.activeWorkspace);
      return { ok: true, persisted: true, data: null, repaired: true };
    }

    return {
      ok: true,
      persisted: true,
      data: { type: 'church', organizationId: parsed.organizationId },
    };
  } catch (error) {
    console.warn('Ekklesia Pulse could not restore the active workspace.', error);
    try {
      storage.removeItem(STORAGE_KEYS.activeWorkspace);
    } catch (cleanupError) {
      console.warn('Ekklesia Pulse could not clear malformed workspace data.', cleanupError);
    }
    return { ok: true, persisted: false, data: null, repaired: true };
  }
}

export function restoreActiveOrganizationWorkspace() {
  return getActiveWorkspace();
}

export function enterOrganizationWorkspace(organizationId) {
  const normalizedId = String(organizationId || '').trim();
  if (!normalizedId) {
    return { ok: false, persisted: false, error: { code: 'INVALID_ORGANIZATION', message: 'This church organization is unavailable.' } };
  }

  const data = { type: 'church', organizationId: normalizedId };
  const storage = getBrowserStorage();
  if (!storage) return { ok: true, persisted: false, data };

  try {
    storage.setItem(STORAGE_KEYS.activeWorkspace, JSON.stringify(data));
    return { ok: true, persisted: true, data };
  } catch (error) {
    console.warn('Ekklesia Pulse could not persist the active church workspace.', error);
    return { ok: true, persisted: false, data };
  }
}

export function clearActiveWorkspace() {
  const storage = getBrowserStorage();
  if (!storage) return { ok: true, persisted: false, data: null };

  try {
    storage.removeItem(STORAGE_KEYS.activeWorkspace);
    return { ok: true, persisted: true, data: null };
  } catch (error) {
    console.warn('Ekklesia Pulse could not clear the active workspace.', error);
    return { ok: true, persisted: false, data: null };
  }
}

export function exitOrganizationWorkspace() {
  return clearActiveWorkspace();
}

export function generatePrototypeCode(label = 'CIRCLE') {
  const prefix = String(label)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6) || 'PULSE';
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${random}`;
}
