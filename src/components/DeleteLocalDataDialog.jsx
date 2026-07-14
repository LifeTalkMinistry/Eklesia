import { useEffect, useRef, useState } from 'react';
import AccessibleDialog from './AccessibleDialog.jsx';

const DELETED_ITEMS = [
  'Local profile',
  'Devotion history',
  'WGAP reflections',
  'Journey entries',
  'Bible reading position',
  'Joined demo-circle state',
  'Alpha acknowledgement',
  'Onboarding state',
];

export default function DeleteLocalDataDialog({ open, onClose, onDelete, triggerRef }) {
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setConfirmation('');
    setMessage('');
  }, [open]);

  function confirmDelete() {
    if (confirmation !== 'DELETE') return;
    const result = onDelete();
    if (!result?.ok) {
      setMessage(result?.message || 'Some local data could not be removed. Please try again.');
    }
  }

  return (
    <AccessibleDialog
      open={open}
      onRequestClose={onClose}
      triggerRef={triggerRef}
      labelledBy="delete-local-data-title"
      describedBy="delete-local-data-description"
      initialFocusRef={cancelRef}
      className="alpha-dialog-danger"
    >
      <p className="dashboard-eyebrow">Data controls</p>
      <h2 id="delete-local-data-title">Delete Ekklesia Pulse data from this device?</h2>
      <p id="delete-local-data-description" className="alpha-dialog-copy">This will permanently remove the information Ekklesia Pulse saved in this browser.</p>
      <ul className="alpha-delete-list">
        {DELETED_ITEMS.map((item) => <li key={item}>{item}</li>)}
      </ul>
      <p className="alpha-danger-note">This cannot be undone because Ekklesia Pulse does not yet have a cloud backup.</p>

      <div className="alpha-field">
        <label htmlFor="delete-confirmation">Type DELETE to confirm</label>
        <input
          id="delete-confirmation"
          type="text"
          autoComplete="off"
          value={confirmation}
          onChange={(event) => {
            setConfirmation(event.target.value);
            setMessage('');
          }}
        />
      </div>
      {message ? <p className="alpha-inline-message" role="alert">{message}</p> : null}
      <div className="alpha-dialog-actions">
        <button ref={cancelRef} className="secondary-button" type="button" onClick={onClose}>Cancel</button>
        <button className="alpha-danger-button" type="button" onClick={confirmDelete} disabled={confirmation !== 'DELETE'}>Delete local data</button>
      </div>
    </AccessibleDialog>
  );
}
