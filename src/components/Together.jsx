import { useEffect, useRef, useState } from 'react';
import './Together.css';
import {
  findEcosystemByCode,
  getEcosystemMembers,
  getJoinedEcosystem,
  joinEcosystem,
  leaveEcosystem,
} from '../services/ecosystemService.js';

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

const ENCOURAGEMENT_MESSAGES = [
  'Thinking of you today.',
  'Keep going. You are not walking alone.',
  'No pressure—just a reminder that your community cares.',
  'Praying that you find strength for today.',
];

function CircleDetailsDialog({ ecosystem, onClose }) {
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
      <section className="together-dialog" role="dialog" aria-modal="true" aria-labelledby="circle-details-title">
        <div className="together-dialog-heading">
          <div>
            <p className="dashboard-eyebrow">Circle details</p>
            <h3 id="circle-details-title">{ecosystem.name}</h3>
          </div>
          <button ref={closeButtonRef} className="together-icon-button" type="button" onClick={onClose} aria-label="Close circle details">×</button>
        </div>
        <dl className="together-detail-list">
          <div><dt>Ecosystem</dt><dd>{ecosystem.name}</dd></div>
          <div><dt>Owner</dt><dd>{ecosystem.ownerName}</dd></div>
          <div><dt>Plan</dt><dd>{ecosystem.planName}</dd></div>
          <div><dt>Member capacity</dt><dd>{ecosystem.memberCount} of {ecosystem.memberLimit} spaces used</dd></div>
          <div><dt>Joined status</dt><dd>Connected on this device</dd></div>
        </dl>
        <div className="together-dialog-note">
          <strong>Grow together with consistency.</strong>
          <p>This circle helps members notice progress and offer timely encouragement.</p>
        </div>
      </section>
    </div>
  );
}

function LeaveCircleDialog({ ecosystem, leaving, error, onStay, onConfirm }) {
  const stayButtonRef = useRef(null);

  useEffect(() => {
    stayButtonRef.current?.focus();
  }, []);

  return (
    <div className="together-dialog-backdrop">
      <section className="together-dialog together-dialog-small" role="dialog" aria-modal="true" aria-labelledby="leave-circle-title">
        <p className="dashboard-eyebrow">Connection settings</p>
        <h3 id="leave-circle-title">Leave {ecosystem.name}?</h3>
        <p className="together-dialog-copy">You will stop seeing this accountability circle on this device. You can reconnect later using an ecosystem code.</p>
        {error ? <p className="together-inline-error" role="alert">{error}</p> : null}
        <div className="together-dialog-actions">
          <button ref={stayButtonRef} className="secondary-button" type="button" onClick={onStay} disabled={leaving}>Stay connected</button>
          <button className="together-danger-button" type="button" onClick={onConfirm} disabled={leaving}>{leaving ? 'Leaving circle…' : 'Leave circle'}</button>
        </div>
      </section>
    </div>
  );
}

function LoadingState() {
  return (
    <section className="together-card together-restoring-card" aria-live="polite">
      <span className="together-spinner" aria-hidden="true" />
      <p>Checking your circle connection…</p>
    </section>
  );
}

export default function Together() {
  const [viewState, setViewState] = useState(VIEW_STATES.NOT_CONNECTED);
  const [restoring, setRestoring] = useState(true);
  const [code, setCode] = useState('');
  const [previewEcosystem, setPreviewEcosystem] = useState(null);
  const [joinedEcosystem, setJoinedEcosystem] = useState(null);
  const [members, setMembers] = useState([]);
  const [showDetails, setShowDetails] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [encouragementMemberId, setEncouragementMemberId] = useState(null);
  const [preparedEncouragement, setPreparedEncouragement] = useState(null);
  const [retryType, setRetryType] = useState('check');
  const inputRef = useRef(null);

  const isBusy = viewState === VIEW_STATES.VALIDATING_CODE || viewState === VIEW_STATES.JOINING;

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

      const memberResult = await getEcosystemMembers(result.data.id);
      if (cancelled) return;

      setJoinedEcosystem(result.data);
      setMembers(memberResult.ok ? memberResult.data : result.data.members || []);
      setViewState(VIEW_STATES.JOINED);
      setRestoring(false);
    }

    restoreConnection();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function handleEscape(event) {
      if (event.key !== 'Escape') return;
      if (showLeaveDialog && !leaving) setShowLeaveDialog(false);
      else if (showDetails) setShowDetails(false);
      else if (encouragementMemberId) setEncouragementMemberId(null);
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showLeaveDialog, showDetails, encouragementMemberId, leaving]);

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
      const memberResult = await getEcosystemMembers(result.data.id);
      setJoinedEcosystem(result.data);
      setMembers(memberResult.ok ? memberResult.data : result.data.members || []);
      setPreviewEcosystem(null);
      setViewState(VIEW_STATES.JOINED);
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
    setMembers([]);
    setPreparedEncouragement(null);
    setEncouragementMemberId(null);
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
        const memberResult = await getEcosystemMembers(result.data.id);
        setJoinedEcosystem(result.data);
        setMembers(memberResult.ok ? memberResult.data : result.data.members || []);
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

  function openEncouragement(memberId) {
    setPreparedEncouragement(null);
    setEncouragementMemberId(memberId);
  }

  function prepareEncouragement(message) {
    setPreparedEncouragement({ memberId: encouragementMemberId, message });
  }

  if (restoring) return <LoadingState />;

  if (viewState === VIEW_STATES.JOINED && joinedEcosystem) {
    return (
      <section className="panel-page together-page together-joined-page">
        <div className="together-heading-row">
          <div>
            <p className="dashboard-eyebrow">Your accountability circle</p>
            <h2>{joinedEcosystem.name}</h2>
            <p className="panel-intro">{joinedEcosystem.memberCount} members · Managed by {joinedEcosystem.ownerName}</p>
            <p className="together-prototype-label">Prototype circle data for interface testing. No live member accounts are connected.</p>
          </div>
          <span className="together-connected-badge"><span aria-hidden="true">✓</span> Connected</span>
        </div>

        <section className="together-circle-section" aria-labelledby="your-circle-heading">
          <div className="together-section-heading">
            <div>
              <p className="dashboard-eyebrow">Healthy progress signals</p>
              <h3 id="your-circle-heading">Your circle</h3>
            </div>
            <p>Build your rhythm. Strengthen the church.</p>
          </div>

          <div className="together-member-grid">
            {members.map((member) => {
              const isEncouragementOpen = encouragementMemberId === member.id;
              const isPrepared = preparedEncouragement?.memberId === member.id;

              return (
                <article className="together-member-card" key={member.id}>
                  <div className="together-member-topline">
                    <span className="together-avatar" aria-hidden="true">{member.name.charAt(0)}</span>
                    <div>
                      <h4>{member.name}</h4>
                      <p>{member.status}</p>
                    </div>
                  </div>
                  <strong className="together-growth-signal">{member.growthSignal}</strong>
                  {member.lastActiveLabel !== 'Today' ? <small>Last active {member.lastActiveLabel.toLowerCase()}</small> : null}

                  {member.canEncourage ? (
                    <button
                      className="together-text-button"
                      type="button"
                      onClick={() => isEncouragementOpen ? setEncouragementMemberId(null) : openEncouragement(member.id)}
                      aria-expanded={isEncouragementOpen}
                    >
                      {isEncouragementOpen ? 'Close encouragement' : 'Send encouragement'}
                    </button>
                  ) : null}

                  {isEncouragementOpen ? (
                    <section className="together-encouragement-panel" role="dialog" aria-modal="false" aria-label={`Prepare encouragement for ${member.name}`}>
                      <p>Choose a gentle message for the future connected version:</p>
                      <div className="together-message-options">
                        {ENCOURAGEMENT_MESSAGES.map((message) => (
                          <button
                            className={isPrepared && preparedEncouragement.message === message ? 'selected' : ''}
                            type="button"
                            key={message}
                            onClick={() => prepareEncouragement(message)}
                          >
                            {message}
                          </button>
                        ))}
                      </div>
                      {isPrepared ? (
                        <p className="together-prototype-notice" role="status">Encouragement prepared for the future connected version of Ekklesia Pulse. This prototype has not sent it to {member.name}.</p>
                      ) : null}
                    </section>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <div className="together-joined-actions">
          <button className="secondary-button" type="button" onClick={() => setShowDetails(true)}>Circle details</button>
          <button className="together-leave-link" type="button" onClick={() => { setLeaveError(''); setShowLeaveDialog(true); }}>Leave circle</button>
        </div>

        {showDetails ? <CircleDetailsDialog ecosystem={joinedEcosystem} onClose={() => setShowDetails(false)} /> : null}
        {showLeaveDialog ? <LeaveCircleDialog ecosystem={joinedEcosystem} leaving={leaving} error={leaveError} onStay={() => setShowLeaveDialog(false)} onConfirm={confirmLeave} /> : null}
      </section>
    );
  }

  if (viewState === VIEW_STATES.ECOSYSTEM_PREVIEW || viewState === VIEW_STATES.JOINING) {
    return (
      <section className="panel-page together-page">
        <p className="dashboard-eyebrow">Circle found</p>
        <h2>Review before joining.</h2>
        <p className="panel-intro">Make sure this is the accountability community you intended to join.</p>

        <section className="together-card together-preview-card">
          <span className="soft-badge">{previewEcosystem.planName} plan</span>
          <h3>{previewEcosystem.name}</h3>
          <p>{previewEcosystem.description}</p>
          <p className="together-prototype-label">Prototype circle data for interface testing. This is not live church membership information.</p>
          <dl className="together-preview-details">
            <div><dt>Managed by</dt><dd>{previewEcosystem.ownerName}</dd></div>
            <div><dt>Plan</dt><dd>{previewEcosystem.planName}</dd></div>
            <div><dt>Member spaces</dt><dd>{previewEcosystem.memberCount} of {previewEcosystem.memberLimit} currently used</dd></div>
          </dl>
        </section>

        <div className="together-preview-actions" aria-live="polite">
          <button className="primary-button together-primary-button" type="button" onClick={confirmJoin} disabled={viewState === VIEW_STATES.JOINING}>
            {viewState === VIEW_STATES.JOINING ? <><span className="together-spinner together-spinner-dark" aria-hidden="true" /> Joining circle…</> : 'Join this circle'}
          </button>
          <button className="secondary-button" type="button" onClick={useDifferentCode} disabled={viewState === VIEW_STATES.JOINING}>Use a different code</button>
        </div>
      </section>
    );
  }

  if (viewState === VIEW_STATES.MEMBER_LIMIT_REACHED) {
    return (
      <section className="panel-page together-page">
        <p className="dashboard-eyebrow">Circle unavailable</p>
        <h2>This accountability circle has reached its member limit.</h2>
        <p className="panel-intro">Ask the ecosystem owner to free a space or upgrade the circle’s subscription.</p>
        <section className="together-card together-message-card" role="status">
          <span className="together-message-icon" aria-hidden="true">◎</span>
          <p>The ecosystem owner is responsible for the subscription. No payment is required from the joining member here.</p>
          <button className="secondary-button" type="button" onClick={useDifferentCode}>Use a different code</button>
        </section>
      </section>
    );
  }

  if (viewState === VIEW_STATES.GENERAL_ERROR) {
    return (
      <section className="panel-page together-page">
        <p className="dashboard-eyebrow">Connection interrupted</p>
        <h2>Something went wrong while checking this ecosystem.</h2>
        <p className="panel-intro">Please try again. Your account has not been connected.</p>
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
      <p className="dashboard-eyebrow">Healthy accountability</p>
      <h2>Grow with people who care.</h2>
      <p className="panel-intro">Join the church, ministry, or accountability community you belong to and see healthy progress signals.</p>

      <form className="together-card together-join-card" onSubmit={handleSubmit} noValidate>
        <div>
          <h3>Join an accountability circle</h3>
          <p>Enter the ecosystem code shared by your church or group owner.</p>
        </div>
        <label htmlFor="ecosystem-code">Ecosystem code</label>
        <input
          ref={inputRef}
          id="ecosystem-code"
          name="ecosystem-code"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck="false"
          placeholder="Example: LIFETALK30"
          value={code}
          onChange={handleCodeChange}
          disabled={validating}
          aria-invalid={invalidCode}
          aria-describedby={invalidCode ? 'ecosystem-code-error' : undefined}
        />
        <div className="together-validation-slot" aria-live="polite" aria-atomic="true">
          {validating ? <p className="together-checking-message"><span className="together-spinner" aria-hidden="true" /> Checking the code shared with you…</p> : null}
          {invalidCode ? (
            <div id="ecosystem-code-error" className="together-inline-error" role="alert">
              <strong>We could not find an accountability circle using that code.</strong>
              <p>Check the code and try again, or ask the ecosystem owner whether the code has changed.</p>
            </div>
          ) : null}
        </div>
        <button className="primary-button together-primary-button" type="submit" disabled={!code.trim() || validating}>
          {validating ? 'Checking code…' : 'Find my circle'}
        </button>
        <p className="together-secondary-note">Don’t have a code? Ask your church, ministry, or accountability-circle owner.</p>
      </form>
    </section>
  );
}
