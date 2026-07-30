import { useEffect, useRef, useState } from 'react';
import {
  disconnectBackendAccount,
  inspectBackendConnection,
  loginBackendAccount,
  registerBackendAccount,
  restoreBackendSession,
} from '../services/backendSessionService.js';
import { synchronizeNow } from '../services/sync/syncCoordinator.js';
import {
  getSyncConflicts,
  resolveSyncConflict,
  summarizeConflictVersion,
} from '../services/sync/syncConflictService.js';
import {
  getSyncState,
  SYNC_STATE_CHANGED_EVENT,
} from '../services/sync/syncStateService.js';
import AccessibleDialog from './AccessibleDialog.jsx';
import './BackendConnectionDialog.css';

function syncLabel(state) {
  if (state.status === 'syncing') return 'Syncing';
  if (state.status === 'offline') return 'Offline — changes saved on this device';
  if (state.status === 'attention') return 'Needs attention';
  if (state.status === 'synced') return 'Synced';
  return 'Ready to sync';
}

function ConflictVersion({ label, version }) {
  const summary = summarizeConflictVersion(version);
  const fields = [
    ['Reflection', summary.reflection],
    ['Word', summary.word],
    ['Gratitude', summary.gratitude],
    ['Application', summary.application],
    ['Prayer', summary.prayer],
  ].filter(([, value]) => value);

  return (
    <article className="sync-conflict-version">
      <strong>{label}</strong>
      <small>{summary.reference}</small>
      {fields.length ? fields.map(([field, value]) => (
        <p key={field}><b>{field}:</b> {value}</p>
      )) : <p>No private writing in this version.</p>}
    </article>
  );
}

export default function BackendConnectionDialog({ open, onClose, triggerRef, localProfile, onSessionChanged }) {
  const [connection, setConnection] = useState({ configured: false, online: false });
  const [session, setSession] = useState(null);
  const [syncState, setSyncState] = useState(getSyncState);
  const [conflicts, setConflicts] = useState([]);
  const [resolvingId, setResolvingId] = useState('');
  const [mode, setMode] = useState('login');
  const [name, setName] = useState(localProfile?.displayName || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const emailRef = useRef(null);

  async function refreshConflicts() {
    try {
      const nextConflicts = await getSyncConflicts();
      setConflicts(nextConflicts);
      return nextConflicts;
    } catch (error) {
      setMessage(error.message || 'Sync conflicts could not be loaded.');
      return [];
    }
  }

  useEffect(() => {
    function handleSyncState(event) {
      setSyncState(event.detail?.state || getSyncState());
    }
    window.addEventListener(SYNC_STATE_CHANGED_EVENT, handleSyncState);
    return () => window.removeEventListener(SYNC_STATE_CHANGED_EVENT, handleSyncState);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;

    async function loadConnection() {
      setBusy(true);
      setMessage('');
      const status = await inspectBackendConnection();
      if (cancelled) return;
      setConnection(status);

      if (status.configured && status.online) {
        const restored = await restoreBackendSession();
        if (!cancelled && restored.ok) {
          setSession(restored.session);
          const nextConflicts = await getSyncConflicts().catch(() => []);
          if (!cancelled) setConflicts(nextConflicts);
        }
      }
      if (!cancelled) {
        setSyncState(getSyncState());
        setBusy(false);
      }
    }

    setName(localProfile?.displayName || '');
    loadConnection();
    return () => { cancelled = true; };
  }, [open, localProfile?.displayName]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const result = mode === 'register'
        ? await registerBackendAccount({ name, email, password })
        : await loginBackendAccount({ email, password });
      setSession(result.session);
      setPassword('');
      setMessage('Your Ekklesia account is connected on this device.');
      onSessionChanged?.(result.session);
      await refreshConflicts();
    } catch (error) {
      setMessage(error.message || 'The account could not be connected.');
    } finally {
      setBusy(false);
    }
  }

  async function syncNow() {
    setMessage('');
    const result = await synchronizeNow({ reason: 'manual' });
    await refreshConflicts();
    if (!result.ok && result.error) setMessage(result.error.message || 'Sync needs attention.');
  }

  async function resolveConflict(conflict, resolution) {
    setResolvingId(conflict.id);
    setMessage('');
    try {
      await resolveSyncConflict(conflict, resolution);
      await refreshConflicts();
      setMessage('The private devotion conflict was resolved.');
      window.location.reload();
    } catch (error) {
      setMessage(error.message || 'The private devotion conflict could not be resolved.');
      setResolvingId('');
    }
  }

  function signOut() {
    disconnectBackendAccount();
    setSession(null);
    setConflicts([]);
    setMessage('You have been signed out on this device.');
    onSessionChanged?.(null);
    onClose?.();
  }

  const statusLabel = !connection.configured
    ? 'Not configured'
    : connection.online ? 'Backend online' : 'Backend unavailable';

  return (
    <AccessibleDialog
      open={open}
      onRequestClose={onClose}
      triggerRef={triggerRef}
      labelledBy="backend-connection-title"
      describedBy="backend-connection-description"
      initialFocusRef={emailRef}
    >
      <div className="alpha-dialog-topline">
        <div>
          <p className="dashboard-eyebrow">Account connection</p>
          <h2 id="backend-connection-title">Your Ekklesia account</h2>
        </div>
        <button className="alpha-dialog-close" type="button" onClick={onClose} aria-label="Close account connection">×</button>
      </div>

      <p id="backend-connection-description" className="alpha-dialog-copy">
        Your account restores church membership and synchronized account data while keeping local-first access available offline.
      </p>

      <section className={`backend-status-card ${connection.online ? 'is-online' : ''}`} aria-live="polite">
        <span aria-hidden="true" />
        <div><strong>{statusLabel}</strong><small>{connection.configured ? 'Secure API connection' : 'VITE_API_BASE_URL is missing from this deployment'}</small></div>
      </section>

      {!connection.configured ? (
        <p className="alpha-inline-message" role="status">
          Add the backend HTTPS address as <code>VITE_API_BASE_URL</code>, rebuild the app, and allow this site’s origin in the backend CORS settings.
        </p>
      ) : session ? (
        <section className="backend-account-card">
          <p className="dashboard-eyebrow">Signed-in account</p>
          <h3>{session.profile?.displayName || session.user?.name}</h3>
          <p>{session.user?.email}</p>
          <dl>
            <div><dt>Church</dt><dd>{session.church?.name || 'Not joined yet'}</dd></div>
            <div><dt>Sync</dt><dd>{syncLabel(syncState)}</dd></div>
            <div><dt>Pending</dt><dd>{syncState.pendingCount || 0}</dd></div>
            <div><dt>Needs review</dt><dd>{conflicts.length}</dd></div>
            <div><dt>Last synced</dt><dd>{syncState.lastSyncedAt ? new Date(syncState.lastSyncedAt).toLocaleString() : 'Not yet'}</dd></div>
          </dl>
          {syncState.lastError ? <p className="alpha-inline-message" role="status">{syncState.lastError}</p> : null}

          {conflicts.length ? (
            <section className="sync-conflict-list" aria-label="Private devotion conflicts">
              <div>
                <p className="dashboard-eyebrow">Needs review</p>
                <h4>Choose which private version to keep</h4>
                <p>Only you can see these WGAP and reflection details.</p>
              </div>
              {conflicts.map((conflict) => (
                <article className="sync-conflict-card" key={conflict.id}>
                  <ConflictVersion label="This device" version={conflict.submitted} />
                  <ConflictVersion label="Server version" version={conflict.canonical} />
                  <div className="sync-conflict-actions">
                    <button
                      className="primary-button"
                      type="button"
                      disabled={Boolean(resolvingId)}
                      onClick={() => resolveConflict(conflict, 'keep_local')}
                    >
                      {resolvingId === conflict.id ? 'Resolving…' : 'Keep this device version'}
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={Boolean(resolvingId)}
                      onClick={() => resolveConflict(conflict, 'keep_server')}
                    >
                      Use server version
                    </button>
                  </div>
                </article>
              ))}
            </section>
          ) : null}

          <button className="primary-button" type="button" onClick={syncNow} disabled={syncState.status === 'syncing'}>
            {syncState.status === 'syncing' ? 'Syncing…' : 'Sync now'}
          </button>
          <button className="secondary-button" type="button" onClick={signOut}>Sign out this device</button>
        </section>
      ) : (
        <form className="backend-auth-form" onSubmit={submit}>
          <div className="backend-auth-switch" role="tablist" aria-label="Account action">
            <button type="button" className={mode === 'login' ? 'is-active' : ''} onClick={() => setMode('login')}>Log in</button>
            <button type="button" className={mode === 'register' ? 'is-active' : ''} onClick={() => setMode('register')}>Create account</button>
          </div>
          {mode === 'register' ? <label>Name<input value={name} onChange={(event) => setName(event.target.value)} minLength="2" maxLength="100" required /></label> : null}
          <label>Email<input ref={emailRef} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength="8" required /></label>
          <button className="primary-button" type="submit" disabled={busy || !connection.online}>{busy ? 'Connecting…' : mode === 'register' ? 'Create account' : 'Log in'}</button>
        </form>
      )}

      {message ? <p className="alpha-inline-message" role="status">{message}</p> : null}
    </AccessibleDialog>
  );
}
