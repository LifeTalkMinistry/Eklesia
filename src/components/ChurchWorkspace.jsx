import { useEffect, useMemo, useRef, useState } from 'react';
import AlphaBadge from './AlphaBadge.jsx';
import OrganizationHub from './OrganizationHub.jsx';
import { getOrganizationPrototypeState } from '../services/organizationPrototypeService.js';
import './ChurchWorkspace.css';

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
          <strong>One church. Many ministries. Scoped accountability.</strong>
          <p>Ministry and circle leaders receive authority only within the areas assigned to them. Private devotional content remains protected.</p>
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
        <p className="dashboard-eyebrow">Connection settings</p>
        <h2 id="church-workspace-leave-title">Leave {ecosystem.name}?</h2>
        <p className="church-workspace-dialog-copy">
          You will no longer have access to this church organization or its ministries and accountability circles on this device. Your personal devotions, WGAP reflections, Journey history, Bible position, and notebook photos will remain unchanged.
        </p>
        {error ? <p className="church-workspace-error" role="alert">{error}</p> : null}
        <div className="church-workspace-dialog-actions">
          <button ref={stayButtonRef} className="secondary-button" type="button" onClick={onStay} disabled={leaving}>Stay connected</button>
          <button className="church-workspace-danger" type="button" onClick={onConfirm} disabled={leaving}>
            {leaving ? 'Leaving organization…' : 'Leave organization'}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function ChurchWorkspace({ organization, profile, onExit, onLeaveOrganization }) {
  const [showDetails, setShowDetails] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [demoExpanded, setDemoExpanded] = useState(false);
  const headingRef = useRef(null);

  const currentRole = useMemo(() => {
    if (!organization) return 'Church Member';
    return getOrganizationPrototypeState(organization).currentMember?.organizationRole || 'Church Member';
  }, [organization]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [organization?.id]);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key !== 'Escape') return;
      if (showLeaveDialog && !leaving) setShowLeaveDialog(false);
      else if (showDetails) setShowDetails(false);
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showDetails, showLeaveDialog, leaving]);

  async function confirmLeave() {
    if (leaving) return;
    setLeaving(true);
    setLeaveError('');
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
          <p>This church organization could not be restored on this device. Return to your personal space and try entering it again.</p>
          <button className="primary-button" type="button" onClick={onExit}>Return to my personal space</button>
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
              onClick={onExit}
              aria-label={`Exit ${organization.name} and return to my personal space`}
            >
              <span aria-hidden="true">←</span> My personal space
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
            <p className="church-workspace-label">CHURCH ORGANIZATION</p>
            <h1 ref={headingRef} tabIndex="-1">{organization.name}</h1>
            <p className="church-workspace-role">Church Organization · {currentRole}</p>
            <p className="church-workspace-platform">Powered by Ekklesia Pulse</p>
          </div>

          {demoExpanded ? (
            <div className="church-workspace-demo-details" id={demoDetailsId}>
              The church organization, ministries, roles, codes, privacy settings, and Church Pulse shown here are local prototype information. No live church-member accounts are connected.
            </div>
          ) : null}
          <p className="church-workspace-announcement" aria-live="polite">Entered {organization.name} workspace.</p>
        </header>

        <div className="church-workspace-content">
          <OrganizationHub
            organization={organization}
            profile={profile}
            onShowDetails={() => setShowDetails(true)}
            onRequestLeave={() => {
              setLeaveError('');
              setShowLeaveDialog(true);
            }}
          />
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
