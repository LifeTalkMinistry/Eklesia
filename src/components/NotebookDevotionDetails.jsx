import { useState } from 'react';

export default function NotebookDevotionDetails({
  initialValues,
  onSave,
  onBack,
  onCancel,
  saving = false,
  error = '',
}) {
  const [reference, setReference] = useState(initialValues?.reference || '');
  const [title, setTitle] = useState(initialValues?.title || '');
  const [note, setNote] = useState(initialValues?.note || '');

  function submit(event) {
    event.preventDefault();
    onSave?.({ reference, title, note });
  }

  return (
    <main className="devotion-shell notebook-flow-shell">
      <div className="devotion-frame notebook-flow-frame">
        <header className="devotion-header">
          <button className="icon-button" type="button" onClick={onBack} aria-label="Back to notebook photo">←</button>
          <div><p>NOTEBOOK DEVOTION</p><h1>Add a few details</h1></div>
        </header>

        <form className="notebook-details-form" onSubmit={submit}>
          <div className="notebook-field">
            <label htmlFor="notebook-reference">Scripture reference <span>Optional</span></label>
            <input
              id="notebook-reference"
              type="text"
              maxLength="80"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Example: Luke 1:37"
            />
            <small>{reference.length}/80</small>
          </div>

          <div className="notebook-field">
            <label htmlFor="notebook-title">Title <span>Optional</span></label>
            <input
              id="notebook-title"
              type="text"
              maxLength="100"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Example: Nothing is impossible with God"
            />
            <small>{title.length}/100</small>
          </div>

          <div className="notebook-field">
            <label htmlFor="notebook-note">Personal note <span>Optional</span></label>
            <textarea
              id="notebook-note"
              rows="4"
              maxLength="300"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Add a short note about this devotion"
            />
            <small>{note.length}/300</small>
          </div>

          <p className="notebook-details-clarification">The personal note is optional and is separate from the photographed handwritten reflection.</p>
          <p className="notebook-privacy-panel">Your notebook image and note remain private on this device. Members in Together will only see the same general daily activity signal.</p>
          {error ? <p className="form-message error-message" role="alert">{error}</p> : null}

          <div className="notebook-flow-actions">
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? 'Saving notebook devotion…' : 'Save notebook devotion'}
            </button>
            <button className="secondary-button" type="button" onClick={onBack} disabled={saving}>Back to photo</button>
            <button className="notebook-text-button" type="button" onClick={onCancel} disabled={saving}>Cancel</button>
          </div>
          <p className="notebook-save-status" aria-live="polite">{saving ? 'Saving notebook devotion…' : ''}</p>
        </form>
      </div>
    </main>
  );
}
