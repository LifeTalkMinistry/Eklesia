import { useEffect, useMemo, useRef, useState } from 'react';
import './Together.css';
import {
  findEcosystemByCode,
  getJoinedEcosystem,
  joinEcosystem,
  leaveEcosystem,
} from '../services/ecosystemService.js';
import { getOrganizationPrototypeState } from '../services/organizationPrototypeService.js';

const VIEW_STATES = {
  NOT_CONNECTED: 'NOT_CONNECTED',
  VALIDATING_CODE: 'VALIDATING_CODE',
  INVALID_CODE: 'INVALID_CODE',
  ECOSYSTEM_PREVIEW: 'ECOSYSTEM_PREVIEW',
  JOINING: 'JOINING',
  JOINED: 'JOINED',
  MEMBER_LIMIT_REACHED: 'MEMBER_LIMIT_REACHED',
  GENERAL_ERROR: 'GENERAL_ERROR',
};

function OrganizationDetailsDialog({ ecosystem, onClose }) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  return (
    <div
      className="together-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="together-dialog" role="dialog" aria-modal="true" aria-labelledby="organization-details-title">
        <div className="together-dialog-heading">
          <div>
            <p className="dashboard-eyebrow">Organization details</p>
            <h3 id="organization-details-title">{ecosystem.name}</h3>
          </div>
          <button ref={closeButtonRef} className="together-icon-button" type="button" onClick={onClose} aria-label="Close organization details">×</button>
        </div>
        <dl className="together-detail-list">
          <div><dt>Church organization</dt><dd>{ecosystem.name}</dd></div>
          <div><dt>Organization owner</dt><dd>{ecosystem.ownerName}</dd></div>
          <div><dt>Plan</dt><dd>{ecosystem.planName}</dd></div>
          <div><dt>Member capacity</dt><dd>{ecosystem.memberCount} of {ecosystem.memberLimit} spaces used</dd></div>
          <div><dt>Join policy</dt><dd>{ecosystem.approvalMode}</dd></div>
          <div><dt>Joined status</dt><dd>Connected on this device</dd></div>
        </dl>
        <div className="together-dialog-note">
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
    <div className="together-dialog-backdrop">
      <section className="together-dialog together-dialog-small" role="dialog" aria-modal="true" aria-labelledby="leave-organization-title">
        <p className="dashboard-eyebrow">Connection settings</p>
        <h3 id="leave-organization-title">Leave {ecosystem.name}?</h3>
        <p className="together-dialog-copy">
          You will no longer have access to this church organization or its ministries and accountability circles on this device. Your personal devotions, WGAP reflections, Journey history, Bible position, and notebook photos will remain unchanged.
        </p>
        {error ? <p className="together-inline-error" role="alert">{error}</p> : null}
        <div className="together-dialog-actions">
          <button ref={stayButtonRef} className="secondary-button" type="button" onClick={onStay} disabled={leaving}>Stay connected</button>
          <button className="together-danger-button" type="button" onClick={onConfirm} disabled={leaving}>
            {leaving ? 'Leaving organization…' : 'Leave organization'}
          </button>
        </div>
      </section>
    </div>
  );
}

function LoadingState() {
  return (
    <section className="together-card together-restoring-card" aria-live="polite">
      <span className="together-spinner" aria-hidden="true" />
      <p>Checking your church connection…</p>
    </section>
  );
}

export default function Together({ profile, onEnterOrganization, focusKey = 0 }) {
  const [viewState, setViewState] = useState(VIEW_STATES.NOT_CONNECTED);
  const [restoring, setRestoring] = useState(true);
  const [code, setCode] = useState('');
  const [previewEcosystem, setPreviewEcosystem] = useState(null);
  const [joinedEcosystem, setJoinedEcosystem] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [retryType, setRetryType] = useState('check');
  const inputRef = useRef(null);
  const enterButtonRef = useRef(null);

  const isBusy = viewState === VIEW_STATES.VALIDATING_CODE || viewState === VIEW_STATES.JOINING;
  const joinedWorkspace = useMemo(
    () => (joinedEcosystem ? getOrganizationPrototypeState(joinedEcosystem) : null),
    [joinedEcosystem],
  );
  const currentRole = joinedWorkspace?.currentMember?.organizationRole || 'Church Member';
  const ministryCount = joinedWorkspace?.ministries?.length || 0;
  const circleCount = joinedWorkspace?.ministries?.reduce((total, ministry) => total + (ministry.circles?.length || 0), 0) || 0;

  useEffect(() => {
    let cancelled = false;

    async function restoreConnection() {
      const result = await getJoinedEcosystem();
      if (cancelled) return;

      if (!result.ok) {
        setRetryType('restore');
        setViewState(VIEW_STATES.GENERAL_ERROR);
        setRestoring(false);
        return;
      }

      if (!result.data) {
        setViewState(VIEW_STATES.NOT_CONNECTED);
        setRestoring(false);
        return;
      }

      setJoinedEcosystem(result.data);
      setViewState(VIEW_STATES.JOINED);
      setRestoring(false);
    }

    restoreConnection();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!focusKey || viewState !== VIEW_STATES.JOINED) return;
    window.requestAnimationFrame(() => enterButtonRef.current?.focus());
  }, [focusKey, viewState]);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key !== 'Escape') return;
      if (showLeaveDialog && !leaving) setShowLeaveDialog(false);
      else if (showDetails) setShowDetails(false);
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showLeaveDialog, showDetails, leaving]);

  async function validateCode() {
    if (!code.trim() || isBusy) return;
    setRetryType('check');
    setViewState(VIEW_STATES.VALIDATING_CODE);
    const result = await findEcosystemByCode(code);

    if (result.ok) {
      setPreviewEcosystem(result.data);
      setViewState(VIEW_STATES.ECOSYSTEM_PREVIEW);
      return;
    }
    if (result.error.code === 'INVALID_CODE' || result.error.code === 'EMPTY_CODE') {
      setViewState(VIEW_STATES.INVALID_CODE);
      return;
    }
    if (result.error.code === 'MEMBER_LIMIT_REACHED') {
      setViewState(VIEW_STATES.MEMBER_LIMIT_REACHED);
      return;
    }
    setViewState(VIEW_STATES.GENERAL_ERROR);
  }

  function handleSubmit(event) {
    event.preventDefault();
    validateCode();
  }

  function handleCodeChange(event) {
    const nextCode = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setCode(nextCode);
    if (viewState === VIEW_STATES.INVALID_CODE) setViewState(VIEW_STATES.NOT_CONNECTED);
  }

  function useDifferentCode() {
    setCode('');
    setPreviewEcosystem(null);
    setViewState(VIEW_STATES.NOT_CONNECTED);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function confirmJoin() {
    if (!previewEcosystem || isBusy) return;
    setRetryType('join');
    setViewState(VIEW_STATES.JOINING);
    const result = await joinEcosystem(previewEcosystem.id);

    if (result.ok) {
      setJoinedEcosystem(result.data);
      setPreviewEcosystem(null);
      setViewState(VIEW_STATES.JOINED);
      onEnterOrganization?.(result.data);
      return;
    }
    if (result.error.code === 'MEMBER_LIMIT_REACHED') {
      setViewState(VIEW_STATES.MEMBER_LIMIT_REACHED);
      return;
    }
    setViewState(VIEW_STATES.GENERAL_ERROR);
  }

  async function confirmLeave() {
    if (leaving) return;
    setLeaving(true);
    setLeaveError('');
    const result = await leaveEcosystem();

    if (!result.ok) {
      setLeaveError(result.error.message);
      setLeaving(false);
      return;
    }

    setJoinedEcosystem(null);
    setShowLeaveDialog(false);
    setLeaving(false);
    setCode('');
    setViewState(VIEW_STATES.NOT_CONNECTED);
  }

  async function retryLastAction() {
    if (retryType === 'join' && previewEcosystem) {
      await confirmJoin();
      return;
    }
    if (retryType === 'restore') {
      setRestoring(true);
      const result = await getJoinedEcosystem();
      if (result.ok && result.data) {
        setJoinedEcosystem(result.data);
        setViewState(VIEW_STATES.JOINED);
      } else if (result.ok) {
        setViewState(VIEW_STATES.NOT_CONNECTED);
      } else {
        setViewState(VIEW_STATES.GENERAL_ERROR);
      }
      setRestoring(false);
      return;
    }
    await validateCode();
  }

  if (restoring) return <LoadingState />;

  if (viewState === VIEW_STATES.JOINED && joinedEcosystem) {
    return (
      <section className="panel-page together-page">
        <div className="together-heading-row">
          <div>
            <p className="dashboard-eyebrow">Your church organization</p>
            <h2>{joinedEcosystem.name}</h2>
            <p className="panel-intro">You are connected as an {currentRole}.</p>
          </div>
          <span className="together-connected-badge">✓ Connected</span>
        </div>

        <section className="together-card together-workspace-launcher" aria-labelledby="connected-organization-heading">
          <div className="together-workspace-launcher-heading">
            <div>
              <span className="soft-badge">UI PROTOTYPE</span>
              <h3 id="connected-organization-heading">Enter your church space</h3>
            </div>
            <span className="together-workspace-mark" aria-hidden="true">⌂</span>
          </div>
          <p>You are connected to this church organization. Enter the church space to view its Pulse, ministries, accountability circles, people, and privacy settings.</p>
          <dl className="together-workspace-summary">
            <div><dt>Members</dt><dd>{joinedEcosystem.memberCount}</dd></div>
            <div><dt>Ministries</dt><dd>{ministryCount}</dd></div>
            <div><dt>Accountability circles</dt><dd>{circleCount}</dd></div>
            <div><dt>Your role</dt><dd>{currentRole}</dd></div>
          </dl>
          <p className="together-workspace-privacy"><strong>Privacy note:</strong> Your personal WGAP, prayers, notes, and notebook photos remain private.</p>
          <div className="together-workspace-actions">
            <button ref={enterButtonRef} className="primary-button" type="button" onClick={() => onEnterOrganization?.(joinedEcosystem)}>Enter church space</button>
            <button className="secondary-button" type="button" onClick={() => setShowDetails(true)}>Organization details</button>
          </div>
          <button className="together-leave-link" type="button" onClick={() => {
            setLeaveError('');
            setShowLeaveDialog(true);
          }}>Leave organization</button>
        </section>

        {showDetails ? <OrganizationDetailsDialog ecosystem={joinedEcosystem} onClose={() => setShowDetails(false)} /> : null}
        {showLeaveDialog ? (
          <LeaveOrganizationDialog
            ecosystem={joinedEcosystem}
            leaving={leaving}
            error={leaveError}
            onStay={() => setShowLeaveDialog(false)}
            onConfirm={confirmLeave}
          />
        ) : null}
      </section>
    );
  }

  if (viewState === VIEW_STATES.ECOSYSTEM_PREVIEW || viewState === VIEW_STATES.JOINING) {
    return (
      <section className="panel-page together-page">
        <p className="dashboard-eyebrow">Church found</p>
        <h2>Review before joining.</h2>
        <p className="panel-intro">Make sure this is the church organization you intended to join.</p>
        <section className="together-card together-preview-card">
          <span className="soft-badge">{previewEcosystem.planName} plan</span>
          <h3>{previewEcosystem.name}</h3>
          <p>{previewEcosystem.description}</p>
          <dl className="together-preview-details">
            <div><dt>Organization owner</dt><dd>{previewEcosystem.ownerName}</dd></div>
            <div><dt>Join policy</dt><dd>{previewEcosystem.approvalMode}</dd></div>
            <div><dt>Member spaces</dt><dd>{previewEcosystem.memberCount} of {previewEcosystem.memberLimit} currently used</dd></div>
          </dl>
        </section>
        <section className="together-card together-sharing-card">
          <div className="together-sharing-heading">
            <p className="dashboard-eyebrow">Before you join</p>
            <h3>Membership does not automatically expose your devotions.</h3>
          </div>
          <div className="together-privacy-grid">
            <section><h4>General signals may be shared</h4><ul><li>Completed today</li><li>General rhythm status</li><li>Care signal when permitted</li></ul></section>
            <section><h4>Private content stays protected</h4><ul><li>WGAP responses</li><li>Prayers and journals</li><li>Notebook photos</li></ul></section>
          </div>
          <p className="together-control-note">After joining, you can choose whether your rhythm is visible only to you, selected circles, ministries, or the whole church.</p>
        </section>
        <div className="together-preview-actions" aria-live="polite">
          <button className="primary-button together-primary-button" type="button" onClick={confirmJoin} disabled={viewState === VIEW_STATES.JOINING}>
            {viewState === VIEW_STATES.JOINING ? <><span className="together-spinner together-spinner-dark" aria-hidden="true" /> Joining church…</> : 'Join this church'}
          </button>
          <button className="secondary-button" type="button" onClick={useDifferentCode} disabled={viewState === VIEW_STATES.JOINING}>Use a different code</button>
        </div>
      </section>
    );
  }

  if (viewState === VIEW_STATES.MEMBER_LIMIT_REACHED) {
    return (
      <section className="panel-page together-page">
        <p className="dashboard-eyebrow">Organization unavailable</p>
        <h2>This church organization has reached its member limit.</h2>
        <p className="panel-intro">Ask the organization owner to free a space or upgrade the church subscription.</p>
        <section className="together-card together-message-card" role="status">
          <span className="together-message-icon" aria-hidden="true">◎</span>
          <p>The organization owner is responsible for the subscription. No payment is required from the joining member here.</p>
          <button className="secondary-button" type="button" onClick={useDifferentCode}>Use a different code</button>
        </section>
      </section>
    );
  }

  if (viewState === VIEW_STATES.GENERAL_ERROR) {
    return (
      <section className="panel-page together-page">
        <p className="dashboard-eyebrow">Connection interrupted</p>
        <h2>Something went wrong while checking this church organization.</h2>
        <p className="panel-intro">Please try again. Your device profile has not been connected.</p>
        <section className="together-card together-message-card" role="alert">
          <span className="together-message-icon" aria-hidden="true">!</span>
          <p>No joined state was saved from the failed request.</p>
          <button className="primary-button together-primary-button" type="button" onClick={retryLastAction}>Try again</button>
        </section>
      </section>
    );
  }

  const invalidCode = viewState === VIEW_STATES.INVALID_CODE;
  const validating = viewState === VIEW_STATES.VALIDATING_CODE;

  return (
    <section className="panel-page together-page">
      <p className="dashboard-eyebrow">Church connection</p>
      <h2>Join your church organization.</h2>
      <p className="panel-intro">The organization is the main home for church members, ministries, accountability circles, and the Church Pulse.</p>
      <form className="together-card together-join-card" onSubmit={handleSubmit} noValidate>
        <div><h3>Enter your church code</h3><p>The code connects this device profile to the church organization. It is not a password.</p></div>
        <label htmlFor="organization-code">Church organization code</label>
        <input ref={inputRef} id="organization-code" name="organization-code" type="text" inputMode="text" autoComplete="off" autoCapitalize="characters" spellCheck="false" placeholder="Example: AMAZING12" value={code} onChange={handleCodeChange} disabled={validating} aria-invalid={invalidCode} aria-describedby={invalidCode ? 'organization-code-error' : 'organization-code-note'} />
        <div className="together-validation-slot" aria-live="polite" aria-atomic="true">
          {validating ? <p className="together-checking-message"><span className="together-spinner" aria-hidden="true" /> Checking the church code…</p> : null}
          {invalidCode ? <div id="organization-code-error" className="together-inline-error" role="alert"><strong>We could not find a church organization using that code.</strong><p>Check the code and try again, or ask an organization administrator whether the code has changed.</p></div> : null}
        </div>
        <button className="primary-button together-primary-button" type="submit" disabled={!code.trim() || validating}>{validating ? 'Checking code…' : 'Find my church'}</button>
        <p id="organization-code-note" className="together-form-privacy"><strong>Privacy first:</strong> joining the church does not automatically reveal WGAP responses, prayers, journals, or notebook photos.</p>
        <p className="together-secondary-note">Don’t have a code? Ask your church organization owner or administrator.</p>
      </form>
    </section>
  );
}
