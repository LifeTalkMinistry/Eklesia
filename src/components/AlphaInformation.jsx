import { useRef, useState } from 'react';
import { APP_STAGE, APP_VERSION } from '../config/appConfig.js';
import AccessibleDialog from './AccessibleDialog.jsx';
import AlphaBadge from './AlphaBadge.jsx';
import WhyEklesia from './WhyEklesia.jsx';

function InformationContent({ detailed = false }) {
  return (
    <>
      <div className="alpha-information-heading">
        <div>
          <p className="eyebrow">PRIVATE ALPHA TEST</p>
          <h2>Before you begin</h2>
        </div>
        <AlphaBadge />
      </div>
      <p className="alpha-information-intro">
        Ekklesia Pulse is currently an early test version. Your devotion history, WGAP reflections, notebook photos, profile, and Bible reading position are stored only on this device.
      </p>

      <div className="alpha-information-grid">
        <article>
          <span aria-hidden="true">♡</span>
          <h3>Your reflections stay on this device</h3>
          <p>Notebook photos are saved only in this browser using device storage. They are not uploaded or synchronized.</p>
        </article>
        <article>
          <span aria-hidden="true">◎</span>
          <h3>Together is a demonstration</h3>
          <p>The people and activity shown in Together are prototype information. They are not live church-member accounts.</p>
        </article>
        <article>
          <span aria-hidden="true">⌫</span>
          <h3>Browser data can be removed</h3>
          <p>Clearing browser or site data, or using “Delete my local data,” may permanently remove notebook photos and other information saved by Ekklesia Pulse on this device.</p>
        </article>
      </div>

      {detailed ? (
        <div className="alpha-scope-grid">
          <section>
            <p className="dashboard-eyebrow">Current stage</p>
            <h3>{APP_STAGE}</h3>
            <p>Version {APP_VERSION}</p>
          </section>
          <section>
            <p className="dashboard-eyebrow">Available for testing</p>
            <ul>
              <li>Daily devotion</li>
              <li>WGAP reflection</li>
              <li>Private notebook devotion capture</li>
              <li>Additional devotion</li>
              <li>Bible reader</li>
              <li>Journey history</li>
              <li>Manila-time daily rhythm</li>
            </ul>
          </section>
          <section>
            <p className="dashboard-eyebrow">Not yet live</p>
            <ul>
              <li>Real church-member accounts</li>
              <li>Cross-device synchronization</li>
              <li>Notebook-photo cloud backup</li>
              <li>Live accountability data</li>
              <li>Password recovery</li>
              <li>Owner management</li>
              <li>Subscription billing</li>
            </ul>
          </section>
        </div>
      ) : null}
    </>
  );
}

export default function AlphaInformation({
  mode = 'onboarding',
  open = false,
  onContinue,
  onClose,
  triggerRef,
  storageAvailable = true,
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [showHeartBehindApp, setShowHeartBehindApp] = useState(false);
  const closeRef = useRef(null);

  if (mode === 'dialog') {
    return (
      <AccessibleDialog
        open={open}
        onRequestClose={onClose}
        triggerRef={triggerRef}
        labelledBy="alpha-information-dialog-title"
        initialFocusRef={closeRef}
        className="alpha-information-dialog"
      >
        <div className="alpha-dialog-topline">
          <h2 id="alpha-information-dialog-title">About the Private Alpha</h2>
          <button ref={closeRef} className="alpha-dialog-close" type="button" onClick={onClose} aria-label="Close Private Alpha information">×</button>
        </div>
        <InformationContent detailed />
        <button className="primary-button alpha-dialog-primary" type="button" onClick={onClose}>Done</button>
      </AccessibleDialog>
    );
  }

  if (showHeartBehindApp) {
    return <WhyEklesia mode="onboarding" onContinue={onContinue} />;
  }

  return (
    <main className="app-shell welcome-shell alpha-flow-shell">
      <section className="welcome-card alpha-information-card">
        <InformationContent />
        {!storageAvailable ? (
          <p className="alpha-storage-warning" role="status">
            This browser is currently preventing Ekklesia Pulse from saving information. You may explore the app, but your progress may not remain after closing it.
          </p>
        ) : null}
        <label className="alpha-acknowledgement">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          <span>I understand that this is a private alpha version and that my information is currently stored only on this device.</span>
        </label>
        <button
          className="primary-button"
          type="button"
          onClick={() => setShowHeartBehindApp(true)}
          disabled={!acknowledged}
        >
          Continue
        </button>
      </section>
    </main>
  );
}
