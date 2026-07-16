import { useEffect, useRef, useState } from 'react';
import './Together.css';
import {
  findEcosystemByCode,
  getJoinedEcosystem,
  joinEcosystem,
} from '../services/ecosystemService.js';

const VIEW_STATES = {
  NOT_CONNECTED: 'NOT_CONNECTED',
  VALIDATING_CODE: 'VALIDATING_CODE',
  INVALID_CODE: 'INVALID_CODE',
  ECOSYSTEM_PREVIEW: 'ECOSYSTEM_PREVIEW',
  JOINING: 'JOINING',
  MEMBER_LIMIT_REACHED: 'MEMBER_LIMIT_REACHED',
  GENERAL_ERROR: 'GENERAL_ERROR',
};

const SKIP_AUTO_OPEN_KEY = 'ekklesia-skip-church-auto-open-once';

function consumeSkipAutoOpen() {
  if (typeof window === 'undefined') return false;
  try {
    const shouldSkip = window.sessionStorage.getItem(SKIP_AUTO_OPEN_KEY) === 'true';
    if (shouldSkip) window.sessionStorage.removeItem(SKIP_AUTO_OPEN_KEY);
    return shouldSkip;
  } catch {
    return false;
  }
}

function LoadingState() {
  return (
    <section className="together-card together-restoring-card" aria-live="polite">
      <span className="together-spinner" aria-hidden="true" />
      <p>Opening your church…</p>
    </section>
  );
}

export default function Together({ onEnterOrganization }) {
  const [viewState, setViewState] = useState(VIEW_STATES.NOT_CONNECTED);
  const [restoring, setRestoring] = useState(true);
  const [code, setCode] = useState('');
  const [previewEcosystem, setPreviewEcosystem] = useState(null);
  const [retryType, setRetryType] = useState('check');
  const inputRef = useRef(null);
  const openedOrganizationRef = useRef('');

  const isBusy = viewState === VIEW_STATES.VALIDATING_CODE || viewState === VIEW_STATES.JOINING;

  function openOrganization(organization) {
    if (!organization?.id || openedOrganizationRef.current === organization.id) return;
    openedOrganizationRef.current = organization.id;
    onEnterOrganization?.(organization);
  }

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

      if (consumeSkipAutoOpen()) {
        setRestoring(false);
        return;
      }

      openOrganization(result.data);
    }

    restoreConnection();
    return () => { cancelled = true; };
  }, []);

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
    openedOrganizationRef.current = '';
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
      setPreviewEcosystem(null);
      openOrganization(result.data);
      return;
    }
    if (result.error.code === 'MEMBER_LIMIT_REACHED') {
      setViewState(VIEW_STATES.MEMBER_LIMIT_REACHED);
      return;
    }
    setViewState(VIEW_STATES.GENERAL_ERROR);
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
        openOrganization(result.data);
        return;
      }
      if (result.ok) setViewState(VIEW_STATES.NOT_CONNECTED);
      else setViewState(VIEW_STATES.GENERAL_ERROR);
      setRestoring(false);
      return;
    }
    await validateCode();
  }

  if (restoring) return <LoadingState />;

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
          <p className="together-control-note">After joining, you can choose whether your rhythm is visible only to you, selected groups, ministries, or the whole church.</p>
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
        <p className="panel-intro">Please try again. Your device profile has not been changed.</p>
        <section className="together-card together-message-card" role="alert">
          <span className="together-message-icon" aria-hidden="true">!</span>
          <p>Your existing local information remains unchanged.</p>
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
      <p className="panel-intro">Enter the church code once. After joining, the Church tab opens your church directly.</p>
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
