import { useEffect, useMemo, useRef, useState } from 'react';
import {
  D_GROUP_MEMBER_LIMIT,
  generatePrototypeCode,
  saveOrganizationPrototypeState,
} from '../services/organizationPrototypeService.js';
import './DGroupNetworkPanel.css';

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function createSlug(value) {
  return String(value || 'dgroup')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'dgroup';
}

function DGroupDialog({ titleId, children, onClose }) {
  return (
    <div className="dgroup-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dgroup-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        {children}
      </section>
    </div>
  );
}

export default function DGroupNetworkPanel({ organization, workspace, profile, onOpenGroup }) {
  const [localWorkspace, setLocalWorkspace] = useState(workspace);
  const [statusMessage, setStatusMessage] = useState('');
  const [dialog, setDialog] = useState({ type: '', groupId: '', memberId: '', code: '', error: '' });
  const firstInputRef = useRef(null);

  useEffect(() => {
    setLocalWorkspace(workspace);
  }, [workspace]);

  useEffect(() => {
    if (!dialog.type) return undefined;
    const frame = window.requestAnimationFrame(() => firstInputRef.current?.focus());

    function handleEscape(event) {
      if (event.key === 'Escape') setDialog({ type: '', groupId: '', memberId: '', code: '', error: '' });
    }

    document.addEventListener('keydown', handleEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [dialog.type]);

  const network = localWorkspace?.dGroupNetwork || {
    id: 'mighty-network',
    name: 'Mighty Network',
    primaryLeaderId: 'current-member',
    primaryGroupId: '',
    maxDirectMembers: D_GROUP_MEMBER_LIMIT,
  };
  const allMembers = localWorkspace?.members || [];
  const currentMember = localWorkspace?.currentMember || {};
  const currentMemberName = profile?.displayName || 'Current member';
  const currentRole = currentMember.organizationRole || 'Church Member';
  const isOrganizationManager = ['Organization Owner', 'Organization Admin'].includes(currentRole);
  const dGroups = (localWorkspace?.groups || []).filter((group) => group.groupType === 'dgroup');
  const leadRequests = localWorkspace?.dGroupLeadRequests || [];
  const joinedIds = new Set([
    ...(currentMember.groupIds || []),
    currentMember.assignedDGroupId,
    currentMember.ledDGroupId,
  ].filter(Boolean));

  const assignedGroup = dGroups.find((group) => group.id === currentMember.assignedDGroupId) || null;
  const ledGroup = dGroups.find((group) => group.id === currentMember.ledDGroupId) || null;
  const pendingCurrentRequest = leadRequests.find((request) => (
    request.memberId === 'current-member' && request.status === 'pending'
  ));

  const groupDepth = useMemo(() => {
    const map = new Map();
    const byId = new Map(dGroups.map((group) => [group.id, group]));

    function depth(group) {
      if (!group?.parentGroupId) return 0;
      if (map.has(group.id)) return map.get(group.id);
      const parent = byId.get(group.parentGroupId);
      const nextDepth = parent ? Math.min(6, depth(parent) + 1) : 0;
      map.set(group.id, nextDepth);
      return nextDepth;
    }

    dGroups.forEach((group) => map.set(group.id, depth(group)));
    return map;
  }, [dGroups]);

  const orderedGroups = useMemo(() => {
    const childrenByParent = new Map();
    dGroups.forEach((group) => {
      const parentId = group.parentGroupId || 'root';
      const collection = childrenByParent.get(parentId) || [];
      collection.push(group);
      childrenByParent.set(parentId, collection);
    });

    const ordered = [];
    function visit(parentId) {
      (childrenByParent.get(parentId) || []).forEach((group) => {
        ordered.push(group);
        visit(group.id);
      });
    }
    visit('root');
    dGroups.filter((group) => !ordered.some((item) => item.id === group.id)).forEach((group) => ordered.push(group));
    return ordered;
  }, [dGroups]);

  const assignedMemberIds = new Set(dGroups.flatMap((group) => group.memberIds || []));
  const unassignedMembers = allMembers.filter((member) => !member.assignedDGroupId && !assignedMemberIds.has(member.id));
  const totalAssignedMembers = assignedMemberIds.size;
  const selectedGroup = dGroups.find((group) => group.id === dialog.groupId) || null;

  function memberName(memberId) {
    if (memberId === 'current-member') return currentMemberName;
    return allMembers.find((member) => member.id === memberId)?.name || 'Unassigned member';
  }

  function persist(updater, message) {
    const current = clone(localWorkspace);
    const next = typeof updater === 'function' ? updater(current) : updater;
    const result = saveOrganizationPrototypeState(organization.id, next);
    setLocalWorkspace(next);
    setStatusMessage(result.ok ? message : result.error?.message || 'This D-Group change could not be saved.');
    return result.ok;
  }

  function requestToLead() {
    if (!assignedGroup || ledGroup || pendingCurrentRequest) return;

    persist((current) => ({
      ...current,
      dGroupLeadRequests: [
        ...(current.dGroupLeadRequests || []),
        {
          id: `dgroup-request-current-${Date.now().toString(36)}`,
          memberId: 'current-member',
          parentGroupId: assignedGroup.id,
          requestedAt: new Date().toISOString(),
          status: 'pending',
        },
      ],
    }), `Your request to lead a child D-Group was sent to ${memberName(assignedGroup.leaderId)}.`);
  }

  function approveLeadRequest(request) {
    const parentGroup = dGroups.find((group) => group.id === request.parentGroupId);
    if (!parentGroup) return;
    const canApprove = isOrganizationManager || parentGroup.leaderId === 'current-member';
    if (!canApprove) return;

    const leader = allMembers.find((member) => member.id === request.memberId);
    if (!leader || leader.ledDGroupId || dGroups.some((group) => group.leaderId === leader.id)) {
      setStatusMessage('This member already leads a D-Group.');
      return;
    }

    const groupId = `dgroup-${createSlug(leader.name)}-${Date.now().toString(36)}`;
    const groupName = `${leader.name}'s D-Group`;
    const newGroup = {
      id: groupId,
      groupType: 'dgroup',
      networkId: network.id,
      parentGroupId: parentGroup.id,
      parentLeaderId: parentGroup.leaderId,
      name: groupName,
      code: generatePrototypeCode(`${leader.name} DG`),
      purpose: `A child D-Group growing under ${parentGroup.name} while ${leader.name} remains accountable to their own D-Group leader.`,
      intendedMembers: `Up to ${D_GROUP_MEMBER_LIMIT} direct disciples assigned to ${leader.name}`,
      leaderId: leader.id,
      memberIds: [],
      memberCount: 0,
      memberLimit: D_GROUP_MEMBER_LIMIT,
      visibility: 'Assigned members only',
      approvalRequired: true,
      duration: 'Ongoing',
    };

    persist((current) => ({
      ...current,
      groups: [...(current.groups || []), newGroup],
      members: (current.members || []).map((member) => {
        if (member.id !== leader.id) return member;
        const roles = [...(member.roles || [])];
        if (!roles.some((role) => role.role === 'D-Group Leader' && role.scopeId === groupId)) {
          roles.push({ role: 'D-Group Leader', scopeType: 'dgroup', scopeId: groupId, scopeName: groupName });
        }
        return { ...member, ledDGroupId: groupId, roles };
      }),
      dGroupLeadRequests: (current.dGroupLeadRequests || []).map((item) => (
        item.id === request.id
          ? { ...item, status: 'approved', approvedAt: new Date().toISOString(), approvedBy: 'current-member' }
          : item
      )),
    }), `${leader.name} was approved to lead ${groupName} under ${parentGroup.name}.`);
  }

  function declineLeadRequest(request) {
    const parentGroup = dGroups.find((group) => group.id === request.parentGroupId);
    if (!parentGroup || (!isOrganizationManager && parentGroup.leaderId !== 'current-member')) return;

    persist((current) => ({
      ...current,
      dGroupLeadRequests: (current.dGroupLeadRequests || []).map((item) => (
        item.id === request.id
          ? { ...item, status: 'declined', reviewedAt: new Date().toISOString(), reviewedBy: 'current-member' }
          : item
      )),
    }), `${memberName(request.memberId)}'s leadership request was declined.`);
  }

  function assignMember(event) {
    event.preventDefault();
    const group = selectedGroup;
    const member = allMembers.find((item) => item.id === dialog.memberId);
    if (!group || !member) return;

    const canManage = isOrganizationManager || group.leaderId === 'current-member';
    if (!canManage) return;
    if ((group.memberIds || []).length >= D_GROUP_MEMBER_LIMIT) {
      setDialog((current) => ({ ...current, error: 'This D-Group already has 12 direct members. Assign the member to another leader.' }));
      return;
    }
    if (member.assignedDGroupId || assignedMemberIds.has(member.id)) {
      setDialog((current) => ({ ...current, error: 'This member already has an assigned D-Group. A transfer is required instead.' }));
      return;
    }

    persist((current) => ({
      ...current,
      groups: (current.groups || []).map((item) => {
        if (item.id !== group.id) return item;
        const memberIds = [...new Set([...(item.memberIds || []), member.id])].slice(0, D_GROUP_MEMBER_LIMIT);
        return { ...item, memberIds, memberCount: memberIds.length, memberLimit: D_GROUP_MEMBER_LIMIT };
      }),
      members: (current.members || []).map((item) => (
        item.id === member.id ? { ...item, assignedDGroupId: group.id } : item
      )),
    }), `${member.name} is now assigned to ${group.name}.`);
    setDialog({ type: '', groupId: '', memberId: '', code: '', error: '' });
  }

  function enterDGroupCode(event) {
    event.preventDefault();
    const group = dGroups.find((item) => normalizeCode(item.code) === normalizeCode(dialog.code));
    if (!group) {
      setDialog((current) => ({ ...current, error: 'No D-Group was found using that assignment code.' }));
      return;
    }
    if (currentMember.assignedDGroupId) {
      setDialog((current) => ({ ...current, error: 'You already have one assigned D-Group. Your leader must transfer you instead.' }));
      return;
    }
    if (network.primaryLeaderId === 'current-member' && currentMember.ledDGroupId === network.primaryGroupId) {
      setDialog((current) => ({ ...current, error: 'The primary network leader cannot be assigned underneath another D-Group.' }));
      return;
    }
    if ((group.memberIds || []).length >= D_GROUP_MEMBER_LIMIT) {
      setDialog((current) => ({ ...current, error: 'This D-Group already has 12 direct members. Ask the network leader for another assignment.' }));
      return;
    }

    persist((current) => ({
      ...current,
      currentMember: {
        ...current.currentMember,
        assignedDGroupId: group.id,
        groupIds: [...new Set([...(current.currentMember.groupIds || []), group.id])],
      },
      groups: (current.groups || []).map((item) => {
        if (item.id !== group.id) return item;
        const memberIds = [...new Set([...(item.memberIds || []), 'current-member'])].slice(0, D_GROUP_MEMBER_LIMIT);
        return { ...item, memberIds, memberCount: memberIds.length, memberLimit: D_GROUP_MEMBER_LIMIT };
      }),
    }), `You are now assigned to ${group.name}.`);
    setDialog({ type: '', groupId: '', memberId: '', code: '', error: '' });
  }

  function rotateCode(groupId) {
    persist((current) => ({
      ...current,
      groups: (current.groups || []).map((group) => (
        group.id === groupId ? { ...group, code: generatePrototypeCode(group.name) } : group
      )),
    }), 'A new D-Group assignment code was created. Existing members remain assigned.');
  }

  async function copyCode(code) {
    try {
      await navigator.clipboard.writeText(code);
      setStatusMessage(`Code ${code} copied.`);
    } catch (error) {
      console.warn('D-Group code copy failed.', error);
      setStatusMessage(`Current code: ${code}`);
    }
  }

  return (
    <section className="dgroup-network-panel" aria-labelledby="dgroup-network-title">
      <header className="dgroup-network-hero">
        <p className="dashboard-eyebrow">Assigned discipleship network</p>
        <h2 id="dgroup-network-title">{network.name}</h2>
        <p>{network.description}</p>
        <div className="dgroup-network-rule">
          <strong>One assigned D-Group per member.</strong>
          <span>Every leader directly cares for no more than {D_GROUP_MEMBER_LIMIT} people.</span>
        </div>
      </header>

      <div className="dgroup-network-summary-grid">
        <article><strong>{dGroups.length}</strong><span>D-Groups in the network</span></article>
        <article><strong>{totalAssignedMembers}</strong><span>assigned members</span></article>
        <article><strong>{D_GROUP_MEMBER_LIMIT}</strong><span>maximum direct members</span></article>
      </div>

      <section className="dgroup-my-place">
        <div>
          <p className="dashboard-eyebrow">Your place in the network</p>
          <h3>{ledGroup ? `You lead ${ledGroup.name}` : assignedGroup ? assignedGroup.name : 'No D-Group assignment yet'}</h3>
          <p>{ledGroup && assignedGroup
            ? `You remain a member of ${assignedGroup.name} while leading your own child D-Group.`
            : ledGroup
              ? 'You are the primary network leader. Your direct D-Group is still limited to twelve members.'
              : assignedGroup
                ? `Your D-Group leader is ${memberName(assignedGroup.leaderId)}.`
                : 'Enter the assignment code provided by an approved D-Group leader.'}</p>
        </div>
        <div className="dgroup-my-place-actions">
          {!assignedGroup && !ledGroup ? (
            <button type="button" onClick={() => setDialog({ type: 'join', groupId: '', memberId: '', code: '', error: '' })}>Enter D-Group code</button>
          ) : null}
          {assignedGroup && !ledGroup && !pendingCurrentRequest ? (
            <button type="button" onClick={requestToLead}>Request to lead a D-Group</button>
          ) : null}
          {pendingCurrentRequest ? <span>Leadership request pending</span> : null}
        </div>
      </section>

      {statusMessage ? <p className="dgroup-status" role="status">{statusMessage}</p> : null}

      <div className="dgroup-network-heading">
        <div>
          <p className="dashboard-eyebrow">Network structure</p>
          <h3>One spiritual family, growing through approved leaders.</h3>
        </div>
      </div>

      <div className="dgroup-tree">
        {orderedGroups.map((group) => {
          const directMembers = group.memberIds || [];
          const isFull = directMembers.length >= D_GROUP_MEMBER_LIMIT;
          const canManage = isOrganizationManager || group.leaderId === 'current-member';
          const canOpen = joinedIds.has(group.id);
          const parent = dGroups.find((item) => item.id === group.parentGroupId);
          const childCount = dGroups.filter((item) => item.parentGroupId === group.id).length;
          const pendingRequests = leadRequests.filter((request) => request.parentGroupId === group.id && request.status === 'pending');
          const depth = groupDepth.get(group.id) || 0;

          return (
            <article className="dgroup-card" key={group.id} style={{ '--dgroup-depth': depth }}>
              <div className="dgroup-card-lineage">
                <span>{parent ? `Under ${parent.name}` : 'Primary D-Group'}</span>
                <b>{directMembers.length} / {D_GROUP_MEMBER_LIMIT}</b>
              </div>
              <h4>{group.name}</h4>
              <p>{group.purpose}</p>

              <dl>
                <div><dt>D-Group leader</dt><dd>{memberName(group.leaderId)}</dd></div>
                <div><dt>Direct members</dt><dd>{directMembers.length} of {D_GROUP_MEMBER_LIMIT}</dd></div>
                <div><dt>Child D-Groups</dt><dd>{childCount}</dd></div>
                <div><dt>Status</dt><dd>{isFull ? 'Full · 12 direct members' : `${D_GROUP_MEMBER_LIMIT - directMembers.length} spaces available`}</dd></div>
              </dl>

              <div className="dgroup-card-actions">
                {canOpen ? <button type="button" onClick={() => onOpenGroup?.(group.id)}>Open D-Group</button> : null}
                {canManage && !isFull && unassignedMembers.length ? (
                  <button type="button" onClick={() => setDialog({ type: 'assign', groupId: group.id, memberId: unassignedMembers[0]?.id || '', code: '', error: '' })}>Assign member</button>
                ) : null}
              </div>

              {canManage ? (
                <div className="dgroup-code-controls">
                  <div><span>Assignment code</span><code>{group.code}</code></div>
                  <button type="button" onClick={() => copyCode(group.code)}>Copy</button>
                  <button type="button" onClick={() => rotateCode(group.id)}>Rotate</button>
                </div>
              ) : null}

              {canManage && pendingRequests.length ? (
                <section className="dgroup-lead-requests">
                  <p className="dashboard-eyebrow">Leadership requests</p>
                  {pendingRequests.map((request) => (
                    <article key={request.id}>
                      <div><strong>{memberName(request.memberId)}</strong><small>Wants to lead a child D-Group without leaving this D-Group.</small></div>
                      <div><button type="button" onClick={() => declineLeadRequest(request)}>Decline</button><button type="button" onClick={() => approveLeadRequest(request)}>Approve</button></div>
                    </article>
                  ))}
                </section>
              ) : null}
            </article>
          );
        })}
      </div>

      <aside className="dgroup-privacy-note">
        <strong>Leaders see shared rhythm signals, not private devotion content.</strong>
        <p>WGAP answers, prayers, journals, notebook photos, personal notes, and exact Scripture reflections remain private.</p>
      </aside>

      {dialog.type === 'join' ? (
        <DGroupDialog titleId="dgroup-join-title" onClose={() => setDialog({ type: '', groupId: '', memberId: '', code: '', error: '' })}>
          <div className="dgroup-dialog-heading"><div><p className="dashboard-eyebrow">D-Group assignment</p><h3 id="dgroup-join-title">Enter your D-Group code</h3></div><button type="button" onClick={() => setDialog({ type: '', groupId: '', memberId: '', code: '', error: '' })} aria-label="Close">×</button></div>
          <p>The code assigns you to one D-Group inside {network.name}. You cannot belong to two parent D-Groups at the same time.</p>
          <form onSubmit={enterDGroupCode}>
            <label>D-Group code<input ref={firstInputRef} value={dialog.code} onChange={(event) => setDialog((current) => ({ ...current, code: normalizeCode(event.target.value), error: '' }))} placeholder="Enter D-Group code" autoCapitalize="characters" autoComplete="off" required /></label>
            {dialog.error ? <p className="dgroup-dialog-error" role="alert">{dialog.error}</p> : null}
            <div className="dgroup-dialog-actions"><button type="button" onClick={() => setDialog({ type: '', groupId: '', memberId: '', code: '', error: '' })}>Cancel</button><button type="submit" disabled={!dialog.code}>Assign me</button></div>
          </form>
        </DGroupDialog>
      ) : null}

      {dialog.type === 'assign' && selectedGroup ? (
        <DGroupDialog titleId="dgroup-assign-title" onClose={() => setDialog({ type: '', groupId: '', memberId: '', code: '', error: '' })}>
          <div className="dgroup-dialog-heading"><div><p className="dashboard-eyebrow">Direct member assignment</p><h3 id="dgroup-assign-title">Assign to {selectedGroup.name}</h3></div><button type="button" onClick={() => setDialog({ type: '', groupId: '', memberId: '', code: '', error: '' })} aria-label="Close">×</button></div>
          <p>This leader currently has {(selectedGroup.memberIds || []).length} of {D_GROUP_MEMBER_LIMIT} direct members. A member already assigned elsewhere cannot be added without a transfer.</p>
          <form onSubmit={assignMember}>
            <label>Unassigned member<select ref={firstInputRef} value={dialog.memberId} onChange={(event) => setDialog((current) => ({ ...current, memberId: event.target.value, error: '' }))}>{unassignedMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
            {dialog.error ? <p className="dgroup-dialog-error" role="alert">{dialog.error}</p> : null}
            <div className="dgroup-dialog-actions"><button type="button" onClick={() => setDialog({ type: '', groupId: '', memberId: '', code: '', error: '' })}>Cancel</button><button type="submit" disabled={!dialog.memberId}>Assign member</button></div>
          </form>
        </DGroupDialog>
      ) : null}
    </section>
  );
}
