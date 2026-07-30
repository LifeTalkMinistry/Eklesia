import { useEffect, useRef, useState } from 'react';
import { APP_NAME } from '../config/appConfig.js';
import {
  hasBackendSession,
  inspectBackendConnection,
  loginBackendAccount,
  registerBackendAccount,
  restoreBackendSession,
} from '../services/backendSessionService.js';
import {
  importLegacyDataIntoAccount,
  inspectLegacyDataClaim,
  keepLegacyDataOnDevice,
  reviewLegacyDataLater,
} from '../services/sync/legacyDataClaimService.js';
import {
  bootstrapAccountSync,
  installAutomaticSyncTriggers,
} from '../services/sync/syncCoordinator.js';
import LegacyDataClaim from './LegacyDataClaim.jsx';
import './AccountAccess.css';

function reloadWithAccountScope() {
  if (typeof window === 'undefined') return false;
  window.location.reload();
  return true;
}

export default function AccountAccess({ localProfile, onAuthenticated }) {
  const [connection, setConnection] = useState({ configured: false, online: false });
  const [mode, setMode] = useState('login');
  const [name, setName] = useState(localProfile?.displayName || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const [legacySnapshot, setLegacySnapshot] = useState(null);
  const [authenticatedSession, setAuthenticatedSession] = useState(null);
  const emailRef = useRef(null);

  async function continueAuthenticated(session, { freshLogin = false } = {}) {
    const snapshot = await inspectLegacyDataClaim();
    if (snapshot.needed) {
      setAuthenticatedSession(session);
      setLegacySnapshot(snapshot);
      setBusy(false);
      return;
    }

    installAutomaticSyncTriggers();
    void bootstrapAccountSync();
    if (freshLogin && reloadWithAccountScope()) return;
    onAuthenticated(session);
  }

  useEffect(() => {
    let cancelled = false;

    async function prepareAccountAccess() {
      setBusy(true);
      setMessage('');
      const status = await inspectBackendConnection();
      if (cancelled) return;
      setConnection(status);

      if (status.configured && status.online && hasBackendSession()) {
        const restored = await restoreBackendSession({ startSync: false });
        if (cancelled) return;
        if (restored.ok && restored.session) {
          await continueAuthenticated(restored.session);
          return;
        }
        setMessage('Your saved session has expired. Please log in again.');
      }

      if (!cancelled) {
        setBusy(false);
        window.requestAnimationFrame(() => emailRef.current?.focus());
      }
    }

    prepareAccountAccess();
    return () => { cancelled = true; };
    // Account preparation intentionally runs once for this mounted access screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      const result = mode === 'register'
        ? await registerBackendAccount({ name, email, password })
        : await loginBackendAccount({ email, password });
      setPassword('');
      await continueAuthenticated(result.session, { freshLogin: true });
    } catch (error) {
      setMessage(error.message || 'The account could not be accessed.');
      setBusy(false);
    }
  }

  async function finishLegacyDecision(action) {
    if (!legacySnapshot || !authenticatedSession) return;
    if (action === 'import') await importLegacyDataIntoAccount(legacySnapshot);
    else if (action === 'device-only') await keepLegacyDataOnDevice(legacySnapshot);
    else reviewLegacyDataLater(legacySnapshot);

    installAutomaticSyncTriggers();
    if (action === 'import') await bootstrapAccountSync();
    if (!reloadWithAccountScope()) onAuthenticated(authenticatedSession);
  }

  if (legacySnapshot && authenticatedSession) {
    return (
      <LegacyDataClaim
        snapshot={legacySnapshot}
        accountName={authenticatedSession.profile?.displayName || authenticatedSession.user?.name}
        onImport={() => finishLegacyDecision('import')}
        onKeepDeviceOnly={() => finishLegacyDecision('device-only')}
        onReviewLater={() => finishLegacyDecision('review-later')}
      />
    );
  }

  const statusLabel = !connection.configured
    ? 'Account server not configured'
    : connection.online ? 'Secure account server online' : 'Account server unavailable';

  return (
    <main className="app-shell account-access-shell">
      <section className="account-access-card" aria-labelledby="account-access-title">
        <div className="account-access-brand" aria-label={APP_NAME}>
          <span aria-hidden="true">E</span>
          <strong>{APP_NAME}</strong>
        </div>

        <header className="account-access-heading">
          <p className="eyebrow">Your church space</p>
          <h1 id="account-access-title">{mode === 'register' ? 'Create your account' : 'Welcome back'}</h1>
          <p>{mode === 'register'
            ? 'Create one secure identity for your church membership, messages, and calls.'
            : 'Log in to continue to your personal and church spaces.'}</p>
        </header>

        <section className={`account-access-status ${connection.online ? 'is-online' : ''}`} aria-live="polite">
          <span aria-hidden="true" />
          <div>
            <strong>{statusLabel}</strong>
            <small>{connection.configured
              ? 'Protected connection to the Ekklesia backend'
              : 'The deployment is missing VITE_API_BASE_URL'}</small>
          </div>
        </section>

        <div className="account-access-switch" role="tablist" aria-label="Account action">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'is-active' : ''} onClick={() => { setMode('login'); setMessage(''); }}>Log in</button>
          <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'is-active' : ''} onClick={() => { setMode('register'); setMessage(''); }}>Create account</button>
        </div>

        <form className="account-access-form" onSubmit={submit}>
          {mode === 'register' ? (
            <label>
              <span>Name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" minLength="2" maxLength="80" required />
            </label>
          ) : null}

          <label>
            <span>Email address</span>
            <input ref={emailRef} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" inputMode="email" required />
          </label>

          <label>
            <span>Password</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength="8" required />
          </label>

          <button className="primary-button account-access-submit" type="submit" disabled={busy || !connection.online}>
            {busy ? 'Checking account…' : mode === 'register' ? 'Create account' : 'Log in'}
          </button>
        </form>

        {!connection.configured ? (
          <p className="account-access-message" role="status">Connect the production backend before account access can be used.</p>
        ) : null}
        {message ? <p className="account-access-message" role="alert">{message}</p> : null}

        <p className="account-access-privacy">Your password is sent only to the configured Ekklesia backend over HTTPS. Account-owned local data is isolated per signed-in user and remains available offline.</p>
      </section>
    </main>
  );
}
