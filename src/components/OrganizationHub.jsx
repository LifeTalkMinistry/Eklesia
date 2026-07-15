import { useEffect, useMemo, useRef, useState } from 'react';
import {
  generatePrototypeCode,
  getOrganizationPrototypeState,
  saveOrganizationPrototypeState,
} from '../services/organizationPrototypeService.js';
import './OrganizationHub.css';

const SECTIONS = [
  ['pulse', 'Pulse'],
  ['ministries', 'Ministries'],
  ['circles', 'Circles'],
  ['people', 'People'],
  ['privacy', 'Privacy'],
];

const PROFILE_SCOPES = [
  ['private', 'Only me', 'Your profile is hidden from the church directory.'],
  ['circles', 'My circles', 'Only members of your accountability circles can see your basic profile.'],
  ['ministries', 'My ministries', 'Members of ministries you belong to can see your basic profile.'],
  ['church', 'Whole church', 'Members of this church organization can see your basic profile.'],
];

const RHYTHM_SCOPES = [
  ['private', 'Private', 'Only you can see your personal rhythm signals.'],
  ['circles', 'Selected circles', 'Only selected accountability circles can see general rhythm signals.'],
  ['ministries', 'My ministries', 'Your ministries can see general rhythm signals.'],
  ['church', 'Whole church', 'The church can see your general rhythm status.'],
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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
  const [createCircleForm, setCreateCircleForm] = useState({ name: '', ministryId: 'music', leaderId: 'current-member' });
  const [roleForm, setRoleForm] = useState({ memberId: 'member-maria', role: 'Ministry Leader', scopeType: 'ministry', scopeId: 'youth' });
  const firstDialogButtonRef = useRef(null);

  const currentMemberName = profile?.displayName || 'Current member';
  const currentRole = workspace.currentMember?.organizationRole || 'Church Member';
  const isOrganizationManager = ['Organization Owner', 'Organization Admin'].includes(currentRole);
  const canManageMinistry = (ministryId) => isOrganizationManager || (workspace.currentMember?.roles || []).some((role) => role.role === 'Ministry Leader' && role.scopeId === ministryId);
  const canCreateAnyCircle = isOrganizationManager || (workspace.currentMember?.roles || []).some((role) => role.role === 'Ministry Leader');
  const ministries = workspace.ministries || [];
  const members = workspace.members || [];
  const circles = useMemo(
    () => ministries.flatMap((ministry) => (ministry.circles || []).map((circle) => ({ ...circle, ministryId: ministry.id, ministryName: ministry.name }))),
    [ministries],
  );

  function memberName(memberId) {
    if (memberId === 'current-member') return currentMemberName;
    return members.find((member) => member.id === memberId)?.name || 'Unassigned';
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

  function rotateCircleCode(circleId) {
    persist((current) => ({
      ...current,
      ministries: current.ministries.map((ministry) => ({
        ...ministry,
        circles: (ministry.circles || []).map((circle) => circle.id === circleId ? { ...circle, code: generatePrototypeCode(circle.name) } : circle),
      })),
    }), 'The circle code was rotated for this prototype. Existing members remain connected.');
  }

  function openCreateCircle(ministryId = ministries[0]?.id || '') {
    setCreateCircleForm({ name: '', ministryId, leaderId: 'current-member' });
    setDialog('create-circle');
    window.requestAnimationFrame(() => firstDialogButtonRef.current?.focus());
  }

  function createCircle(event) {
    event.preventDefault();
    const name = createCircleForm.name.trim();
    if (!name || !createCircleForm.ministryId) return;

    const newCircle = {
      id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'circle'}-${Date.now().toString(36)}`,
      name,
      code: generatePrototypeCode(name),
      memberCount: 1,
      leaderId: createCircleForm.leaderId || 'current-member',
      visibility: 'Circle members',
      approvalRequired: true,
    };

    persist((current) => ({
      ...current,
      ministries: current.ministries.map((ministry) => ministry.id === createCircleForm.ministryId
        ? { ...ministry, circles: [...(ministry.circles || []), newCircle] }
        : ministry),
    }), `${name} was created as a local prototype circle.`);
    setDialog('');
  }

  function openRoleDialog(memberId = members[0]?.id || 'member-maria', scopeType = 'ministry', scopeId = ministries[0]?.id || '') {
    setRoleForm({ memberId, role: scopeType === 'circle' ? 'Circle Leader' : 'Ministry Leader', scopeType, scopeId });
    setDialog('assign-role');
    window.requestAnimationFrame(() => firstDialogButtonRef.current?.focus());
  }

  function assignRole(event) {
    event.preventDefault();
    const scopeCollection = roleForm.scopeType === 'circle' ? circles : ministries;
    const scope = scopeCollection.find((item) => item.id === roleForm.scopeId);
    if (!roleForm.memberId || !roleForm.role || !scope) return;

    persist((current) => ({
      ...current,
      members: current.members.map((member) => {
        if (member.id !== roleForm.memberId) return member;
        const roles = Array.isArray(member.roles) ? member.roles : [];
        const nextRole = {
          role: roleForm.role,
          scopeType: roleForm.scopeType,
          scopeId: roleForm.scopeId,
          scopeName: scope.name,
        };
        const duplicate = roles.some((item) => item.role === nextRole.role && item.scopeId === nextRole.scopeId);
        return duplicate ? member : { ...member, roles: [...roles, nextRole] };
      }),
    }), `${memberName(roleForm.memberId)} was assigned as ${roleForm.role} for ${scope.name}.`);
    setDialog('');
  }

  function updateVisibility(field, value) {
    persist((current) => ({
      ...current,
      memberVisibility: { ...current.memberVisibility, [field]: value },
    }), 'Your prototype visibility preference was updated.');
  }

  function toggleSelectedCircle(circleId) {
    persist((current) => {
      const selected = new Set(current.memberVisibility.selectedCircleIds || []);
      if (selected.has(circleId)) selected.delete(circleId); else selected.add(circleId);
      return { ...current, memberVisibility: { ...current.memberVisibility, selectedCircleIds: [...selected] } };
    }, 'Your selected accountability circles were updated.');
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
          <p>New members use this code to request entry into the whole church organization. It is not a password.</p>
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
            <div><p className="dashboard-eyebrow">Scoped leadership</p><h3>Ministries inside the church</h3><p>Leaders receive authority only inside the ministry assigned to them.</p></div>
          </div>
          <div className="organization-ministry-grid">
            {ministries.map((ministry) => {
              const expanded = expandedMinistryId === ministry.id;
              const ministryLeaders = members.flatMap((member) => (member.roles || []).filter((role) => role.role === 'Ministry Leader' && role.scopeId === ministry.id).map(() => memberName(member.id)));
              if (workspace.currentMember?.roles?.some((role) => role.role === 'Ministry Leader' && role.scopeId === ministry.id)) ministryLeaders.unshift(currentMemberName);
              return (
                <article className={`organization-ministry-card ${expanded ? 'is-expanded' : ''}`} key={ministry.id}>
                  <button className="organization-ministry-summary" type="button" onClick={() => setExpandedMinistryId(expanded ? '' : ministry.id)} aria-expanded={expanded}>
                    <span className="organization-ministry-icon" aria-hidden="true">{ministry.icon}</span>
                    <span><strong>{ministry.name}</strong><small>{ministry.memberCount} members · {ministry.circles.length} circle{ministry.circles.length === 1 ? '' : 's'}</small></span>
                    <b aria-hidden="true">{expanded ? '−' : '+'}</b>
                  </button>
                  {expanded ? (
                    <div className="organization-ministry-details">
                      <p><b>Ministry leaders:</b> {ministryLeaders.length ? [...new Set(ministryLeaders)].join(', ') : 'Not assigned'}</p>
                      <div className="organization-mini-circles">
                        {ministry.circles.map((circle) => <span key={circle.id}>{circle.name} · {circle.memberCount} members</span>)}
                      </div>
                      {canManageMinistry(ministry.id) ? (
                        <div className="organization-inline-actions">
                          {isOrganizationManager ? <button type="button" onClick={() => openRoleDialog('member-maria', 'ministry', ministry.id)}>Assign ministry leader</button> : null}
                          <button type="button" onClick={() => openCreateCircle(ministry.id)}>Create circle</button>
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

      {section === 'circles' ? (
        <div className="organization-section-stack">
          <div className="organization-section-heading organization-page-heading">
            <div><p className="dashboard-eyebrow">Accountability circles</p><h3>Smaller spaces for shared rhythm</h3><p>Circle codes work only for members who already belong to this church organization.</p></div>
            {canCreateAnyCircle ? <button className="organization-primary-small" type="button" onClick={() => openCreateCircle()}>Create circle</button> : null}
          </div>
          <div className="organization-circle-grid">
            {circles.map((circle) => (
              <article className="organization-circle-card" key={circle.id}>
                <span className="organization-circle-ministry">{circle.ministryName}</span>
                <h4>{circle.name}</h4>
                <p>{circle.memberCount} members · Led by {memberName(circle.leaderId)}</p>
                <dl>
                  <div><dt>Visibility</dt><dd>{circle.visibility}</dd></div>
                  <div><dt>Join approval</dt><dd>{circle.approvalRequired ? 'Required' : 'Automatic'}</dd></div>
                </dl>
                <div className="organization-circle-code"><code>{circle.code}</code><button type="button" onClick={() => copyCode(circle.code)}>Copy</button></div>
                <button className="organization-text-action" type="button" onClick={() => rotateCircleCode(circle.id)}>Rotate circle code</button>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {section === 'people' ? (
        <div className="organization-section-stack">
          <div className="organization-section-heading organization-page-heading">
            <div><p className="dashboard-eyebrow">Roles and scope</p><h3>People do not all need the same authority.</h3><p>Billing ownership, administration, ministry leadership, and spiritual-care visibility remain separate.</p></div>
          </div>
          <section className="organization-owner-card">
            <span className="organization-avatar" aria-hidden="true">{organization.ownerName.charAt(0)}</span>
            <div><strong>{organization.ownerName}</strong><small>Organization Owner · Billing and ownership</small></div>
            <span className="organization-role-chip">Owner</span>
          </section>
          <div className="organization-people-list">
            <article>
              <span className="organization-avatar" aria-hidden="true">{currentMemberName.charAt(0)}</span>
              <div><strong>{currentMemberName}</strong><small>{currentRole}</small><div className="organization-role-list">{(workspace.currentMember.roles || []).map((role) => <span key={`${role.role}-${role.scopeId}`}>{role.role} · {role.scopeName}</span>)}</div></div>
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
            <strong>Authority is scoped.</strong>
            <p>A Music Ministry Leader can manage Music Ministry circles without gaining access to Youth Ministry or private devotional content.</p>
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
                  || (value === 'circles' && !workspace.policies.circleRhythm);
                return <ScopeChoice key={value} name="rhythm-scope" value={value} current={workspace.memberVisibility.rhythmScope} title={title} description={description} disabled={disabled} onChange={(next) => updateVisibility('rhythmScope', next)} />;
              })}
            </div>
            {workspace.memberVisibility.rhythmScope === 'circles' ? (
              <div className="organization-circle-selection">
                <strong>Selected circles</strong>
                {circles.map((circle) => (
                  <label key={circle.id}><input type="checkbox" checked={(workspace.memberVisibility.selectedCircleIds || []).includes(circle.id)} onChange={() => toggleSelectedCircle(circle.id)} /> <span>{circle.name}</span></label>
                ))}
              </div>
            ) : null}
          </section>

          <section className="organization-private-content-card">
            <span aria-hidden="true">🔒</span>
            <div><p className="dashboard-eyebrow">Always private by default</p><h3>The details of your heart are not organization data.</h3><p>WGAP responses, prayers, journals, notebook photos, personal notes, and exact devotional passages are not automatically visible to leaders or members.</p></div>
          </section>

          {isOrganizationManager ? (
            <section className="organization-panel-card">
              <p className="dashboard-eyebrow">Organization policy · Prototype admin</p>
              <h3>Choose which sharing options members may voluntarily use.</h3>
              <div className="organization-policy-list">
                <PolicySwitch checked={workspace.policies.circleRhythm} label="Circle rhythm sharing" description="Members may share general signals with selected accountability circles." onChange={(checked) => updatePolicy('circleRhythm', checked)} />
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

      {dialog === 'create-circle' ? (
        <DialogShell titleId="create-circle-title" onClose={() => setDialog('')}>
          <div className="organization-dialog-heading"><div><p className="dashboard-eyebrow">New accountability space</p><h3 id="create-circle-title">Create a circle</h3></div><button type="button" onClick={() => setDialog('')} aria-label="Close">×</button></div>
          <p className="organization-dialog-intro">The circle will remain inside the selected ministry and can be joined only by church members.</p>
          <form className="organization-dialog-form" onSubmit={createCircle}>
            <label>Circle name<input ref={firstDialogButtonRef} value={createCircleForm.name} onChange={(event) => setCreateCircleForm((current) => ({ ...current, name: event.target.value }))} placeholder="Example: Music Team Daily Rhythm" maxLength={80} required /></label>
            <label>Ministry<select value={createCircleForm.ministryId} onChange={(event) => setCreateCircleForm((current) => ({ ...current, ministryId: event.target.value }))}>{ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}</select></label>
            <label>Circle leader<select value={createCircleForm.leaderId} onChange={(event) => setCreateCircleForm((current) => ({ ...current, leaderId: event.target.value }))}><option value="current-member">{currentMemberName}</option>{members.filter((member) => member.id !== 'current-member').map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
            <div className="organization-dialog-actions"><button className="secondary-button" type="button" onClick={() => setDialog('')}>Cancel</button><button className="primary-button" type="submit" disabled={!createCircleForm.name.trim()}>Create circle</button></div>
          </form>
        </DialogShell>
      ) : null}

      {dialog === 'assign-role' ? (
        <DialogShell titleId="assign-role-title" onClose={() => setDialog('')}>
          <div className="organization-dialog-heading"><div><p className="dashboard-eyebrow">Scoped authority</p><h3 id="assign-role-title">Assign a leadership role</h3></div><button type="button" onClick={() => setDialog('')} aria-label="Close">×</button></div>
          <p className="organization-dialog-intro">This prototype assignment grants authority only inside the selected scope. It does not reveal private reflections.</p>
          <form className="organization-dialog-form" onSubmit={assignRole}>
            <label>Member<select ref={firstDialogButtonRef} value={roleForm.memberId} onChange={(event) => setRoleForm((current) => ({ ...current, memberId: event.target.value }))}>{members.filter((member) => member.id !== 'current-member').map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
            <label>Role<select value={roleForm.role} onChange={(event) => setRoleForm((current) => ({ ...current, role: event.target.value, scopeType: event.target.value === 'Circle Leader' ? 'circle' : 'ministry', scopeId: event.target.value === 'Circle Leader' ? circles[0]?.id || '' : ministries[0]?.id || '' }))}><option>Ministry Leader</option><option>Circle Leader</option></select></label>
            <label>Scope<select value={roleForm.scopeId} onChange={(event) => setRoleForm((current) => ({ ...current, scopeId: event.target.value }))}>{(roleForm.scopeType === 'circle' ? circles : ministries).map((scope) => <option key={scope.id} value={scope.id}>{scope.name}</option>)}</select></label>
            <div className="organization-dialog-actions"><button className="secondary-button" type="button" onClick={() => setDialog('')}>Cancel</button><button className="primary-button" type="submit">Assign role</button></div>
          </form>
        </DialogShell>
      ) : null}
    </section>
  );
}
