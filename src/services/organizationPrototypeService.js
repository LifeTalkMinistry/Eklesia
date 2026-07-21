import { getBrowserStorage, STORAGE_KEYS } from './storageRegistry.js';

const PROTOTYPE_VERSION = 3;
const D_GROUP_MEMBER_LIMIT = 12;

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
    assignedDGroupId: member.assignedDGroupId || '',
    ledDGroupId: member.ledDGroupId || '',
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
      groupType: 'ministry',
      connectedMinistryId: ministry.id,
      purpose: circle.purpose || `A ministry accountability space helping ${ministry.name} members grow and serve together.`,
      intendedMembers: circle.intendedMembers || `${ministry.name} members`,
      duration: circle.duration || 'Ongoing',
      memberLimit: circle.memberLimit || Math.max(20, circle.memberCount || 0),
      visibility: circle.visibility === 'Circle members' ? 'Invitation only' : circle.visibility,
    })) : []
  ));
}

function normalizeGroups(groups, ministries) {
  const ministryIds = new Set(ministries.map((ministry) => ministry.id));
  return (Array.isArray(groups) ? groups : []).map((group) => {
    const groupType = group.groupType === 'dgroup' || group.networkId ? 'dgroup' : 'ministry';
    const memberIds = [...new Set(Array.isArray(group.memberIds) ? group.memberIds : [])];

    return {
      ...clone(group),
      groupType,
      code: group.code || deterministicCode(group.name),
      purpose: group.purpose || (groupType === 'dgroup'
        ? 'An assigned discipleship circle for spiritual growth, accountability, encouragement, and care.'
        : 'A ministry accountability space created by an appointed church leader.'),
      intendedMembers: group.intendedMembers || (groupType === 'dgroup'
        ? 'Members assigned under one D-Group leader'
        : 'Church members invited by the group leader'),
      connectedMinistryId: groupType === 'ministry' && ministryIds.has(group.connectedMinistryId)
        ? group.connectedMinistryId
        : '',
      networkId: groupType === 'dgroup' ? group.networkId || 'mighty-network' : '',
      parentGroupId: groupType === 'dgroup' ? group.parentGroupId || '' : '',
      parentLeaderId: groupType === 'dgroup' ? group.parentLeaderId || '' : '',
      memberIds,
      memberCount: groupType === 'dgroup'
        ? memberIds.length
        : Number.isFinite(group.memberCount) ? group.memberCount : memberIds.length,
      memberLimit: groupType === 'dgroup'
        ? D_GROUP_MEMBER_LIMIT
        : Number.isFinite(group.memberLimit) ? group.memberLimit : 20,
      leaderId: group.leaderId || 'current-member',
      visibility: group.visibility || (groupType === 'dgroup' ? 'Assigned members only' : 'Invitation only'),
      approvalRequired: group.approvalRequired !== false,
      duration: groupType === 'dgroup' ? 'Ongoing' : group.duration || 'Ongoing',
    };
  });
}

function createDefaultDGroupState(organization, members) {
  const networkId = 'mighty-network';
  const primaryGroupId = 'dgroup-mighty-primary';
  const candidateIds = members.map((member) => member.id).filter(Boolean);
  const primaryMemberIds = candidateIds.slice(0, Math.min(3, candidateIds.length));
  const firstLeaderId = primaryMemberIds[0] || '';
  const childGroupId = firstLeaderId ? `dgroup-${firstLeaderId.replace(/^member-/, '')}` : '';
  const childMemberIds = firstLeaderId ? candidateIds.slice(3, Math.min(5, candidateIds.length)) : [];

  const dGroups = [
    {
      id: primaryGroupId,
      groupType: 'dgroup',
      networkId,
      parentGroupId: '',
      parentLeaderId: '',
      name: 'Mighty Network D-Group',
      code: 'MIGHTY1',
      purpose: 'The primary discipleship circle of Mighty Network, forming leaders who continue the same spiritual family beneath them.',
      intendedMembers: 'Direct disciples assigned to the primary network leader',
      leaderId: 'current-member',
      memberIds: primaryMemberIds,
      memberCount: primaryMemberIds.length,
      memberLimit: D_GROUP_MEMBER_LIMIT,
      visibility: 'Assigned members only',
      approvalRequired: true,
      duration: 'Ongoing',
    },
  ];

  if (firstLeaderId) {
    dGroups.push({
      id: childGroupId,
      groupType: 'dgroup',
      networkId,
      parentGroupId: primaryGroupId,
      parentLeaderId: 'current-member',
      name: `${members.find((member) => member.id === firstLeaderId)?.name || 'Leader'}'s D-Group`,
      code: deterministicCode(`${firstLeaderId} DGROUP`),
      purpose: 'A child D-Group growing underneath Mighty Network while its leader remains accountable to the primary D-Group.',
      intendedMembers: 'Direct disciples assigned to this approved D-Group leader',
      leaderId: firstLeaderId,
      memberIds: childMemberIds,
      memberCount: childMemberIds.length,
      memberLimit: D_GROUP_MEMBER_LIMIT,
      visibility: 'Assigned members only',
      approvalRequired: true,
      duration: 'Ongoing',
    });
  }

  const requestCandidateId = primaryMemberIds.find((memberId) => memberId !== firstLeaderId) || '';
  const leadRequests = requestCandidateId ? [{
    id: `dgroup-request-${requestCandidateId}`,
    memberId: requestCandidateId,
    parentGroupId: primaryGroupId,
    requestedAt: new Date().toISOString(),
    status: 'pending',
  }] : [];

  const assignedMembers = members.map((member) => {
    const assignedDGroupId = primaryMemberIds.includes(member.id)
      ? primaryGroupId
      : childMemberIds.includes(member.id) ? childGroupId : member.assignedDGroupId || '';
    const ledDGroupId = member.id === firstLeaderId ? childGroupId : member.ledDGroupId || '';
    const roles = [...(member.roles || [])];

    if (ledDGroupId && !roles.some((role) => role.role === 'D-Group Leader' && role.scopeId === ledDGroupId)) {
      roles.push({
        role: 'D-Group Leader',
        scopeType: 'dgroup',
        scopeId: ledDGroupId,
        scopeName: dGroups.find((group) => group.id === ledDGroupId)?.name || 'D-Group',
      });
    }

    return { ...member, assignedDGroupId, ledDGroupId, roles };
  });

  return {
    network: {
      id: networkId,
      name: 'Mighty Network',
      primaryLeaderId: 'current-member',
      primaryGroupId,
      maxDirectMembers: D_GROUP_MEMBER_LIMIT,
      description: 'One connected discipleship family where every member has one assigned D-Group and every leader directly cares for no more than twelve people.',
    },
    dGroups,
    leadRequests,
    members: assignedMembers,
  };
}

function normalizeDGroupState(organization, groups, members, stored = {}) {
  const existingDGroups = groups.filter((group) => group.groupType === 'dgroup');
  const defaults = createDefaultDGroupState(organization, members);
  const dGroups = existingDGroups.length ? existingDGroups : defaults.dGroups;
  const dGroupIds = new Set(dGroups.map((group) => group.id));
  const network = {
    ...defaults.network,
    ...(stored.dGroupNetwork || {}),
    maxDirectMembers: D_GROUP_MEMBER_LIMIT,
  };

  const assignments = new Map();
  dGroups.forEach((group) => {
    (group.memberIds || []).forEach((memberId) => {
      if (!assignments.has(memberId)) assignments.set(memberId, group.id);
    });
  });

  const normalizedMembers = members.map((member) => {
    const assignedDGroupId = dGroupIds.has(member.assignedDGroupId)
      ? member.assignedDGroupId
      : assignments.get(member.id) || defaults.members.find((item) => item.id === member.id)?.assignedDGroupId || '';
    const ledGroup = dGroups.find((group) => group.leaderId === member.id);
    const ledDGroupId = dGroupIds.has(member.ledDGroupId)
      ? member.ledDGroupId
      : ledGroup?.id || defaults.members.find((item) => item.id === member.id)?.ledDGroupId || '';
    return { ...member, assignedDGroupId, ledDGroupId };
  });

  return {
    network,
    groups: [
      ...groups.filter((group) => group.groupType !== 'dgroup'),
      ...dGroups.map((group) => ({
        ...group,
        memberIds: [...new Set(group.memberIds || [])].slice(0, D_GROUP_MEMBER_LIMIT),
        memberCount: Math.min(D_GROUP_MEMBER_LIMIT, new Set(group.memberIds || []).size),
        memberLimit: D_GROUP_MEMBER_LIMIT,
      })),
    ],
    members: normalizedMembers,
    leadRequests: Array.isArray(stored.dGroupLeadRequests)
      ? stored.dGroupLeadRequests.map((request) => ({ ...clone(request), status: request.status || 'pending' }))
      : defaults.leadRequests,
  };
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

function normalizeCurrentMember(member, defaults, organization, visibility, dGroupState) {
  const source = { ...clone(defaults), ...clone(member || {}) };
  const roles = (source.roles || []).map((role) => normalizeRole(role, organization)).filter(Boolean);
  const ministryRoleIds = roles
    .filter((role) => role.role === 'Ministry Leader' && role.scopeType === 'ministry')
    .map((role) => role.scopeId);
  const ledDGroupId = source.ledDGroupId || (dGroupState.network.primaryLeaderId === 'current-member'
    ? dGroupState.network.primaryGroupId
    : '');
  const assignedDGroupId = source.assignedDGroupId || '';
  const dGroupIds = [assignedDGroupId, ledDGroupId].filter(Boolean);

  return {
    ...source,
    roles,
    ministryIds: [...new Set([...(source.ministryIds || []), ...ministryRoleIds])],
    groupIds: [...new Set([...(source.groupIds || visibility.selectedGroupIds || []), ...dGroupIds])],
    assignedDGroupId,
    ledDGroupId,
  };
}

function createInitialWorkspace(organization) {
  const sourceMinistries = clone(organization.ministries) || [];
  const ministries = normalizeMinistries(sourceMinistries);
  const legacyGroups = migrateLegacyGroups(sourceMinistries);
  const baseGroups = normalizeGroups(
    Array.isArray(organization.groups) ? organization.groups : legacyGroups,
    ministries,
  );
  const baseMembers = normalizeMembers(organization.members, organization);
  const dGroupState = normalizeDGroupState(organization, baseGroups, baseMembers);
  const memberVisibility = normalizeVisibility(organization.memberVisibility);
  const defaultCurrentMember = {
    id: 'current-member',
    organizationRole: 'Church Member',
    roles: [],
    ministryIds: [],
    groupIds: [],
    assignedDGroupId: '',
    ledDGroupId: dGroupState.network.primaryGroupId,
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
      dGroupState,
    ),
    ministries,
    groups: dGroupState.groups,
    dGroupNetwork: dGroupState.network,
    dGroupLeadRequests: dGroupState.leadRequests,
    members: dGroupState.members,
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
  const baseGroups = normalizeGroups(migratedGroups.length ? migratedGroups : defaults.groups, ministries);
  const baseMembers = normalizeMembers(
    Array.isArray(stored.members) ? stored.members : defaults.members,
    organization,
  );
  const dGroupState = normalizeDGroupState(organization, baseGroups, baseMembers, stored);
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
      dGroupState,
    ),
    ministries,
    groups: dGroupState.groups,
    dGroupNetwork: dGroupState.network,
    dGroupLeadRequests: dGroupState.leadRequests,
    members: dGroupState.members,
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

export { D_GROUP_MEMBER_LIMIT };
