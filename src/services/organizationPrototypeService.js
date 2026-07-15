import { getBrowserStorage, STORAGE_KEYS } from './storageRegistry.js';

const PROTOTYPE_VERSION = 2;

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

function deterministicCode(label = 'ACCESS') {
  const prefix = String(label)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 7) || 'ACCESS';
  return `${prefix}1`;
}

function normalizeRole(role, organization) {
  if (!role) return null;
  if (role.role === 'Circle Leader') {
    return {
      role: 'Group Leader',
      scopeType: 'organization',
      scopeId: organization.id,
      scopeName: organization.name,
    };
  }
  return clone(role);
}

function normalizeMembers(members, organization) {
  return (Array.isArray(members) ? members : []).map((member) => ({
    ...clone(member),
    roles: (member.roles || []).map((role) => normalizeRole(role, organization)).filter(Boolean),
  }));
}

function normalizeMinistries(ministries) {
  return (Array.isArray(ministries) ? ministries : []).map((ministry) => {
    const { circles, ...rest } = clone(ministry);
    return {
      ...rest,
      code: ministry.code || deterministicCode(ministry.name),
      description: ministry.description || `An official ministry of the church serving within the mission of ${ministry.name}.`,
      pulse: { completedToday: 0, activeThisWeek: 0, ...(ministry.pulse || {}) },
    };
  });
}

function migrateLegacyGroups(ministries) {
  return (Array.isArray(ministries) ? ministries : []).flatMap((ministry) => (
    Array.isArray(ministry.circles) ? ministry.circles.map((circle) => ({
      ...clone(circle),
      connectedMinistryId: ministry.id,
      purpose: circle.purpose || `A leader-created group helping ${ministry.name} members grow and serve together.`,
      intendedMembers: circle.intendedMembers || `${ministry.name} members`,
      duration: circle.duration || 'Ongoing',
      memberLimit: circle.memberLimit || Math.max(20, circle.memberCount || 0),
      visibility: circle.visibility === 'Circle members' ? 'Invitation only' : circle.visibility,
    })) : []
  ));
}

function normalizeGroups(groups, ministries) {
  const ministryIds = new Set(ministries.map((ministry) => ministry.id));
  return (Array.isArray(groups) ? groups : []).map((group) => ({
    ...clone(group),
    code: group.code || deterministicCode(group.name),
    purpose: group.purpose || 'A purpose-driven group created by an appointed church leader.',
    intendedMembers: group.intendedMembers || 'Church members invited by the group leader',
    connectedMinistryId: ministryIds.has(group.connectedMinistryId) ? group.connectedMinistryId : '',
    memberCount: Number.isFinite(group.memberCount) ? group.memberCount : 0,
    memberLimit: Number.isFinite(group.memberLimit) ? group.memberLimit : 20,
    leaderId: group.leaderId || 'current-member',
    visibility: group.visibility || 'Invitation only',
    approvalRequired: group.approvalRequired !== false,
    duration: group.duration || 'Ongoing',
  }));
}

function normalizePolicies(policies = {}) {
  return {
    wholeChurchRhythm: false,
    ministryRhythm: true,
    groupRhythm: policies.groupRhythm ?? policies.circleRhythm ?? true,
    privateMode: true,
    profileDirectory: true,
    ...clone(policies),
    groupRhythm: policies.groupRhythm ?? policies.circleRhythm ?? true,
  };
}

function normalizeVisibility(visibility = {}) {
  const rhythmScope = visibility.rhythmScope === 'circles' ? 'groups' : visibility.rhythmScope || 'groups';
  return {
    profileScope: visibility.profileScope || 'church',
    rhythmScope,
    selectedGroupIds: clone(visibility.selectedGroupIds || visibility.selectedCircleIds || []),
  };
}

function normalizeCurrentMember(member, defaults, organization, visibility) {
  const source = { ...clone(defaults), ...clone(member || {}) };
  const roles = (source.roles || []).map((role) => normalizeRole(role, organization)).filter(Boolean);
  const ministryRoleIds = roles
    .filter((role) => role.role === 'Ministry Leader' && role.scopeType === 'ministry')
    .map((role) => role.scopeId);
  return {
    ...source,
    roles,
    ministryIds: [...new Set([...(source.ministryIds || []), ...ministryRoleIds])],
    groupIds: [...new Set(source.groupIds || visibility.selectedGroupIds || [])],
  };
}

function createInitialWorkspace(organization) {
  const sourceMinistries = clone(organization.ministries) || [];
  const ministries = normalizeMinistries(sourceMinistries);
  const legacyGroups = migrateLegacyGroups(sourceMinistries);
  const groups = normalizeGroups(
    Array.isArray(organization.groups) ? organization.groups : legacyGroups,
    ministries,
  );
  const memberVisibility = normalizeVisibility(organization.memberVisibility);
  const defaultCurrentMember = {
    id: 'current-member',
    organizationRole: 'Church Member',
    roles: [],
    ministryIds: [],
    groupIds: [],
  };

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
    policies: normalizePolicies(organization.policies),
    memberVisibility,
    currentMember: normalizeCurrentMember(
      organization.currentMember,
      defaultCurrentMember,
      organization,
      memberVisibility,
    ),
    ministries,
    groups,
    members: normalizeMembers(organization.members, organization),
  };
}

function normalizeWorkspace(organization, stored) {
  const defaults = createInitialWorkspace(organization);
  if (!stored || stored.organizationId !== organization.id) return defaults;

  const storedMinistries = Array.isArray(stored.ministries) ? stored.ministries : defaults.ministries;
  const ministries = normalizeMinistries(storedMinistries);
  const migratedGroups = Array.isArray(stored.groups)
    ? stored.groups
    : migrateLegacyGroups(storedMinistries);
  const groups = normalizeGroups(migratedGroups.length ? migratedGroups : defaults.groups, ministries);
  const memberVisibility = normalizeVisibility({
    ...defaults.memberVisibility,
    ...(stored.memberVisibility || {}),
  });

  return {
    ...defaults,
    ...clone(stored),
    version: PROTOTYPE_VERSION,
    pulse: { ...defaults.pulse, ...(stored.pulse || {}) },
    policies: normalizePolicies({ ...defaults.policies, ...(stored.policies || {}) }),
    memberVisibility,
    currentMember: normalizeCurrentMember(
      stored.currentMember,
      defaults.currentMember,
      organization,
      memberVisibility,
    ),
    ministries,
    groups,
    members: normalizeMembers(
      Array.isArray(stored.members) ? stored.members : defaults.members,
      organization,
    ),
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

export function generatePrototypeCode(label = 'GROUP') {
  const prefix = String(label)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6) || 'PULSE';
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${random}`;
}
