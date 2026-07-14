import { useEffect, useRef, useState } from 'react';
import { APP_NAME } from '../config/appConfig.js';
import { createSafeDiagnosticSummary } from '../services/testerToolsService.js';
import AccessibleDialog from './AccessibleDialog.jsx';

const CATEGORIES = [
  'Something is not working',
  'Something is confusing',
  'Design or usability',
  'Devotion experience',
  'Bible reader',
  'Together demo',
  'Other',
];

export default function FeedbackDialog({ open, onClose, triggerRef, currentSection = 'Profile' }) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [feedback, setFeedback] = useState('');
  const [attemptedAction, setAttemptedAction] = useState('');
  const [message, setMessage] = useState('');
  const [fallbackText, setFallbackText] = useState('');
  const feedbackRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setMessage('');
    setFallbackText('');
  }, [open]);

  function buildMessage() {
    if (!feedback.trim()) {
      setMessage('Describe what happened or what you would improve.');
      feedbackRef.current?.focus();
      return '';
    }
    return createSafeDiagnosticSummary({ category, feedback, attemptedAction, currentSection });
  }

  async function copyMessage(text) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard is unavailable.');
      await navigator.clipboard.writeText(text);
      setFallbackText('');
      setMessage('Feedback copied. Send it to the Ekklesia Pulse test coordinator.');
      return true;
    } catch (error) {
      console.warn('Feedback could not be copied automatically.', error);
      setFallbackText(text);
      setMessage('Feedback could not be copied automatically. You can select and copy it below.');
      return false;
    }
  }

  async function handleCopy() {
    const text = buildMessage();
    if (text) await copyMessage(text);
  }

  async function handleShare() {
    const text = buildMessage();
    if (!text) return;

    if (!navigator.share) {
      await copyMessage(text);
      return;
    }

    try {
      await navigator.share({ title: `${APP_NAME} alpha feedback`, text });
      setMessage('The device share sheet was opened for your alpha feedback.');
      setFallbackText('');
    } catch (error) {
      if (error?.name === 'AbortError') {
        setMessage('Sharing was cancelled. Your feedback has not been sent.');
        return;
      }
      console.warn('Feedback sharing failed.', error);
      await copyMessage(text);
    }
  }

  return (
    <AccessibleDialog
      open={open}
      onRequestClose={onClose}
      triggerRef={triggerRef}
      labelledBy="feedback-dialog-title"
      describedBy="feedback-privacy-note"
      initialFocusRef={feedbackRef}
      className="alpha-feedback-dialog"
    >
      <div className="alpha-dialog-topline">
        <div>
          <p className="dashboard-eyebrow">Private Alpha</p>
          <h2 id="feedback-dialog-title">Share alpha feedback</h2>
        </div>
        <button className="alpha-dialog-close" type="button" onClick={onClose} aria-label="Close feedback form">×</button>
      </div>

      <p id="feedback-privacy-note" className="alpha-privacy-note">Your private reflections, notebook images, Scripture references, titles, and notes are never added to this feedback automatically.</p>

      <div className="alpha-form alpha-dialog-form">
        <div className="alpha-field">
          <label htmlFor="feedback-category">Category</label>
          <select id="feedback-category" value={category} onChange={(event) => setCategory(event.target.value)}>
            {CATEGORIES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <div className="alpha-field">
          <label htmlFor="feedback-main">What happened or what would you improve?</label>
          <textarea
            ref={feedbackRef}
            id="feedback-main"
            rows="5"
            value={feedback}
            onChange={(event) => {
              setFeedback(event.target.value);
              setMessage('');
            }}
          />
        </div>
        <div className="alpha-field">
          <label htmlFor="feedback-attempt">What were you trying to do? <span className="alpha-optional">Optional</span></label>
          <textarea id="feedback-attempt" rows="3" value={attemptedAction} onChange={(event) => setAttemptedAction(event.target.value)} />
        </div>

        {fallbackText ? (
          <div className="alpha-field">
            <label htmlFor="feedback-fallback">Copy this feedback manually</label>
            <textarea id="feedback-fallback" rows="10" readOnly value={fallbackText} onFocus={(event) => event.target.select()} />
          </div>
        ) : null}
        <p className="alpha-inline-message" aria-live="polite">{message}</p>

        <div className="alpha-dialog-actions alpha-feedback-actions">
          <button className="primary-button" type="button" onClick={handleShare}>Share feedback</button>
          <button className="secondary-button" type="button" onClick={handleCopy}>Copy feedback</button>
        </div>
      </div>
    </AccessibleDialog>
  );
}
