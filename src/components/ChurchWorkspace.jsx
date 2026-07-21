import { useEffect, useMemo, useRef, useState } from 'react';
import AlphaBadge from './AlphaBadge.jsx';
import ChurchHome from './ChurchHome.jsx';
import GroupWorkspace from './GroupWorkspace.jsx';
import MinistryWorkspace from './MinistryWorkspace.jsx';
import OrganizationHubMinistryBridge from './OrganizationHubMinistryBridge.jsx';
import {
  getOrganizationPrototypeState,
  saveOrganizationPrototypeState,
} from '../services/organizationPrototypeService.js';
import './ChurchWorkspace.css';
import './TogetherWorkspace.css';

const CHURCH_SECTIONS = [
  ['home', 'Home'],
  ['pulse', 'Pulse'],
  ['ministries', 'Ministries'],
  ['groups', 'Groups'],
  ['people', 'People'],
  ['privacy', 'Privacy'],
];

const PENDING_APP_TAB_KEY = 'ekklesia-pending-app-tab';
const APP_TABS = new Set(['home', 'community', 'pulse', 'tools', 'profile']);

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function rememberPendingAppTab(destination) {
  if (typeof window === 'undefined' || !APP_TABS.has(destination)) return;
  try {
    window.sessionStorage.setItem(PENDING_APP_TAB_KEY, destination);
  } catch (error) {
    console.warn('Ekklesia Pulse could not preserve the selected app tab.', error);
  }
}

function OrganizationDetailsDialog({ ecosystem, onClose }) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  return (
    <div
      className="church-workspace-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="church-workspace-dialog" role="dialog" aria-modal="true" aria-labelledby="church-workspace-details-title">
        <div className="church-workspace-dialog-heading">
          <div>
            <p className="dashboard-eyebrow">Organization details</p>
            <h2 id="church-workspace-details-title">{ecosystem.name}</h2>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close organization details">×</button>
        </div>
        <dl className="church-workspace-detail-list">
          <div><dt>Church organization</dt><dd>{ecosystem.name}</dd></div>
          <div><dt>Organization owner</dt><dd>{ecosystem.ownerName}</dd></div>
          <div><dt>Plan</dt><dd>{ecosystem.planName}</dd></div>
          <div><dt>Member capacity</dt><dd>{ecosystem.memberCount} of {ecosystem.memberLimit} spaces used</dd></div>
          <div><dt>Join policy</dt><dd>{ecosystem.approvalMode}</dd></div>
          <div><dt>Joined status</dt><dd>Connected on this device</dd></div>
        </dl>
        <div className="church-workspace-dialog-note">
          <strong>One church. Many ministries and purpose-driven Groups.</strong>
          <p>Ministry and appointed Group Leaders receive authority only within the areas assigned to them. Private devotional content remains protected.</p>
        </div>
      </section>
    </div>
  );
}

function LeaveOrganizationDialog({ ecosystem, leaving, error, onStay, onConfirm }) {
  const stayButtonRef = useRef(null);

  useEffect(() => {
    stayButtonRef.current?.focus();
  }, []);

  return (
    <div className="church-workspace-dialog-backdrop">
      <section className="church-workspace-dialog church-workspace-dialog-small" role="dialog" aria-modal="true" aria-labelledby="church-workspace-leave-title">
        <p className="dashboard-eyebrow">Church connection</p>
        <h2 id="church-workspace-leave-title">Exit {ecosystem.name}?</h2>
        <p className="church-workspace-dialog-copy">
          This will disconnect this device from the church. To enter the church again, you will need to provide its church organization code. Your personal devotions, WGAP reflections, Journey history, Bible position, and notebook photos will remain unchanged.
        </p>
        {error ? <p className="church-workspace-error" role="alert">{error}</p> : null}
        <div className="church-workspace-dialog-actions">
          <button ref={stayButtonRef} className="secondary-button" type="button" onClick={onStay} disabled={leaving}>Stay connected</button>
          <button className="church-workspace-danger" type="button" onClick={onConfirm} disabled={leaving}>
            {leaving ? 'Exiting church…' : 'Exit church'}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function ChurchWorkspace({ organization, profile, onExit, onLeaveOrganization }) {
  const initialWorkspace = organization ? getOrganizationPrototypeState(organization) : null;
  const [workspaceSnapshot, setWorkspaceSnapshot] = useState(initialWorkspace);
  const [churchSection, setChurchSection] = useState('home');
  const [activeGroupId, setActiveGroupId] = useState('');
  const [activeMinistryId, setActiveMinistryId] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [demoExpanded, setDemoExpanded] = useState(false);
  const headingRef = useRef(null);
  const contentRef = useRef(null);
  const hubHostRef = useRef(null);
  const workspaceRef = useRef(initialWorkspace);
  const workspaceSignatureRef = useRef(JSON.stringify(initialWorkspace));
  const previousJoinedGroupIdsRef = useRef(new Set(initialWorkspace?.currentMember?.groupIds || []));

  const currentRole = workspaceSnapshot?.currentMember?.organizationRole || 'Church Member';
  const joinedGroups = useMemo(() => {
    const joinedIds = new Set(workspaceSnapshot?.currentMember?.groupIds || []);
    return (workspaceSnapshot?.groups || []).filter((group) => joinedIds.has(group.id));
  }, [workspaceSnapshot]);
  const activeGroup = joinedGroups.find((group) => group.id === activeGroupId) || null;
  const activeMinistry = (workspaceSnapshot?.ministries || []).find((ministry) => ministry.id === activeMinistryId) || null;
  const firstName = String(profile?.displayName || '').trim().split(/\s+/)[0] || 'friend';

  useEffect(() => {
    if (!organization) return;
    const nextWorkspace = getOrganizationPrototypeState(organization);
    setWorkspaceSnapshot(nextWorkspace);
    workspaceRef.current = nextWorkspace;
    workspaceSignatureRef.current = JSON.stringify(nextWorkspace);
    previousJoinedGroupIdsRef.current = new Set(nextWorkspace.currentMember?.groupIds || []);
    setChurchSection('home');
    setActiveGroupId('');
    setActiveMinistryId('');
  }, [organization?.id]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [organization?.id]);

  useEffect(() => {
    if (churchSection === 'home' || activeGroupId || activeMinistryId || !hubHostRef.current) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const targetButton = [...hubHostRef.current.querySelectorAll('.organization-section-nav button')]
        .find((button) => button.textContent.trim().toLowerCase() === churchSection);
      if (targetButton && !targetButton.classList.contains('is-active')) targetButton.click();
      window.requestAnimationFrame(() => {
        const heading = hubHostRef.current?.querySelector('.organization-section-stack h3');
        if (heading) {
          heading.setAttribute('tabindex', '-1');
          heading.focus({ preventScroll: true });
        }
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [churchSection, activeGroupId, activeMinistryId]);

  useEffect(() => {
    if (!organization || !contentRef.current) return undefined;
    let frame = 0;

    function syncWorkspaceFromStorage() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const nextWorkspace = getOrganizationPrototypeState(organization);
        const nextSignature = JSON.stringify(nextWorkspace);
        const nextJoinedIds = new Set(nextWorkspace.currentMember?.groupIds || []);
        const previousJoinedIds = previousJoinedGroupIdsRef.current;
        const newlyJoinedGroupId = [...nextJoinedIds].find((groupId) => !previousJoinedIds.has(groupId));

        previousJoinedGroupIdsRef.current = nextJoinedIds;
        if (nextSignature !== workspaceSignatureRef.current) {
          workspaceSignatureRef.current = nextSignature;
          workspaceRef.current = nextWorkspace;
          setWorkspaceSnapshot(nextWorkspace);
        }
        if (newlyJoinedGroupId) {
          setActiveMinistryId('');
          setActiveGroupId(newlyJoinedGroupId);
        }
      });
    }

    const observer = new MutationObserver(syncWorkspaceFromStorage);
    observer.observe(contentRef.current, { childList: true, subtree: true, characterData: true });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [organization?.id]);

  useEffect(() => {
    if (activeGroupId && !joinedGroups.some((group) => group.id === activeGroupId)) setActiveGroupId('');
  }, [activeGroupId, joinedGroups]);

  useEffect(() => {
    if (!activeMinistryId) return;
    const joinedIds = new Set(workspaceSnapshot?.currentMember?.ministryIds || []);
    if (!activeMinistry || !joinedIds.has(activeMinistryId)) setActiveMinistryId('');
  }, [activeMinistryId, activeMinistry, workspaceSnapshot]);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key !== 'Escape') return;
      if (showLeaveDialog && !leaving) setShowLeaveDialog(false);
      else if (showDetails) setShowDetails(false);
      else if (activeGroupId) setActiveGroupId('');
      else if (activeMinistryId) closeMinistry();
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showDetails, showLeaveDialog, leaving, activeGroupId, activeMinistryId]);

  function updateWorkspace(updater) {
    const current = workspaceRef.current || getOrganizationPrototypeState(organization);
    const next = typeof updater === 'function' ? updater(clone(current)) : updater;
    const result = saveOrganizationPrototypeState(organization.id, next);
    workspaceRef.current = next;
    workspaceSignatureRef.current = JSON.stringify(next);
    previousJoinedGroupIdsRef.current = new Set(next.currentMember?.groupIds || []);
    setWorkspaceSnapshot(next);
    return result;
  }

  function navigateToSection(section) {
    setActiveGroupId('');
    setActiveMinistryId('');
    setChurchSection(section);
  }

  function openGroup(groupId) {
    const isJoined = joinedGroups.some((group) => group.id === groupId);
    if (!isJoined) return;
    setActiveMinistryId('');
    setActiveGroupId(groupId);
  }

  function openMinistry(ministryId) {
    const joinedIds = new Set(workspaceRef.current?.currentMember?.ministryIds || []);
    if (!joinedIds.has(ministryId)) return;
    setActiveGroupId('');
    setActiveMinistryId(ministryId);
  }

  function closeMinistry() {
    setActiveMinistryId('');
    setActiveGroupId('');
    setChurchSection('ministries');
  }

  function exitToAppTab(destination = 'home') {
    rememberPendingAppTab(destination);
    if (typeof window !== 'undefined' && window.history.state?.ekklesiaWorkspaceId) {
      window.history.back();
      return;
    }
    onExit();
  }

  function requestChurchExit() {
    setLeaveError('');
    setShowLeaveDialog(true);
  }

  async function confirmLeave() {
    if (leaving) return;
    setLeaving(true);
    setLeaveError('');
    rememberPendingAppTab('community');

    if (typeof window !== 'undefined' && window.history.state?.ekklesiaWorkspaceId) {
      const currentState = window.history.state || {};
      window.history.replaceState({ ...currentState, ekklesiaWorkspaceId: undefined, ekklesiaPersonalSpace: true }, '');
    }

    const result = await onLeaveOrganization(organization);
    if (!result?.ok) {
      setLeaveError(result?.error?.message || 'The church organization could not be removed from this device.');
      setLeaving(false);
    }
  }

  if (!organization) {
    return (
      <main className="church-workspace-shell">
        <div className="church-workspace-frame church-workspace-unavailable">
          <p className="dashboard-eyebrow">Church workspace</p>
          <h1>Church space unavailable</h1>
          <p>This church organization could not be restored on this device. Return to Home and try opening Church again.</p>
          <button className="primary-button" type="button" onClick={() => exitToAppTab('home')}>Return to Home</button>
        </div>
      </main>
    );
  }

  const demoDetailsId = `church-workspace-demo-${organization.id}`;

  return (
    <main className="church-workspace-shell">
      <div className="church-workspace-frame">
        <header className="church-workspace-header">
          <div className="church-workspace-top-row">
            <button
              className="church-workspace-exit"
              type="button"
              onClick={requestChurchExit}
              aria-label={`Exit ${organization.name} and require the church code to enter again`}
            >
              <span aria-hidden="true">←</span> Exit church
            </button>
            <div className="church-workspace-badges">
              <button
                className="church-workspace-demo"
                type="button"
                onClick={() => setDemoExpanded((current) => !current)}
                aria-expanded={demoExpanded}
                aria-controls={demoDetailsId}
              >
                DEMO DATA
              </button>
              <AlphaBadge compact />
            </div>
          </div>

          <div className="church-workspace-identity">
            <p className="church-workspace-label">{organization.name.toUpperCase()}</p>
            <h1 ref={headingRef} tabIndex="-1">Welcome back, {firstName}</h1>
            <p className="church-workspace-role">{currentRole}</p>
            <p className="church-workspace-platform">Church Home · Powered by Ekklesia Pulse</p>
          </div>

          {demoExpanded ? (
            <div className="church-workspace-demo-details" id={demoDetailsId}>
              The announcements, acknowledgements, events, ministries, Groups, roles, codes, privacy settings, and Church Pulse shown here are local prototype information. No live church-member accounts are connected.
            </div>
          ) : null}
          <p className="church-workspace-announcement" aria-live="polite">Entered {organization.name} workspace.</p>
        </header>

        <div className="church-workspace-content" ref={contentRef}>
          {activeGroup && workspaceSnapshot ? (
            <GroupWorkspace
              organization={organization}
              workspace={workspaceSnapshot}
              group={activeGroup}
              profile={profile}
              onBack={() => setActiveGroupId('')}
            />
          ) : activeMinistry && workspaceSnapshot ? (
            <MinistryWorkspace
              organization={organization}
              workspace={workspaceSnapshot}
              ministry={activeMinistry}
              profile={profile}
              onBack={closeMinistry}
              onOpenGroup={openGroup}
            />
          ) : (
            <>
              <nav className="church-workspace-primary-nav" aria-label="Church Workspace sections">
                {CHURCH_SECTIONS.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={churchSection === id ? 'is-active' : ''}
                    aria-current={churchSection === id ? 'page' : undefined}
                    onClick={() => navigateToSection(id)}
                  >
                    {label}
                  </button>
                ))}
              </nav>

              {churchSection === 'home' && workspaceSnapshot ? (
                <ChurchHome
                  organization={organization}
                  profile={profile}
                  workspace={workspaceSnapshot}
                  onWorkspaceChange={updateWorkspace}
                  onOpenGroup={openGroup}
                  onNavigate={navigateToSection}
                  onShowDetails={() => setShowDetails(true)}
                />
              ) : null}

              <div ref={hubHostRef} className="church-workspace-hub-host" hidden={churchSection === 'home'}>
                <OrganizationHubMinistryBridge
                  organization={organization}
                  profile={profile}
                  workspace={workspaceSnapshot}
                  onOpenMinistry={openMinistry}
                  onOpenGroup={openGroup}
                  onNavigateApp={exitToAppTab}
                  onShowDetails={() => setShowDetails(true)}
                  onRequestLeave={requestChurchExit}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {showDetails ? <OrganizationDetailsDialog ecosystem={organization} onClose={() => setShowDetails(false)} /> : null}
      {showLeaveDialog ? (
        <LeaveOrganizationDialog
          ecosystem={organization}
          leaving={leaving}
          error={leaveError}
          onStay={() => setShowLeaveDialog(false)}
          onConfirm={confirmLeave}
        />
      ) : null}
    </main>
  );
}
