import { useEffect, useMemo, useRef, useState } from 'react';
import {
  generatePrototypeCode,
  getOrganizationPrototypeState,
  saveOrganizationPrototypeState,
} from '../services/organizationPrototypeService.js';
import './OrganizationHub.css';
import './OrganizationGroups.css';

const SECTIONS = [
  ['pulse', 'Pulse'],
  ['ministries', 'Ministries'],
  ['groups', 'Groups'],
  ['people', 'People'],
  ['privacy', 'Privacy'],
];

const PROFILE_SCOPES = [
  ['private', 'Only me', 'Your profile is hidden from the church directory.'],
  ['groups', 'My groups', 'Only members of groups you joined can see your basic profile.'],
  ['ministries', 'My ministries', 'Members of ministries you belong to can see your basic profile.'],
  ['church', 'Whole church', 'Members of this church organization can see your basic profile.'],
];

const RHYTHM_SCOPES = [
  ['private', 'Private', 'Only you can see your personal rhythm signals.'],
  ['groups', 'Selected groups', 'Only selected leader-created groups can see general rhythm signals.'],
  ['ministries', 'My ministries', 'Your ministries can see general rhythm signals.'],
  ['church', 'Whole church', 'The church can see your general rhythm status.'],
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function DialogShell({ titleId, children, onClose }) {
  return (
    <div className="organization-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="organization-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        {children}
      </section>
    </div>
  );
}

function ScopeChoice({ name, value, current, title, description, disabled, onChange }) {
  return (
    <label className={`organization-scope-choice ${current === value ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`}>
      <input type="radio" name={name} value={value} checked={current === value} disabled={disabled} onChange={() => onChange(value)} />
      <span className="organization-radio-dot" aria-hidden="true" />
      <span><strong>{title}</strong><small>{description}</small></span>
    </label>
  );
}

function PolicySwitch({ checked, label, description, locked, onChange }) {
  return (
    <label className={`organization-policy-row ${locked ? 'is-locked' : ''}`}>
      <span><strong>{label}</strong><small>{description}</small></span>
      <input type="checkbox" checked={checked} disabled={locked} onChange={(event) => onChange(event.target.checked)} />
      <span className="organization-switch" aria-hidden="true" />
    </label>
  );
}

function MetricCard({ value, label, note }) {
  return (
    <article className="organization-metric-card">
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{note}</small>
    </article>
  );
}

export default function OrganizationHub({ organization, profile, onShowDetails, onRequestLeave }) {
  const [section, setSection] = useState('pulse');
  const [workspace, setWorkspace] = useState(() => getOrganizationPrototypeState(organization));
  const [expandedMinistryId, setExpandedMinistryId] = useState('music');
  const [dialog, setDialog] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [ministryJoin, setMinistryJoin] = useState({ ministryId: '', code: '', verified: false, error: '' });
  const [groupJoin, setGroupJoin] = useState({ code: '', groupId: '', verified: false, error: '' });
  const [createGroupForm, setCreateGroupForm] = useState({
    name: '',
    purpose: '',
    intendedMembers: '',
    ministryId: '',
    leaderId: 'current-member',
    visibility: 'Invitation only',
    approvalMode: 'Leader approval',
    memberLimit: '20',
    duration: 'Ongoing',
  });
  const [roleForm, setRoleForm] = useState({ memberId: 'member-maria', role: 'Ministry Leader', scopeId: 'youth' });
  const firstDialogButtonRef = useRef(null);

  const currentMemberName = profile?.displayName || 'Current member';
  const currentRole = workspace.currentMember?.organizationRole || 'Church Member';
  const isOrganizationManager = ['Organization Owner', 'Organization Admin'].includes(currentRole);
  const ministries = workspace.ministries || [];
  const members = workspace.members || [];
  const groups = workspace.groups || [];
  const currentMemberRoles = workspace.currentMember?.roles || [];
  const canManageMinistry = (ministryId) => isOrganizationManager || currentMemberRoles.some((role) => role.role === 'Ministry Leader' && role.scopeId === ministryId);
  const isAppointedGroupLeader = currentMemberRoles.some((role) => role.role === 'Group Leader');
  const canCreateGroup = isOrganizationManager || isAppointedGroupLeader;
  const joinedMinistryIds = new Set(workspace.currentMember?.ministryIds || []);
  const joinedGroupIds = new Set(workspace.currentMember?.groupIds || []);
  const pendingGroupIds = new Set(workspace.currentMember?.pendingGroupIds || []);

  const appointedGroupLeaders = useMemo(() => {
    const leaders = [];
    if (isOrganizationManager || isAppointedGroupLeader) leaders.push({ id: 'current-member', name: currentMemberName });
    members.forEach((member) => {
      if ((member.roles || []).some((role) => role.role === 'Group Leader')) leaders.push({ id: member.id, name: member.name });
    });
    return leaders.filter((leader, index, collection) => collection.findIndex((item) => item.id === leader.id) === index);
  }, [isOrganizationManager, isAppointedGroupLeader, currentMemberName, members]);

  function memberName(memberId) {
    if (memberId === 'current-member') return currentMemberName;
    return members.find((member) => member.id === memberId)?.name || 'Unassigned';
  }

  function ministryName(ministryId) {
    return ministries.find((ministry) => ministry.id === ministryId)?.name || '';
  }

  function persist(updater, successMessage = '') {
    setWorkspace((current) => {
      const next = typeof updater === 'function' ? updater(clone(current)) : updater;
      const result = saveOrganizationPrototypeState(organization.id, next);
      setStatusMessage(result.ok ? successMessage : result.error?.message || 'This prototype change could not be saved.');
      return next;
    });
  }

  async function copyCode(code) {
    try {
      await navigator.clipboard.writeText(code);
      setStatusMessage(`Code ${code} copied.`);
    } catch (error) {
      console.warn('Organization code copy failed.', error);
      setStatusMessage(`Code: ${code}`);
    }
  }

  function rotateOrganizationCode() {
    persist((current) => ({ ...current, organizationCode: generatePrototypeCode(organization.name) }), 'A new organization code was created for this prototype.');
  }

  function rotateMinistryCode(ministryId) {
    persist((current) => ({
      ...current,
      ministries: current.ministries.map((ministry) => ministry.id === ministryId
        ? { ...ministry, code: generatePrototypeCode(ministry.name) }
        : ministry),
    }), 'The ministry code was rotated. Existing ministry members remain connected.');
  }

  function rotateGroupCode(groupId) {
    persist((current) => ({
      ...current,
      groups: current.groups.map((group) => group.id === groupId
        ? { ...group, code: generatePrototypeCode(group.name) }
        : group),
    }), 'The group code was rotated. Existing group members remain connected.');
  }

  function openMinistryJoin(ministryId) {
    setMinistryJoin({ ministryId, code: '', verified: false, error: '' });
    setDialog('join-ministry');
    window.requestAnimationFrame(() => firstDialogButtonRef.current?.focus());
  }

  function verifyMinistryCode(event) {
    event.preventDefault();
    const ministry = ministries.find((item) => item.id === ministryJoin.ministryId);
    if (!ministry) return;
    if (normalizeCode(ministryJoin.code) !== normalizeCode(ministry.code)) {
      setMinistryJoin((current) => ({ ...current, verified: false, error: 'That code does not match this ministry. Ask the ministry manager for the current code.' }));
      return;
    }
    setMinistryJoin((current) => ({ ...current, verified: true, error: '' }));
  }

  function confirmMinistryJoin() {
    const ministry = ministries.find((item) => item.id === ministryJoin.ministryId);
    if (!ministry || !ministryJoin.verified) return;
    persist((current) => ({
      ...current,
      currentMember: {
        ...current.currentMember,
        ministryIds: [...new Set([...(current.currentMember.ministryIds || []), ministry.id])],
      },
      ministries: current.ministries.map((item) => item.id === ministry.id
        ? { ...item, memberCount: item.memberCount + (joinedMinistryIds.has(item.id) ? 0 : 1) }
        : item),
    }), `You joined ${ministry.name}.`);
    setDialog('');
  }

  function openGroupJoin() {
    setGroupJoin({ code: '', groupId: '', verified: false, error: '' });
    setDialog('join-group');
    window.requestAnimationFrame(() => firstDialogButtonRef.current?.focus());
  }

  function verifyGroupCode(event) {
    event.preventDefault();
    const group = groups.find((item) => normalizeCode(item.code) === normalizeCode(groupJoin.code));
    if (!group) {
      setGroupJoin((current) => ({ ...current, groupId: '', verified: false, error: 'No group was found using that code. Ask the appointed group leader for the current code.' }));
      return;
    }
    setGroupJoin((current) => ({ ...current, groupId: group.id, verified: true, error: '' }));
  }

  function confirmGroupJoin() {
    const group = groups.find((item) => item.id === groupJoin.groupId);
    if (!group || !groupJoin.verified) return;
    const alreadyJoined = joinedGroupIds.has(group.id);
    const alreadyPending = pendingGroupIds.has(group.id);

    if (alreadyJoined || alreadyPending) {
      setStatusMessage(alreadyJoined ? `You already belong to ${group.name}.` : `Your request to join ${group.name} is already pending.`);
      setDialog('');
      return;
    }

    if (group.approvalRequired) {
      persist((current) => ({
        ...current,
        currentMember: {
          ...current.currentMember,
          pendingGroupIds: [...new Set([...(current.currentMember.pendingGroupIds || []), group.id])],
        },
      }), `Your request to join ${group.name} was sent to the appointed group leader.`);
    } else {
      persist((current) => ({
        ...current,
        currentMember: {
          ...current.currentMember,
          groupIds: [...new Set([...(current.currentMember.groupIds || []), group.id])],
        },
        groups: current.groups.map((item) => item.id === group.id
          ? { ...item, memberCount: item.memberCount + 1 }
          : item),
      }), `You joined ${group.name}.`);
    }
    setDialog('');
  }

  function openCreateGroup() {
    const leaderId = isOrganizationManager ? appointedGroupLeaders[0]?.id || 'current-member' : 'current-member';
    setCreateGroupForm({
      name: '',
      purpose: '',
      intendedMembers: '',
      ministryId: '',
      leaderId,
      visibility: 'Invitation only',
      approvalMode: 'Leader approval',
      memberLimit: '20',
      duration: 'Ongoing',
    });
    setDialog('create-group');
    window.requestAnimationFrame(() => firstDialogButtonRef.current?.focus());
  }

  function createGroup(event) {
    event.preventDefault();
    const name = createGroupForm.name.trim();
    const purpose = createGroupForm.purpose.trim();
    const intendedMembers = createGroupForm.intendedMembers.trim();
    const memberLimit = Math.max(2, Number.parseInt(createGroupForm.memberLimit, 10) || 20);
    if (!name || !purpose || !intendedMembers || !createGroupForm.leaderId) return;

    const newGroup = {
      id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'group'}-${Date.now().toString(36)}`,
      name,
      code: generatePrototypeCode(name),
      purpose,
      intendedMembers,
      connectedMinistryId: createGroupForm.ministryId,
      memberCount: 1,
      memberLimit,
      leaderId: createGroupForm.leaderId,
      visibility: createGroupForm.visibility,
      approvalRequired: createGroupForm.approvalMode === 'Leader approval',
      duration: createGroupForm.duration,
    };

    persist((current) => ({
      ...current,
      groups: [...(current.groups || []), newGroup],
      currentMember: createGroupForm.leaderId === 'current-member'
        ? { ...current.currentMember, groupIds: [...new Set([...(current.currentMember.groupIds || []), newGroup.id])] }
        : current.currentMember,
    }), `${name} was created as a leader-created church group.`);
    setDialog('');
  }

  function openRoleDialog(memberId = members[0]?.id || 'member-maria', role = 'Ministry Leader', scopeId = ministries[0]?.id || '') {
    setRoleForm({ memberId, role, scopeId });
    setDialog('assign-role');
    window.requestAnimationFrame(() => firstDialogButtonRef.current?.focus());
  }

  function assignRole(event) {
    event.preventDefault();
    if (!roleForm.memberId || !roleForm.role) return;
    const ministry = ministries.find((item) => item.id === roleForm.scopeId);
    if (roleForm.role === 'Ministry Leader' && !ministry) return;

    const nextRole = roleForm.role === 'Group Leader'
      ? { role: 'Group Leader', scopeType: 'organization', scopeId: organization.id, scopeName: organization.name }
      : { role: 'Ministry Leader', scopeType: 'ministry', scopeId: ministry.id, scopeName: ministry.name };

    persist((current) => ({
      ...current,
      members: current.members.map((member) => {
        if (member.id !== roleForm.memberId) return member;
        const roles = Array.isArray(member.roles) ? member.roles : [];
        const duplicate = roles.some((item) => item.role === nextRole.role && item.scopeId === nextRole.scopeId);
        return duplicate ? member : { ...member, roles: [...roles, nextRole] };
      }),
    }), roleForm.role === 'Group Leader'
      ? `${memberName(roleForm.memberId)} may now create purpose-driven groups for the church.`
      : `${memberName(roleForm.memberId)} was assigned as Ministry Leader for ${ministry.name}.`);
    setDialog('');
  }

  function updateVisibility(field, value) {
    persist((current) => ({
      ...current,
      memberVisibility: { ...current.memberVisibility, [field]: value },
    }), 'Your prototype visibility preference was updated.');
  }

  function toggleSelectedGroup(groupId) {
    persist((current) => {
      const selected = new Set(current.memberVisibility.selectedGroupIds || []);
      if (selected.has(groupId)) selected.delete(groupId); else selected.add(groupId);
      return { ...current, memberVisibility: { ...current.memberVisibility, selectedGroupIds: [...selected] } };
    }, 'Your selected groups were updated.');
  }

  function updatePolicy(key, checked) {
    persist((current) => ({ ...current, policies: { ...current.policies, [key]: checked } }), 'The organization sharing policy was updated for this prototype.');
  }

  useEffect(() => {
    if (!dialog) return undefined;
    function handleEscape(event) {
      if (event.key === 'Escape') setDialog('');
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [dialog]);

  const pulsePercent = workspace.pulse.activeMembers
    ? Math.round((workspace.pulse.completedToday / workspace.pulse.activeMembers) * 100)
    : 0;
  const previewMinistry = ministries.find((item) => item.id === ministryJoin.ministryId);
  const previewGroup = groups.find((item) => item.id === groupJoin.groupId);

  return (
    <section className="panel-page organization-hub">
      <header className="organization-hero">
        <div>
          <p className="dashboard-eyebrow">Church organization</p>
          <h2>{organization.name}</h2>
          <p className="panel-intro">{organization.memberCount} members · Your role: {currentRole}</p>
        </div>
        <div className="organization-hero-badges">
          <span className="organization-connected-badge">✓ Connected</span>
          <span className="organization-demo-badge">UI PROTOTYPE</span>
        </div>
      </header>

      <section className="organization-access-card" aria-label="Church organization access">
        <div>
          <p className="dashboard-eyebrow">Organization access</p>
          <h3>Church code</h3>
          <p>New members use this code to request entry into the whole church organization. It is separate from ministry and group codes.</p>
        </div>
        <div className="organization-code-row">
          <code>{workspace.organizationCode}</code>
          <button type="button" onClick={() => copyCode(workspace.organizationCode)}>Copy</button>
          {isOrganizationManager ? <button type="button" onClick={rotateOrganizationCode}>Rotate</button> : null}
        </div>
        <small>{workspace.approvalMode} · Rotating the code does not remove existing members.</small>
      </section>

      <nav className="organization-section-nav" aria-label="Church organization sections">
        {SECTIONS.map(([id, label]) => (
          <button key={id} type="button" className={section === id ? 'is-active' : ''} onClick={() => setSection(id)}>{label}</button>
        ))}
      </nav>

      {statusMessage ? <p className="organization-status" role="status">{statusMessage}</p> : null}

      {section === 'pulse' ? (
        <div className="organization-section-stack">
          <section className="organization-pulse-card">
            <div className="organization-section-heading">
              <div><p className="dashboard-eyebrow">Church Pulse</p><h3>See the rhythm without exposing the heart.</h3></div>
              <strong>{pulsePercent}% today</strong>
            </div>
            <div className="organization-progress-track" aria-label={`${pulsePercent}% of active members completed a devotion today`}>
              <span style={{ width: `${Math.min(100, pulsePercent)}%` }} />
            </div>
            <p>{workspace.pulse.completedToday} members made time for devotion today. This overview uses general activity signals, not private reflections.</p>
          </section>

          <div className="organization-metrics-grid">
            <MetricCard value={workspace.pulse.activeMembers} label="active members" note="Inside this organization" />
            <MetricCard value={workspace.pulse.completedToday} label="completed today" note="One signal per Manila day" />
            <MetricCard value={workspace.pulse.rebuildingRhythm} label="rebuilding rhythm" note="Needs grace, not pressure" />
            <MetricCard value={workspace.pulse.careSignals} label="care signals" note="May appreciate encouragement" />
          </div>

          <section className="organization-panel-card">
            <div className="organization-section-heading">
              <div><p className="dashboard-eyebrow">Ministry pulse</p><h3>Care within the right scope</h3></div>
            </div>
            <div className="organization-ministry-pulse-list">
              {ministries.map((ministry) => {
                const percent = ministry.memberCount ? Math.round((ministry.pulse.completedToday / ministry.memberCount) * 100) : 0;
                return (
                  <article key={ministry.id}>
                    <span className="organization-ministry-icon" aria-hidden="true">{ministry.icon}</span>
                    <div><strong>{ministry.name}</strong><small>{ministry.pulse.completedToday} of {ministry.memberCount} completed today</small></div>
                    <b>{percent}%</b>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="organization-care-note">
            <span aria-hidden="true">♡</span>
            <div><strong>No rankings. No spiritual scores.</strong><p>The church may understand its pulse without reading the private details of a member’s heart.</p></div>
          </section>
        </div>
      ) : null}

      {section === 'ministries' ? (
        <div className="organization-section-stack">
          <div className="organization-section-heading organization-page-heading">
            <div><p className="dashboard-eyebrow">Official ministries</p><h3>Choose where you serve.</h3><p>Ministries are published by the church. Select one and enter the code provided by its ministry manager.</p></div>
          </div>
          <div className="organization-ministry-grid">
            {ministries.map((ministry) => {
              const expanded = expandedMinistryId === ministry.id;
              const joined = joinedMinistryIds.has(ministry.id);
              const ministryLeaders = members.flatMap((member) => (member.roles || [])
                .filter((role) => role.role === 'Ministry Leader' && role.scopeId === ministry.id)
                .map(() => memberName(member.id)));
              if (currentMemberRoles.some((role) => role.role === 'Ministry Leader' && role.scopeId === ministry.id)) ministryLeaders.unshift(currentMemberName);
              return (
                <article className={`organization-ministry-card ${expanded ? 'is-expanded' : ''}`} key={ministry.id}>
                  <button className="organization-ministry-summary" type="button" onClick={() => setExpandedMinistryId(expanded ? '' : ministry.id)} aria-expanded={expanded}>
                    <span className="organization-ministry-icon" aria-hidden="true">{ministry.icon}</span>
                    <span><strong>{ministry.name}</strong><small>{ministry.memberCount} members {joined ? '· Joined' : ''}</small></span>
                    <b aria-hidden="true">{expanded ? '−' : '+'}</b>
                  </button>
                  {expanded ? (
                    <div className="organization-ministry-details">
                      <p className="organization-ministry-description">{ministry.description}</p>
                      <p><b>Ministry leaders:</b> {ministryLeaders.length ? [...new Set(ministryLeaders)].join(', ') : 'Not assigned'}</p>
                      <div className="organization-inline-actions">
                        {joined ? <span className="organization-membership-chip">✓ You belong to this ministry</span> : <button type="button" onClick={() => openMinistryJoin(ministry.id)}>Join with ministry code</button>}
                        {isOrganizationManager ? <button type="button" onClick={() => openRoleDialog('member-maria', 'Ministry Leader', ministry.id)}>Assign ministry leader</button> : null}
                      </div>
                      {canManageMinistry(ministry.id) ? (
                        <div className="organization-manager-code">
                          <span><strong>Ministry access code</strong><small>Share this only with approved ministry members.</small></span>
                          <code>{ministry.code}</code>
                          <button type="button" onClick={() => copyCode(ministry.code)}>Copy</button>
                          <button type="button" onClick={() => rotateMinistryCode(ministry.id)}>Rotate</button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      {section === 'groups' ? (
        <div className="organization-section-stack">
          <div className="organization-section-heading organization-page-heading">
            <div><p className="dashboard-eyebrow">Leader-created groups</p><h3>Purpose-driven spaces for specific people and missions.</h3><p>Appointed Group Leaders may create church-wide, cross-ministry, ministry-connected, temporary, or ongoing groups.</p></div>
            <div className="organization-heading-actions">
              <button className="organization-secondary-small" type="button" onClick={openGroupJoin}>Enter group code</button>
              {canCreateGroup ? <button className="organization-primary-small" type="button" onClick={openCreateGroup}>Create group</button> : null}
            </div>
          </div>
          <section className="organization-group-explainer">
            <span aria-hidden="true">◎</span>
            <div><strong>Groups are not official ministries.</strong><p>They are flexible spaces made by qualified church-appointed leaders for a particular mission, life stage, project, care need, or community.</p></div>
          </section>
          <div className="organization-circle-grid">
            {groups.map((group) => {
              const joined = joinedGroupIds.has(group.id);
              const pending = pendingGroupIds.has(group.id);
              const connectedMinistry = ministryName(group.connectedMinistryId);
              const canManageGroup = isOrganizationManager || group.leaderId === 'current-member';
              return (
                <article className="organization-circle-card organization-group-card" key={group.id}>
                  <div className="organization-group-topline">
                    <span className="organization-circle-ministry">{connectedMinistry || 'Church-wide group'}</span>
                    {joined ? <span className="organization-membership-chip">✓ Joined</span> : pending ? <span className="organization-pending-chip">Request pending</span> : null}
                  </div>
                  <h4>{group.name}</h4>
                  <p>{group.purpose}</p>
                  <dl>
                    <div><dt>Appointed leader</dt><dd>{memberName(group.leaderId)}</dd></div>
                    <div><dt>Intended members</dt><dd>{group.intendedMembers}</dd></div>
                    <div><dt>Members</dt><dd>{group.memberCount} of {group.memberLimit}</dd></div>
                    <div><dt>Duration</dt><dd>{group.duration}</dd></div>
                    <div><dt>Access</dt><dd>{group.visibility}</dd></div>
                    <div><dt>Join approval</dt><dd>{group.approvalRequired ? 'Leader approval' : 'Automatic'}</dd></div>
                  </dl>
                  {!joined && !pending ? <button className="organization-text-action organization-group-join-action" type="button" onClick={openGroupJoin}>Join using group code</button> : null}
                  {canManageGroup ? (
                    <div className="organization-group-code-controls">
                      <div className="organization-circle-code"><code>{group.code}</code><button type="button" onClick={() => copyCode(group.code)}>Copy</button></div>
                      <button className="organization-text-action" type="button" onClick={() => rotateGroupCode(group.id)}>Rotate group code</button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      {section === 'people' ? (
        <div className="organization-section-stack">
          <div className="organization-section-heading organization-page-heading">
            <div><p className="dashboard-eyebrow">Roles and scope</p><h3>People do not all need the same authority.</h3><p>Organization administration, ministry management, and permission to create church groups remain separate.</p></div>
          </div>
          <section className="organization-owner-card">
            <span className="organization-avatar" aria-hidden="true">{organization.ownerName.charAt(0)}</span>
            <div><strong>{organization.ownerName}</strong><small>Organization Owner · Billing and ownership</small></div>
            <span className="organization-role-chip">Owner</span>
          </section>
          <div className="organization-people-list">
            <article>
              <span className="organization-avatar" aria-hidden="true">{currentMemberName.charAt(0)}</span>
              <div><strong>{currentMemberName}</strong><small>{currentRole}</small><div className="organization-role-list">{currentMemberRoles.map((role) => <span key={`${role.role}-${role.scopeId}`}>{role.role} · {role.scopeName}</span>)}</div></div>
              <span className="organization-role-chip">You</span>
            </article>
            {members.filter((member) => member.id !== 'current-member').map((member) => (
              <article key={member.id}>
                <span className="organization-avatar" aria-hidden="true">{member.name.charAt(0)}</span>
                <div><strong>{member.name}</strong><small>{member.organizationRole || 'Church Member'}</small><div className="organization-role-list">{(member.roles || []).map((role) => <span key={`${role.role}-${role.scopeId}`}>{role.role} · {role.scopeName}</span>)}</div></div>
                {isOrganizationManager ? <button className="organization-text-action" type="button" onClick={() => openRoleDialog(member.id)}>Assign role</button> : null}
              </article>
            ))}
          </div>
          <section className="organization-permission-note">
            <strong>Group creation is an appointed responsibility.</strong>
            <p>A Group Leader may create groups for different missions and people across the church. This permission does not grant organization administration, ministry control, or access to private devotional content.</p>
          </section>
        </div>
      ) : null}

      {section === 'privacy' ? (
        <div className="organization-section-stack">
          <section className="organization-panel-card">
            <p className="dashboard-eyebrow">Profile visibility</p>
            <h3>Who can recognize you in the organization?</h3>
            <div className="organization-scope-grid">
              {PROFILE_SCOPES.map(([value, title, description]) => <ScopeChoice key={value} name="profile-scope" value={value} current={workspace.memberVisibility.profileScope} title={title} description={description} onChange={(next) => updateVisibility('profileScope', next)} />)}
            </div>
          </section>

          <section className="organization-panel-card">
            <p className="dashboard-eyebrow">Rhythm visibility</p>
            <h3>Who can see your general devotional rhythm?</h3>
            <div className="organization-scope-grid">
              {RHYTHM_SCOPES.map(([value, title, description]) => {
                const disabled = (value === 'church' && !workspace.policies.wholeChurchRhythm)
                  || (value === 'ministries' && !workspace.policies.ministryRhythm)
                  || (value === 'groups' && !workspace.policies.groupRhythm);
                return <ScopeChoice key={value} name="rhythm-scope" value={value} current={workspace.memberVisibility.rhythmScope} title={title} description={description} disabled={disabled} onChange={(next) => updateVisibility('rhythmScope', next)} />;
              })}
            </div>
            {workspace.memberVisibility.rhythmScope === 'groups' ? (
              <div className="organization-circle-selection">
                <strong>Selected groups</strong>
                {groups.filter((group) => joinedGroupIds.has(group.id)).map((group) => (
                  <label key={group.id}><input type="checkbox" checked={(workspace.memberVisibility.selectedGroupIds || []).includes(group.id)} onChange={() => toggleSelectedGroup(group.id)} /> <span>{group.name}</span></label>
                ))}
              </div>
            ) : null}
          </section>

          <section className="organization-private-content-card">
            <span aria-hidden="true">🔒</span>
            <div><p className="dashboard-eyebrow">Always private by default</p><h3>The details of your heart are not organization data.</h3><p>WGAP responses, prayers, journals, notebook photos, personal notes, and exact devotional passages are not automatically visible to ministry managers, group leaders, or church administrators.</p></div>
          </section>

          {isOrganizationManager ? (
            <section className="organization-panel-card">
              <p className="dashboard-eyebrow">Organization policy · Prototype admin</p>
              <h3>Choose which sharing options members may voluntarily use.</h3>
              <div className="organization-policy-list">
                <PolicySwitch checked={workspace.policies.groupRhythm} label="Group rhythm sharing" description="Members may share general signals with selected leader-created groups." onChange={(checked) => updatePolicy('groupRhythm', checked)} />
                <PolicySwitch checked={workspace.policies.ministryRhythm} label="Ministry rhythm sharing" description="Members may share general signals with ministries they belong to." onChange={(checked) => updatePolicy('ministryRhythm', checked)} />
                <PolicySwitch checked={workspace.policies.wholeChurchRhythm} label="Whole-church rhythm sharing" description="Members may voluntarily share general rhythm status across the church." onChange={(checked) => updatePolicy('wholeChurchRhythm', checked)} />
                <PolicySwitch checked label="Private mode" description="Members can always keep personal rhythm signals private." locked onChange={() => {}} />
              </div>
              <p className="organization-policy-warning">An administrator should never silently change a member from Private to Whole Church.</p>
            </section>
          ) : null}
        </div>
      ) : null}

      <footer className="organization-footer-actions">
        <button className="secondary-button" type="button" onClick={onShowDetails}>Organization details</button>
        <button className="together-leave-link" type="button" onClick={onRequestLeave}>Leave organization</button>
      </footer>

      {dialog === 'join-ministry' && previewMinistry ? (
        <DialogShell titleId="join-ministry-title" onClose={() => setDialog('')}>
          <div className="organization-dialog-heading"><div><p className="dashboard-eyebrow">Official ministry access</p><h3 id="join-ministry-title">Join {previewMinistry.name}</h3></div><button type="button" onClick={() => setDialog('')} aria-label="Close">×</button></div>
          {!ministryJoin.verified ? (
            <form className="organization-dialog-form" onSubmit={verifyMinistryCode}>
              <p className="organization-dialog-intro">Enter the ministry code provided by the appointed manager of {previewMinistry.name}.</p>
              <label>Ministry code<input ref={firstDialogButtonRef} value={ministryJoin.code} onChange={(event) => setMinistryJoin((current) => ({ ...current, code: normalizeCode(event.target.value), error: '' }))} placeholder="Enter ministry code" autoCapitalize="characters" autoComplete="off" required /></label>
              {ministryJoin.error ? <p className="organization-form-error" role="alert">{ministryJoin.error}</p> : null}
              <div className="organization-dialog-actions"><button className="secondary-button" type="button" onClick={() => setDialog('')}>Cancel</button><button className="primary-button" type="submit" disabled={!ministryJoin.code}>Verify code</button></div>
            </form>
          ) : (
            <div className="organization-verification-preview">
              <span className="organization-verification-icon" aria-hidden="true">✓</span>
              <h4>{previewMinistry.name}</h4>
              <p>{previewMinistry.description}</p>
              <small>{previewMinistry.memberCount} current members</small>
              <div className="organization-dialog-actions"><button className="secondary-button" type="button" onClick={() => setMinistryJoin((current) => ({ ...current, verified: false }))}>Back</button><button className="primary-button" type="button" onClick={confirmMinistryJoin}>Join ministry</button></div>
            </div>
          )}
        </DialogShell>
      ) : null}

      {dialog === 'join-group' ? (
        <DialogShell titleId="join-group-title" onClose={() => setDialog('')}>
          <div className="organization-dialog-heading"><div><p className="dashboard-eyebrow">Leader-created group</p><h3 id="join-group-title">Enter a group code</h3></div><button type="button" onClick={() => setDialog('')} aria-label="Close">×</button></div>
          {!groupJoin.verified ? (
            <form className="organization-dialog-form" onSubmit={verifyGroupCode}>
              <p className="organization-dialog-intro">Enter the code provided by an appointed Group Leader. The code identifies the specific purpose-driven group.</p>
              <label>Group code<input ref={firstDialogButtonRef} value={groupJoin.code} onChange={(event) => setGroupJoin((current) => ({ ...current, code: normalizeCode(event.target.value), error: '' }))} placeholder="Enter group code" autoCapitalize="characters" autoComplete="off" required /></label>
              {groupJoin.error ? <p className="organization-form-error" role="alert">{groupJoin.error}</p> : null}
              <div className="organization-dialog-actions"><button className="secondary-button" type="button" onClick={() => setDialog('')}>Cancel</button><button className="primary-button" type="submit" disabled={!groupJoin.code}>Find group</button></div>
            </form>
          ) : previewGroup ? (
            <div className="organization-verification-preview organization-group-preview">
              <span className="organization-verification-icon" aria-hidden="true">◎</span>
              <p className="dashboard-eyebrow">{ministryName(previewGroup.connectedMinistryId) || 'Church-wide group'}</p>
              <h4>{previewGroup.name}</h4>
              <p>{previewGroup.purpose}</p>
              <dl>
                <div><dt>Appointed leader</dt><dd>{memberName(previewGroup.leaderId)}</dd></div>
                <div><dt>Intended members</dt><dd>{previewGroup.intendedMembers}</dd></div>
                <div><dt>Join process</dt><dd>{previewGroup.approvalRequired ? 'Leader approval required' : 'Automatic joining'}</dd></div>
              </dl>
              <div className="organization-dialog-actions"><button className="secondary-button" type="button" onClick={() => setGroupJoin((current) => ({ ...current, verified: false, groupId: '' }))}>Back</button><button className="primary-button" type="button" onClick={confirmGroupJoin}>{previewGroup.approvalRequired ? 'Request to join' : 'Join group'}</button></div>
            </div>
          ) : null}
        </DialogShell>
      ) : null}

      {dialog === 'create-group' ? (
        <DialogShell titleId="create-group-title" onClose={() => setDialog('')}>
          <div className="organization-dialog-heading"><div><p className="dashboard-eyebrow">Appointed leadership</p><h3 id="create-group-title">Create a church group</h3></div><button type="button" onClick={() => setDialog('')} aria-label="Close">×</button></div>
          <p className="organization-dialog-intro">Groups can serve a mission, life stage, project, care need, or specific community. A ministry connection is optional.</p>
          <form className="organization-dialog-form" onSubmit={createGroup}>
            <label>Group name<input ref={firstDialogButtonRef} value={createGroupForm.name} onChange={(event) => setCreateGroupForm((current) => ({ ...current, name: event.target.value }))} placeholder="Example: New Believers Path" maxLength={80} required /></label>
            <label>Purpose or mission<textarea value={createGroupForm.purpose} onChange={(event) => setCreateGroupForm((current) => ({ ...current, purpose: event.target.value }))} placeholder="What is this group created to accomplish?" rows="3" maxLength={260} required /></label>
            <label>Intended members<input value={createGroupForm.intendedMembers} onChange={(event) => setCreateGroupForm((current) => ({ ...current, intendedMembers: event.target.value }))} placeholder="Example: Members beginning their faith journey" maxLength={140} required /></label>
            <label>Connected ministry · Optional<select value={createGroupForm.ministryId} onChange={(event) => setCreateGroupForm((current) => ({ ...current, ministryId: event.target.value }))}><option value="">No ministry · Church-wide or cross-ministry</option>{ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}</select></label>
            <label>Appointed group leader<select value={createGroupForm.leaderId} disabled={!isOrganizationManager} onChange={(event) => setCreateGroupForm((current) => ({ ...current, leaderId: event.target.value }))}>{appointedGroupLeaders.map((leader) => <option key={leader.id} value={leader.id}>{leader.name}</option>)}</select></label>
            <div className="organization-dialog-form-grid">
              <label>Visibility<select value={createGroupForm.visibility} onChange={(event) => setCreateGroupForm((current) => ({ ...current, visibility: event.target.value }))}><option>Invitation only</option><option>Visible to church members</option><option>Private group</option></select></label>
              <label>Joining<select value={createGroupForm.approvalMode} onChange={(event) => setCreateGroupForm((current) => ({ ...current, approvalMode: event.target.value }))}><option>Leader approval</option><option>Automatic joining</option></select></label>
              <label>Member limit<input type="number" min="2" max="500" value={createGroupForm.memberLimit} onChange={(event) => setCreateGroupForm((current) => ({ ...current, memberLimit: event.target.value }))} /></label>
              <label>Duration<select value={createGroupForm.duration} onChange={(event) => setCreateGroupForm((current) => ({ ...current, duration: event.target.value }))}><option>Ongoing</option><option>4 weeks</option><option>8 weeks</option><option>12 weeks</option><option>Project based</option></select></label>
            </div>
            <div className="organization-dialog-actions"><button className="secondary-button" type="button" onClick={() => setDialog('')}>Cancel</button><button className="primary-button" type="submit" disabled={!createGroupForm.name.trim() || !createGroupForm.purpose.trim() || !createGroupForm.intendedMembers.trim()}>Create group</button></div>
          </form>
        </DialogShell>
      ) : null}

      {dialog === 'assign-role' ? (
        <DialogShell titleId="assign-role-title" onClose={() => setDialog('')}>
          <div className="organization-dialog-heading"><div><p className="dashboard-eyebrow">Scoped authority</p><h3 id="assign-role-title">Assign a leadership role</h3></div><button type="button" onClick={() => setDialog('')} aria-label="Close">×</button></div>
          <p className="organization-dialog-intro">Ministry Leaders manage one official ministry. Group Leaders are appointed church-wide and may create purpose-driven groups without receiving access to private reflections.</p>
          <form className="organization-dialog-form" onSubmit={assignRole}>
            <label>Member<select ref={firstDialogButtonRef} value={roleForm.memberId} onChange={(event) => setRoleForm((current) => ({ ...current, memberId: event.target.value }))}>{members.filter((member) => member.id !== 'current-member').map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
            <label>Role<select value={roleForm.role} onChange={(event) => setRoleForm((current) => ({ ...current, role: event.target.value }))}><option>Ministry Leader</option><option>Group Leader</option></select></label>
            {roleForm.role === 'Ministry Leader' ? <label>Ministry scope<select value={roleForm.scopeId} onChange={(event) => setRoleForm((current) => ({ ...current, scopeId: event.target.value }))}>{ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}</select></label> : <div className="organization-role-explanation"><strong>Church-wide group permission</strong><p>This person may create and lead groups for different missions and people. They do not receive organization-admin or ministry-manager authority.</p></div>}
            <div className="organization-dialog-actions"><button className="secondary-button" type="button" onClick={() => setDialog('')}>Cancel</button><button className="primary-button" type="submit">Assign role</button></div>
          </form>
        </DialogShell>
      ) : null}
    </section>
  );
}
