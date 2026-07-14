import { useEffect, useRef } from 'react';
import NotebookCapture from './NotebookCapture.jsx';

export default function AdditionalDevotionChooser({
  open,
  suggestion,
  suggestionLoading,
  suggestionError,
  lastLocation,
  onUseSuggestion,
  onShowAnother,
  onChooseBible,
  onContinueReading,
  onCaptureNotebook,
  onClose,
  triggerRef,
}) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => triggerRef?.current?.focus?.());
    };
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  return (
    <div
      className="additional-devotion-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="additional-devotion-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="additional-devotion-title"
        ref={dialogRef}
      >
        <header className="additional-devotion-heading">
          <div>
            <p className="dashboard-eyebrow">Continue in Scripture</p>
            <h2 id="additional-devotion-title">Spend more time in the Word</h2>
            <p>Your daily rhythm is complete. Choose how you would like to continue in Scripture.</p>
          </div>
          <button ref={closeButtonRef} className="icon-button" type="button" onClick={onClose} aria-label="Close additional devotion choices">×</button>
        </header>

        <div className="additional-devotion-grid">
          <article className="additional-choice-card">
            <span className="option-icon" aria-hidden="true">✦</span>
            <h3>Another suggested verse</h3>
            <p>Receive another passage from the curated Ekklesia Pulse verse collection.</p>
            {suggestionLoading && <p className="status-message" aria-live="polite">Preparing a Scripture suggestion…</p>}
            {suggestionError && <p className="form-message error-message" role="alert">{suggestionError}</p>}
            {suggestion && !suggestionLoading && (
              <div className="additional-suggestion-preview" aria-live="polite">
                <small>{suggestion.reference} · BSB</small>
                <strong>{suggestion.title}</strong>
              </div>
            )}
            <button className="primary-button chooser-action" type="button" onClick={onUseSuggestion} disabled={!suggestion || suggestionLoading}>Use this suggestion</button>
            <button className="text-button" type="button" onClick={onShowAnother} disabled={suggestionLoading}>Show another suggestion</button>
          </article>

          <article className="additional-choice-card">
            <span className="option-icon" aria-hidden="true">◇</span>
            <h3>Choose from the Bible</h3>
            <p>Select any book, chapter, verse, or short verse range for your personal devotion.</p>
            <button className="secondary-button chooser-action" type="button" onClick={onChooseBible}>Open the Bible</button>
          </article>

          <article className="additional-choice-card">
            <span className="option-icon" aria-hidden="true">→</span>
            <h3>Continue reading</h3>
            <p>Continue from the Bible chapter you were reading most recently.</p>
            {lastLocation ? (
              <>
                <div className="continue-location"><small>Recent location</small><strong>{lastLocation.bookName} {lastLocation.chapter}</strong></div>
                <button className="secondary-button chooser-action" type="button" onClick={onContinueReading}>Continue {lastLocation.bookName} {lastLocation.chapter}</button>
              </>
            ) : (
              <>
                <p className="empty-location">No recent Bible location yet.</p>
                <button className="secondary-button chooser-action" type="button" onClick={onChooseBible}>Open the Bible</button>
              </>
            )}
          </article>

          <article className="additional-choice-card additional-notebook-choice">
            <span className="option-icon" aria-hidden="true">▤</span>
            <p className="additional-choice-eyebrow">WRITTEN DEVOTION</p>
            <h3>Capture my notebook</h3>
            <p>Take a photo of your handwritten devotion and save it privately in Journey.</p>
            <NotebookCapture
              onFileSelected={onCaptureNotebook}
              buttonClassName="secondary-button chooser-action"
            />
            <small className="additional-notebook-privacy">Your notebook photo stays private on this device and will not appear in Together.</small>
          </article>
        </div>
      </section>
    </div>
  );
}
