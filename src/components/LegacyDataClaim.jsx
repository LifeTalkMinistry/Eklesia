import { useState } from 'react';
import './LegacyDataClaim.css';

function CountCard({ label, value }) {
  return (
    <article className="legacy-claim-count">
      <strong>{Number(value) || 0}</strong>
      <span>{label}</span>
    </article>
  );
}

export default function LegacyDataClaim({ snapshot, accountName, onImport, onKeepDeviceOnly, onReviewLater }) {
  const [workingAction, setWorkingAction] = useState('');
  const [error, setError] = useState('');
  const counts = snapshot?.counts || {};

  async function run(action, handler) {
    if (workingAction) return;
    setWorkingAction(action);
    setError('');
    try {
      await handler();
    } catch (nextError) {
      setError(nextError?.message || 'The existing data could not be handled safely.');
      setWorkingAction('');
    }
  }

  return (
    <main className="legacy-claim-shell">
      <section className="legacy-claim-card" aria-labelledby="legacy-claim-title">
        <p className="eyebrow">Account safety</p>
        <h1 id="legacy-claim-title">Existing Ekklesia data was found on this device.</h1>
        <p>
          Choose whether this older local data belongs to <strong>{accountName || 'this signed-in account'}</strong>.
          Nothing will be deleted automatically.
        </p>

        <div className="legacy-claim-grid" aria-label="Existing local data summary">
          <CountCard label="devotion entries" value={counts.devotions} />
          <CountCard label="notebook devotions" value={counts.notebookDevotions} />
          <CountCard label="conversations" value={counts.conversations} />
          <CountCard label="attachments" value={counts.attachments} />
        </div>

        {error ? <p className="legacy-claim-error" role="alert">{error}</p> : null}

        <div className="legacy-claim-actions">
          <button
            className="primary-button"
            type="button"
            disabled={Boolean(workingAction)}
            onClick={() => run('import', onImport)}
          >
            {workingAction === 'import' ? 'Preparing import…' : 'Import into this account'}
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={Boolean(workingAction)}
            onClick={() => run('device-only', onKeepDeviceOnly)}
          >
            {workingAction === 'device-only' ? 'Saving locally…' : 'Keep only on this device'}
          </button>
          <button
            className="legacy-claim-later"
            type="button"
            disabled={Boolean(workingAction)}
            onClick={onReviewLater}
          >
            Review later
          </button>
        </div>

        <small>
          Import keeps the original local copy until synchronized records are confirmed by the server.
          Device-only data remains private to this browser and this account.
        </small>
      </section>
    </main>
  );
}
