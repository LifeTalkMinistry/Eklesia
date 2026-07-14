import { useRef, useState } from 'react';
import AccessibleDialog from './AccessibleDialog.jsx';

export default function RestartIntroductionDialog({ open, onClose, onRestart, triggerRef }) {
  const [message, setMessage] = useState('');
  const cancelRef = useRef(null);

  function restart() {
    const result = onRestart();
    if (!result?.ok) {
      setMessage(result?.message || 'The introduction could not be restarted on this device.');
    }
  }

  return (
    <AccessibleDialog
      open={open}
      onRequestClose={onClose}
      triggerRef={triggerRef}
      labelledBy="restart-introduction-title"
      describedBy="restart-introduction-description"
      initialFocusRef={cancelRef}
      className="alpha-dialog-small"
    >
      <p className="dashboard-eyebrow">Introduction controls</p>
      <h2 id="restart-introduction-title">Restart the introduction?</h2>
      <p id="restart-introduction-description" className="alpha-dialog-copy">
        You will return to the welcome screen and see the setup guidance again. Your profile, devotions, WGAP reflections, Bible position, and Journey history will remain saved.
      </p>
      {message ? <p className="alpha-inline-message" role="alert">{message}</p> : null}
      <div className="alpha-dialog-actions">
        <button ref={cancelRef} className="secondary-button" type="button" onClick={onClose}>Cancel</button>
        <button className="primary-button" type="button" onClick={restart}>Restart introduction</button>
      </div>
    </AccessibleDialog>
  );
}
