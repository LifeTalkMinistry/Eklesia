import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DGroupNetworkPanel from './DGroupNetworkPanel.jsx';
import OrganizationHub from './OrganizationHub.jsx';
import { saveOrganizationPrototypeState } from '../services/organizationPrototypeService.js';
import './PulseAccessGate.css';

function getLegacyViewStorageKey(organizationId) {
  return `ekklesia-pulse-beta-view:${organizationId || 'church'}`;
}

function getAdminCodeStorageKey(organizationId) {
  return `ekklesia-church-admin-code:${organizationId || 'church'}`;
}

function getLegacyPulseCodeStorageKey(organizationId) {
  return `ekklesia-church-pulse-code:${organizationId || 'church'}`;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeSectionLabel(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeAccessCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function generateAdminAccessCode() {
  return `ADMIN${Math.floor(1000 + Math.random() * 9000)}`;
}

function restoreAdminAccessCode(organizationId) {
  if (typeof window === 'undefined') return 'ADMIN1';

  try {
    const storageKey = getAdminCodeStorageKey(organizationId);
    const stored = normalizeAccessCode(window.localStorage.getItem(storageKey));
    if (stored) return stored;

    const legacy = normalizeAccessCode(window.localStorage.getItem(getLegacyPulseCodeStorageKey(organizationId)));
    const initialCode = legacy || 'ADMIN1';
    window.localStorage.setItem(storageKey, initialCode);
    return initialCode;
  } catch (error) {
    console.warn('Ekklesia Pulse could not restore the Church Admin access code.', error);
    return 'ADMIN1';
  }
}

function CodeAccessDialog({
  eyebrow,
  title,
  description,
  label,
  placeholder,
  entry,
  error,
  submitLabel,
  onEntryChange,
  onSubmit,
  onClose,
  children,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="pulse-access-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="pulse-access-dialog" role="dialog" aria-modal="true" aria-labelledby="workspace-code-access-title">
        <div className="pulse-access-heading">
          <div>
            <p className="dashboard-eyebrow">{eyebrow}</p>
            <h2 id="workspace-code-access-title">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close access-code dialog">×</button>
        </div>
        <p className="pulse-access-copy">{description}</p>
        <form className="pulse-access-form" onSubmit={onSubmit}>
          <label htmlFor="workspace-access-code">{label}</label>
          <input
            ref={inputRef}
            id="workspace-access-code"
            value={entry}
            onChange={(event) => onEntryChange(normalizeAccessCode(event.target.value))}
            placeholder={placeholder}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck="false"
            required
          />
          {error ? <p className="pulse-access-error" role="alert">{error}</p> : null}
          <div className="pulse-access-actions">
            <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
            <button className="primary-button" type="submit" disabled={!entry}>{submitLabel}</button>
          </div>
        </form>
        {children}
      </section>
    </div>
  );
}

function MembershipLeaveDialog({ target, error, onClose, onConfirm }) {
  const stayButtonRef = useRef(null);
  const groupLabel = target.type === 'dgroup' ? 'D-Group' : 'ministry';

  useEffect(() => {
    stayButtonRef.current?.focus();
  }, []);

  return (
    <div className="pulse-access-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="pulse-access-dialog" role="dialog" aria-modal="true" aria-labelledby="membership-leave-title">
        <div className="pulse-access-heading">
          <div>
            <p className="dashboard-eyebrow">Membership</p>
            <h2 id="membership-leave-title">Leave {target.name}?</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={`Close leave ${groupLabel} dialog`}>×</button>
        </div>
        <p className="pulse-access-copy">
          Your saved membership on this device will be removed. You will need the current {groupLabel} code before joining again.
        </p>
        {error ? <p className="pulse-access-error" role="alert">{error}</p> : null}
        <div className="pulse-access-actions">
          <button ref={stayButtonRef} className="secondary-button" type="button" onClick={onClose}>Stay joined</button>
          <button className="church-workspace-danger" type="button" onClick={onConfirm}>Leave {groupLabel}</button>
        </div>
      </section>
    </div>
  );
}

export default function OrganizationHubMinistryBridge({
  workspace,
  activeSection,
  onOpenMinistry,
  onOpenGroup,
  onNavigateApp,
  organization,
  profile,
  ...props
}) {
  const hostRef = useRef(null);
  const adminUnlockedRef = useRef(false);
  const pendingAdminButtonRef = useRef(null);
  const [adminCode, setAdminCode] = useState(() => restoreAdminAccessCode(organization?.id));
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminSection, setAdminSection] = useState('people');
  const [showAdminGate, setShowAdminGate] = useState(false);
  const [adminEntry, setAdminEntry] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [membershipTarget, setMembershipTarget] = useState(null);
  const [membershipError, setMembershipError] = useState('');
  const [membershipMessage, setMembershipMessage] = useState('');

  const currentRole = workspace?.currentMember?.organizationRole || 'Church Member';
  const isOrganizationManager = ['Organization Owner', 'Organization Admin'].includes(currentRole);
  const currentRoles = workspace?.currentMember?.roles || [];
  const joinedMinistryIds = new Set(workspace?.currentMember?.ministryIds || []);
  const joinedGroupIds = new Set(workspace?.currentMember?.groupIds || []);
  const assignedDGroup = (workspace?.groups || []).find((group) => (
    group.groupType === 'dgroup'
    && group.id === workspace?.currentMember?.assignedDGroupId
  )) || null;
  const canLeaveAssignedDGroup = Boolean(
    assignedDGroup
    && !workspace?.currentMember?.ledDGroupId
    && assignedDGroup.leaderId !== 'current-member',
  );
  const hubMembershipKey = useMemo(() => [
    organization?.id || 'church',
    ...(workspace?.currentMember?.ministryIds || []),
    '|',
    ...(workspace?.currentMember?.groupIds || []),
    workspace?.currentMember?.assignedDGroupId || '',
  ].join(':'), [organization?.id, workspace]);

  useEffect(() => {
    const nextCode = restoreAdminAccessCode(organization?.id);
    setAdminCode(nextCode);
    setAdminUnlocked(false);
    adminUnlockedRef.current = false;
    setAdminSection('people');
    setShowAdminGate(false);
    setAdminEntry('');
    setAdminError('');
    setAdminMessage('');
    setMembershipTarget(null);
    setMembershipError('');
    setMembershipMessage('');

    try {
      window.localStorage.removeItem(getLegacyViewStorageKey(organization?.id));
    } catch (error) {
      console.warn('Ekklesia Pulse could not clear the retired beta-view preference.', error);
    }
  }, [organization?.id]);

  useEffect(() => {
    adminUnlockedRef.current = adminUnlocked;
  }, [adminUnlocked]);

  useEffect(() => {
    if (activeSection === 'admin') return;
    adminUnlockedRef.current = false;
    setAdminUnlocked(false);
  }, [activeSection]);

  useEffect(() => {
    if (!showAdminGate && !membershipTarget) return undefined;

    function handleEscape(event) {
      if (event.key !== 'Escape') return;
      setShowAdminGate(false);
      setAdminEntry('');
      setAdminError('');
      setAdminMessage('');
      setMembershipTarget(null);
      setMembershipError('');
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showAdminGate, membershipTarget]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const shell = host.closest('.church-workspace-shell');
    let syncFrame = 0;
    let enhancementFrame = 0;
    let enhancementTimer = 0;

    function clickOrganizationSection(section) {
      const targetButton = [...host.querySelectorAll('.organization-section-nav button')]
        .find((button) => normalizeSectionLabel(button.textContent) === section);
      if (targetButton && !targetButton.classList.contains('is-active')) targetButton.click();
    }

    function enhanceMinistryCards() {
      const ministryCards = [...host.querySelectorAll('.organization-ministry-card')];

      ministryCards.forEach((card, index) => {
        const ministry = workspace?.ministries?.[index];
        const actions = card.querySelector('.organization-inline-actions');
        if (!ministry || !actions) return;

        const joined = joinedMinistryIds.has(ministry.id) || Boolean(card.querySelector('.organization-membership-chip'));
        const existingEnter = actions.querySelector('[data-enter-ministry-room]');
        const existingLeave = actions.querySelector('[data-leave-ministry]');
        const isMinistryLeader = currentRoles.some((role) => role.role === 'Ministry Leader' && role.scopeId === ministry.id);

        if (!joined) {
          existingEnter?.remove();
          existingLeave?.remove();
          return;
        }

        const enterLabel = `Enter ${ministry.name} ministry room`;
        const enterButton = existingEnter || document.createElement('button');
        enterButton.type = 'button';
        enterButton.className = 'organization-enter-ministry-room';
        enterButton.dataset.enterMinistryRoom = ministry.id;
        enterButton.textContent = 'Enter Ministry Room';
        enterButton.setAttribute('aria-label', enterLabel);
        if (!existingEnter) actions.appendChild(enterButton);

        if (isMinistryLeader) {
          existingLeave?.remove();
          return;
        }

        const leaveButton = existingLeave || document.createElement('button');
        leaveButton.type = 'button';
        leaveButton.className = 'organization-text-action';
        leaveButton.dataset.leaveMinistry = ministry.id;
        leaveButton.textContent = 'Leave ministry';
        leaveButton.setAttribute('aria-label', `Leave ${ministry.name}`);
        if (!existingLeave) actions.appendChild(leaveButton);
      });
    }

    function enhanceDGroupControls() {
      const actions = host.querySelector('.dgroup-my-place-actions');
      const existingLeave = host.querySelector('[data-leave-dgroup]');

      if (!actions || !canLeaveAssignedDGroup || !assignedDGroup) {
        existingLeave?.remove();
        return;
      }

      const button = existingLeave || document.createElement('button');
      button.type = 'button';
      button.dataset.leaveDgroup = assignedDGroup.id;
      button.textContent = 'Leave D-Group';
      button.setAttribute('aria-label', `Leave ${assignedDGroup.name}`);
      if (!existingLeave) actions.appendChild(button);
    }

    function scheduleEnhancements() {
      window.cancelAnimationFrame(enhancementFrame);
      window.clearTimeout(enhancementTimer);
      let attempt = 0;

      function run() {
        enhancementFrame = window.requestAnimationFrame(() => {
          if (activeSection === 'ministries') enhanceMinistryCards();
          if (activeSection === 'groups') enhanceDGroupControls();
          attempt += 1;
          if (attempt < 10) enhancementTimer = window.setTimeout(run, 45);
        });
      }

      run();
    }

    function syncVisibleSection() {
      window.cancelAnimationFrame(syncFrame);
      syncFrame = window.requestAnimationFrame(() => {
        if (activeSection === 'admin' && adminUnlockedRef.current) {
          clickOrganizationSection(adminSection);
          return;
        }
        if (activeSection === 'ministries' || activeSection === 'privacy') {
          clickOrganizationSection(activeSection);
        }
        scheduleEnhancements();
      });
    }

    function handleAdminGateCapture(event) {
      const button = event.target.closest('.church-workspace-primary-nav > button');
      if (!button || !shell?.contains(button)) return;
      if (normalizeSectionLabel(button.textContent) !== 'admin' || adminUnlockedRef.current) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      pendingAdminButtonRef.current = button;
      setAdminEntry('');
      setAdminError('');
      setAdminMessage('');
      setShowAdminGate(true);
    }

    function handleHostClick(event) {
      const ministryRoomButton = event.target.closest('[data-enter-ministry-room]');
      if (ministryRoomButton && host.contains(ministryRoomButton)) {
        event.preventDefault();
        event.stopPropagation();
        const ministryId = ministryRoomButton.dataset.enterMinistryRoom;
        if (ministryId && joinedMinistryIds.has(ministryId)) onOpenMinistry?.(ministryId);
        return;
      }

      const leaveMinistryButton = event.target.closest('[data-leave-ministry]');
      if (leaveMinistryButton && host.contains(leaveMinistryButton)) {
        event.preventDefault();
        event.stopPropagation();
        const ministry = (workspace?.ministries || []).find((item) => item.id === leaveMinistryButton.dataset.leaveMinistry);
        if (ministry) {
          setMembershipError('');
          setMembershipTarget({ type: 'ministry', id: ministry.id, name: ministry.name });
        }
        return;
      }

      const leaveDGroupButton = event.target.closest('[data-leave-dgroup]');
      if (leaveDGroupButton && host.contains(leaveDGroupButton)) {
        event.preventDefault();
        event.stopPropagation();
        const group = (workspace?.groups || []).find((item) => item.id === leaveDGroupButton.dataset.leaveDgroup);
        if (group) {
          setMembershipError('');
          setMembershipTarget({ type: 'dgroup', id: group.id, name: group.name });
        }
        return;
      }

      const ministrySummary = event.target.closest('.organization-ministry-summary');
      const dGroupToggle = event.target.closest('.dgroup-section-toggle');
      if ((ministrySummary && host.contains(ministrySummary)) || (dGroupToggle && host.contains(dGroupToggle))) {
        scheduleEnhancements();
      }
    }

    shell?.addEventListener('click', handleAdminGateCapture, true);
    host.addEventListener('click', handleHostClick);
    syncVisibleSection();

    return () => {
      window.cancelAnimationFrame(syncFrame);
      window.cancelAnimationFrame(enhancementFrame);
      window.clearTimeout(enhancementTimer);
      shell?.removeEventListener('click', handleAdminGateCapture, true);
      host.removeEventListener('click', handleHostClick);
    };
  }, [workspace, activeSection, adminSection, joinedMinistryIds, currentRoles, assignedDGroup, canLeaveAssignedDGroup, onOpenMinistry]);

  function verifyAdminAccess(event) {
    event.preventDefault();
    if (normalizeAccessCode(adminEntry) !== normalizeAccessCode(adminCode)) {
      setAdminError('That code does not match the current Admin code. Ask the organization administrator for the latest code.');
      return;
    }

    adminUnlockedRef.current = true;
    setAdminUnlocked(true);
    setAdminError('');
    setShowAdminGate(false);
    const adminButton = pendingAdminButtonRef.current;
    pendingAdminButtonRef.current = null;
    window.requestAnimationFrame(() => adminButton?.click());
  }

  function confirmLeaveMembership() {
    if (!membershipTarget || !organization?.id) return;
    const next = clone(workspace);

    if (membershipTarget.type === 'ministry') {
      const isLeader = (next.currentMember?.roles || []).some((role) => (
        role.role === 'Ministry Leader' && role.scopeId === membershipTarget.id
      ));
      if (isLeader) {
        setMembershipError('A ministry leader must transfer or remove the leadership role before leaving this ministry.');
        return;
      }

      next.currentMember = {
        ...next.currentMember,
        ministryIds: (next.currentMember?.ministryIds || []).filter((id) => id !== membershipTarget.id),
      };
      next.ministries = (next.ministries || []).map((ministry) => (
        ministry.id === membershipTarget.id
          ? { ...ministry, memberCount: Math.max(0, Number(ministry.memberCount || 0) - 1) }
          : ministry
      ));
    } else {
      const group = (next.groups || []).find((item) => item.id === membershipTarget.id);
      const leadsGroup = next.currentMember?.ledDGroupId === membershipTarget.id || group?.leaderId === 'current-member';
      if (leadsGroup || next.currentMember?.ledDGroupId) {
        setMembershipError('A D-Group leader must transfer leadership before leaving their assigned discipleship relationship.');
        return;
      }

      next.currentMember = {
        ...next.currentMember,
        assignedDGroupId: next.currentMember?.assignedDGroupId === membershipTarget.id ? '' : next.currentMember?.assignedDGroupId || '',
        groupIds: (next.currentMember?.groupIds || []).filter((id) => id !== membershipTarget.id),
      };
      next.groups = (next.groups || []).map((item) => {
        if (item.id !== membershipTarget.id) return item;
        const memberIds = (item.memberIds || []).filter((id) => id !== 'current-member');
        return { ...item, memberIds, memberCount: memberIds.length };
      });
      next.memberVisibility = {
        ...(next.memberVisibility || {}),
        selectedGroupIds: (next.memberVisibility?.selectedGroupIds || []).filter((id) => id !== membershipTarget.id),
      };
    }

    const result = saveOrganizationPrototypeState(organization.id, next);
    if (!result.ok) {
      setMembershipError(result.error?.message || 'This membership could not be removed from this device.');
      return;
    }

    const label = membershipTarget.type === 'dgroup' ? 'D-Group' : 'ministry';
    setMembershipMessage(`You left ${membershipTarget.name}. The ${label} code will be required to join again.`);
    setMembershipTarget(null);
    setMembershipError('');
  }

  async function copyAdminCode() {
    try {
      await navigator.clipboard.writeText(adminCode);
      setAdminMessage(`Code ${adminCode} copied.`);
    } catch (error) {
      console.warn('Church Admin code copy failed.', error);
      setAdminMessage(`Current code: ${adminCode}`);
    }
  }

  function rotateAdminCode() {
    if (!isOrganizationManager) return;
    const nextCode = generateAdminAccessCode();
    try {
      window.localStorage.setItem(getAdminCodeStorageKey(organization?.id), nextCode);
    } catch (error) {
      console.warn('Ekklesia Pulse could not save the rotated Admin code.', error);
    }
    adminUnlockedRef.current = false;
    setAdminUnlocked(false);
    setAdminCode(nextCode);
    setAdminEntry('');
    setAdminError('');
    setAdminMessage('A new Admin code was created. The previous code no longer opens Admin on this device.');
  }

  function closeAdminGate() {
    pendingAdminButtonRef.current = null;
    setShowAdminGate(false);
    setAdminEntry('');
    setAdminError('');
    setAdminMessage('');
  }

  function navigateUnifiedApp(section) {
    if (section === 'church') return;
    onNavigateApp?.(section);
  }

  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  const adminActive = activeSection === 'admin' && adminUnlocked;
  const showDGroups = activeSection === 'groups';

  return (
    <>
      <div ref={hostRef} className="organization-hub-ministry-bridge">
        {membershipMessage ? <p className="organization-status" role="status">{membershipMessage}</p> : null}

        {showDGroups ? (
          <DGroupNetworkPanel
            organization={organization}
            workspace={workspace}
            profile={profile}
            onOpenGroup={onOpenGroup}
          />
        ) : null}

        {adminActive ? (
          <section className="organization-admin-shell" aria-label="Church administration">
            <div className="organization-admin-heading">
              <p className="dashboard-eyebrow">Church administration</p>
              <h3>Manage people and church-wide rhythm.</h3>
              <p>People controls and the Church Pulse are kept together inside this protected area.</p>
            </div>
            <nav className="organization-admin-subnav" aria-label="Admin sections">
              {[
                ['people', 'People'],
                ['pulse', 'Pulse'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={adminSection === id ? 'is-active' : ''}
                  aria-current={adminSection === id ? 'page' : undefined}
                  onClick={() => setAdminSection(id)}
                >
                  {label}
                </button>
              ))}
            </nav>
          </section>
        ) : null}

        <div hidden={showDGroups}>
          <OrganizationHub key={hubMembershipKey} organization={organization} profile={profile} {...props} />
        </div>
      </div>

      {portalTarget ? createPortal(
        <>
          <nav className="bottom-nav unified-bottom-nav" aria-label="Main navigation">
            {[
              ['home', '⌂', 'Home'],
              ['church', '♧', 'Church'],
              ['pulse', '♡', 'Pulse'],
              ['tools', '✦', 'Tools'],
              ['profile', '○', 'Me'],
            ].map(([id, icon, label]) => (
              <button
                key={id}
                type="button"
                className={id === 'church' ? 'active' : ''}
                aria-current={id === 'church' ? 'page' : undefined}
                onClick={() => navigateUnifiedApp(id)}
              >
                <span aria-hidden="true">{icon}</span>
                <small>{label}</small>
              </button>
            ))}
          </nav>

          {membershipTarget ? (
            <MembershipLeaveDialog
              target={membershipTarget}
              error={membershipError}
              onClose={() => {
                setMembershipTarget(null);
                setMembershipError('');
              }}
              onConfirm={confirmLeaveMembership}
            />
          ) : null}

          {showAdminGate ? (
            <CodeAccessDialog
              eyebrow="Restricted church administration"
              title="Enter the Church Admin code"
              description={`Admin contains organization people controls and church-wide Pulse insights for ${organization?.name || 'this church'}.`}
              label="Church Admin code"
              placeholder="Enter Admin code"
              entry={adminEntry}
              error={adminError}
              submitLabel="Open Admin"
              onEntryChange={(value) => {
                setAdminEntry(value);
                setAdminError('');
              }}
              onSubmit={verifyAdminAccess}
              onClose={closeAdminGate}
            >
              {isOrganizationManager ? (
                <aside className="pulse-access-admin" aria-label="Church Admin access controls">
                  <div>
                    <p className="dashboard-eyebrow">Administrator only</p>
                    <strong>Church Admin access code</strong>
                    <small>Share this only with people approved to manage organization members and Pulse data.</small>
                  </div>
                  <code>{adminCode}</code>
                  <div className="pulse-access-admin-actions">
                    <button type="button" onClick={copyAdminCode}>Copy</button>
                    <button type="button" onClick={rotateAdminCode}>Rotate</button>
                  </div>
                  {adminMessage ? <p className="pulse-access-admin-message" role="status">{adminMessage}</p> : null}
                </aside>
              ) : null}
              <p className="pulse-access-prototype-note">Local prototype note: this code is stored on this device and is not production-grade security.</p>
            </CodeAccessDialog>
          ) : null}
        </>,
        portalTarget,
      ) : null}
    </>
  );
}
