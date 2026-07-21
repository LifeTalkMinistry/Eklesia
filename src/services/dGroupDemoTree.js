import { D_GROUP_MEMBER_LIMIT } from './organizationPrototypeService.js';

const DEMO_TREE_VERSION = 2;
const NETWORK_ID = 'mighty-network';
const PRIMARY_GROUP_ID = 'dgroup-mighty-primary';

const LEADER_NAMES = [
  'Maria Santos',
  'Joshua Lim',
  'John Cruz',
  'Anna Reyes',
  'Daniel Garcia',
  'Faith Mendoza',
  'Paolo Ramos',
  'Grace Flores',
  'Samuel Torres',
  'Leah Navarro',
  'Nathan Aquino',
  'Ruth Castillo',
];

const FIRST_NAMES = [
  'Alyssa', 'Bea', 'Carlo', 'Diane', 'Elijah', 'Frances',
  'Gabriel', 'Hannah', 'Isaac', 'Jasmine', 'Kevin', 'Lara',
  'Miguel', 'Nicole', 'Owen', 'Patricia', 'Rafael', 'Sofia',
  'Timothy', 'Vanessa', 'Warren', 'Yana', 'Zachary', 'Celine',
];

const LAST_NAMES = [
  'Abad', 'Bautista', 'Cabrera', 'Domingo', 'Evangelista', 'Fernandez',
  'Gonzales', 'Herrera', 'Ignacio', 'Jimenez', 'Katigbak', 'Lopez',
  'Manalo', 'Natividad', 'Ocampo', 'Pascual', 'Quintos', 'Rivera',
  'Salazar', 'Tolentino', 'Uy', 'Valdez', 'Yap', 'Zamora',
];

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function makeWeeklyCheckIns(seed) {
  return Array.from({ length: 7 }, (_, index) => ((seed + index * 3) % 5) < 3);
}

function createPrototypeMember(id, name, assignedDGroupId, ledDGroupId = '', seed = 0) {
  const weeklyCheckIns = makeWeeklyCheckIns(seed);
  const completedToday = Boolean(weeklyCheckIns[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]);

  return {
    id,
    name,
    status: completedToday ? 'Completed today' : 'Building rhythm',
    growthSignal: completedToday ? 'Steady shared rhythm' : 'May appreciate encouragement',
    lastActiveLabel: completedToday ? 'Today' : 'This week',
    devotionCompletedWithin24Hours: completedToday,
    devotionCheckInLabel: completedToday ? 'Completed within 24 hours' : 'No completion shared today',
    weeklyCheckIns,
    roles: ledDGroupId ? [{
      role: 'D-Group Leader',
      scopeType: 'dgroup',
      scopeId: ledDGroupId,
      scopeName: `${name}'s D-Group`,
    }] : [],
    assignedDGroupId,
    ledDGroupId,
  };
}

function childMemberName(leaderIndex, memberIndex) {
  const first = FIRST_NAMES[(leaderIndex * D_GROUP_MEMBER_LIMIT + memberIndex) % FIRST_NAMES.length];
  const last = LAST_NAMES[(leaderIndex * 7 + memberIndex * 5) % LAST_NAMES.length];
  return `${first} ${last}`;
}

function hasCompleteTree(workspace) {
  const network = workspace?.dGroupNetwork;
  if (network?.demoTreeVersion !== DEMO_TREE_VERSION) return false;

  const groups = (workspace?.groups || []).filter((group) => group.groupType === 'dgroup');
  const primary = groups.find((group) => group.id === network.primaryGroupId);
  const children = groups.filter((group) => group.parentGroupId === network.primaryGroupId);

  return Boolean(
    primary
    && primary.memberIds?.length === D_GROUP_MEMBER_LIMIT
    && children.length === D_GROUP_MEMBER_LIMIT
    && children.every((group) => group.memberIds?.length === D_GROUP_MEMBER_LIMIT),
  );
}

export function ensureCompleteDGroupDemo(workspace) {
  if (!workspace || hasCompleteTree(workspace)) return workspace;

  const next = clone(workspace);
  const existingMembers = (next.members || []).filter((member) => member.id !== 'current-member');
  const existingById = new Map(existingMembers.map((member) => [member.id, member]));
  const usedIds = new Set();
  const leaders = [];

  for (let index = 0; index < D_GROUP_MEMBER_LIMIT; index += 1) {
    const existing = existingMembers[index];
    const id = existing?.id || `dgroup-demo-leader-${index + 1}`;
    const name = existing?.name || LEADER_NAMES[index];
    const childGroupId = `dgroup-mighty-child-${index + 1}`;
    usedIds.add(id);
    leaders.push({ id, name, childGroupId, source: existing });
  }

  const remainingExisting = existingMembers.filter((member) => !usedIds.has(member.id));
  let remainingIndex = 0;
  const childGroups = [];
  const generatedMembers = [];

  leaders.forEach((leader, leaderIndex) => {
    const childMemberIds = [];

    for (let memberIndex = 0; memberIndex < D_GROUP_MEMBER_LIMIT; memberIndex += 1) {
      const existing = remainingExisting[remainingIndex];
      remainingIndex += existing ? 1 : 0;
      const id = existing?.id || `dgroup-demo-member-${leaderIndex + 1}-${memberIndex + 1}`;
      const name = existing?.name || childMemberName(leaderIndex, memberIndex);
      usedIds.add(id);
      childMemberIds.push(id);
      generatedMembers.push({
        ...createPrototypeMember(id, name, leader.childGroupId, '', leaderIndex * 17 + memberIndex),
        ...(existing || {}),
        assignedDGroupId: leader.childGroupId,
        ledDGroupId: '',
      });
    }

    childGroups.push({
      id: leader.childGroupId,
      groupType: 'dgroup',
      networkId: NETWORK_ID,
      parentGroupId: PRIMARY_GROUP_ID,
      parentLeaderId: 'current-member',
      name: `${leader.name}'s D-Group`,
      code: `MIGHTY${String(leaderIndex + 1).padStart(2, '0')}`,
      purpose: `A complete child D-Group led by ${leader.name}, who remains accountable inside the primary Mighty Network D-Group.`,
      intendedMembers: `Twelve direct disciples assigned to ${leader.name}`,
      leaderId: leader.id,
      memberIds: childMemberIds,
      memberCount: D_GROUP_MEMBER_LIMIT,
      memberLimit: D_GROUP_MEMBER_LIMIT,
      visibility: 'Assigned members only',
      approvalRequired: true,
      duration: 'Ongoing',
    });
  });

  const leaderMembers = leaders.map((leader, index) => {
    const existing = existingById.get(leader.id) || leader.source;
    const roles = (existing?.roles || []).filter((role) => role.role !== 'D-Group Leader');
    roles.push({
      role: 'D-Group Leader',
      scopeType: 'dgroup',
      scopeId: leader.childGroupId,
      scopeName: `${leader.name}'s D-Group`,
    });

    return {
      ...createPrototypeMember(leader.id, leader.name, PRIMARY_GROUP_ID, leader.childGroupId, index),
      ...(existing || {}),
      name: leader.name,
      roles,
      assignedDGroupId: PRIMARY_GROUP_ID,
      ledDGroupId: leader.childGroupId,
    };
  });

  const untouchedMembers = existingMembers.filter((member) => !usedIds.has(member.id)).map((member) => ({
    ...member,
    assignedDGroupId: '',
    ledDGroupId: '',
  }));

  const primaryGroup = {
    id: PRIMARY_GROUP_ID,
    groupType: 'dgroup',
    networkId: NETWORK_ID,
    parentGroupId: '',
    parentLeaderId: '',
    name: 'Mighty Network D-Group',
    code: 'MIGHTY1',
    purpose: 'The primary discipleship circle where twelve direct leaders remain accountable while each leads twelve people of their own.',
    intendedMembers: 'Twelve direct D-Group leaders assigned to the primary network leader',
    leaderId: 'current-member',
    memberIds: leaders.map((leader) => leader.id),
    memberCount: D_GROUP_MEMBER_LIMIT,
    memberLimit: D_GROUP_MEMBER_LIMIT,
    visibility: 'Assigned members only',
    approvalRequired: true,
    duration: 'Ongoing',
  };

  next.groups = [
    ...(next.groups || []).filter((group) => group.groupType !== 'dgroup'),
    primaryGroup,
    ...childGroups,
  ];
  next.members = [...leaderMembers, ...generatedMembers, ...untouchedMembers];
  next.dGroupNetwork = {
    ...(next.dGroupNetwork || {}),
    id: NETWORK_ID,
    name: 'Mighty Network',
    primaryLeaderId: 'current-member',
    primaryGroupId: PRIMARY_GROUP_ID,
    maxDirectMembers: D_GROUP_MEMBER_LIMIT,
    demoTreeVersion: DEMO_TREE_VERSION,
    demoShape: '12x12',
    description: 'One primary leader directly disciples twelve leaders, and each of those twelve leaders directly disciples twelve people.',
  };
  next.dGroupLeadRequests = [];
  next.currentMember = {
    ...(next.currentMember || {}),
    assignedDGroupId: '',
    ledDGroupId: PRIMARY_GROUP_ID,
    groupIds: [...new Set([...(next.currentMember?.groupIds || []).filter((id) => !String(id).startsWith('dgroup-')), PRIMARY_GROUP_ID])],
  };

  return next;
}

export { DEMO_TREE_VERSION };
