import { useEffect, useState } from 'react';
import { getVerseContext } from '../data/verseContexts.js';
import { getBibleVerse } from '../lib/bible.js';
import './DevotionContext.css';

const WGAP_FIELDS = [
  {
    key: 'gratitude',
    letter: 'G',
    label: 'Gets Ko',
    placeholder: 'What did you understand or receive from this passage?',
    rows: 4,
  },
  {
    key: 'application',
    letter: 'A',
    label: 'Application',
    placeholder: 'What specific response will you carry into your life?',
    rows: 4,
  },
  {
    key: 'prayer',
    letter: 'P',
    label: 'Prayer',
    placeholder: 'Write your honest prayer to God...',
    rows: 5,
  },
];

export default function Devotion({
  devotion,
  wgap,
  setWgap,
  completed,
  completionType,
  isSaving,
  onComplete,
  onViewSaved,
  onReturnHome,
  onSpendMore,
  onBack,
  onReadChapter,
}) {
  const [message, setMessage] = useState('');
  const [reviewVerseText, setReviewVerseText] = useState('');
  const [reviewVerseError, setReviewVerseError] = useState('');
  const [showContext, setShowContext] = useState(false);

  const isAdditional = devotion?.flowType === 'additional' || completionType === 'additional';
  const devotionLabel = isAdditional ? 'Additional devotion' : 'Today’s devotion';
  const verseStart = devotion?.verseStart ?? devotion?.startVerse ?? devotion?.verse;
  const verseEnd = devotion?.verseEnd ?? devotion?.endVerse ?? verseStart;
  const isSelectedPassage = Boolean(verseStart && verseEnd > verseStart);
  const shouldCompactCompletedPassage = Boolean(completed && isSelectedPassage);

  useEffect(() => {
    setShowContext(false);
  }, [devotion?.reference]);

  useEffect(() => {
    let cancelled = false;
    setReviewVerseText('');
    setReviewVerseError('');

    if (
      !shouldCompactCompletedPassage
      || !devotion?.bookSlug
      || !devotion?.chapter
      || !verseStart
    ) {
      return () => { cancelled = true; };
    }

    getBibleVerse(devotion.bookSlug, devotion.chapter, verseStart)
      .then(({ verse }) => {
        if (!cancelled) setReviewVerseText(verse.text);
      })
      .catch((error) => {
        console.error('Completed devotion verse preview could not be loaded', error);
        if (!cancelled) {
          setReviewVerseError('The verse preview could not be loaded here. Open the highlighted passage below.');
        }
      });

    return () => { cancelled = true; };
  }, [shouldCompactCompletedPassage, devotion?.bookSlug, devotion?.chapter, verseStart]);

  function updateField(field, value) {
    setWgap((current) => ({ ...current, [field]: value }));
    if (message) setMessage('');
  }

  function submitDevotion(event) {
    event.preventDefault();
    const hasResponse = WGAP_FIELDS.some((field) => wgap[field.key]?.trim());
    if (!hasResponse) {
      setMessage('Write at least one honest WGAP response before saving your devotion.');
      return;
    }
    setMessage('');
    onComplete();
  }

  if (!devotion) {
    return <main className="devotion-shell"><div className="devotion-frame"><header className="devotion-header"><button className="icon-button" type="button" onClick={onBack} aria-label="Back to dashboard">←</button><div><p>Personal devotion</p><strong>Scripture unavailable</strong></div></header><p className="page-error" role="alert">The selected Scripture could not be loaded. Please return and choose a verse again.</p></div></main>;
  }

  const savedScriptureText = devotion.scriptureText || devotion.fullText || devotion.previewText || devotion.text;
  const scripturePreview = shouldCompactCompletedPassage
    ? reviewVerseText || devotion.previewText || ''
    : savedScriptureText;
  const passageButtonLabel = shouldCompactCompletedPassage
    ? 'View highlighted verses'
    : isSelectedPassage ? 'Read selected passage' : 'Read full chapter';
  const verseContext = getVerseContext(devotion);

  return (
    <main className="devotion-shell">
      <div className="devotion-frame">
        <header className="devotion-header"><button className="icon-button" type="button" onClick={onBack} aria-label="Back to dashboard">←</button><div><p>{devotionLabel}</p><strong>WGAP Devotion</strong></div></header>

        {isAdditional && !completed && (
          <p className="devotion-context-note">Your daily rhythm is already complete. This devotion will be added to Journey.</p>
        )}

        <article className={`scripture-card wgap-word-card ${showContext ? 'is-context-view' : ''}`}>
          {showContext ? (
            <>
              <div className="wgap-section-title">
                <span className="wgap-letter">C</span>
                <div>
                  <strong>Verse context</strong>
                  <p className="dashboard-eyebrow">{devotion.reference} · BSB</p>
                </div>
              </div>
              <p className="inline-verse-context-kicker">What is happening here?</p>
              <p className="inline-verse-context-copy">{verseContext}</p>
              <button className="secondary-button inline-context-back" type="button" onClick={() => setShowContext(false)}>
                <span aria-hidden="true">←</span>
                Back to verse
              </button>
            </>
          ) : (
            <>
              <div className="wgap-section-title">
                <span className="wgap-letter">W</span>
                <div>
                  <strong>Word of God</strong>
                  <p className="dashboard-eyebrow">{devotion.reference} · BSB</p>
                </div>
              </div>
              {scripturePreview ? (
                <blockquote>“{scripturePreview}”</blockquote>
              ) : shouldCompactCompletedPassage && !reviewVerseError ? (
                <p className="status-message" role="status">Loading the starting verse…</p>
              ) : null}
              {reviewVerseError && <p className="status-message error-message" role="alert">{reviewVerseError}</p>}
              <div className="scripture-card-actions">
                <button className="secondary-button" type="button" onClick={onReadChapter}>{passageButtonLabel}</button>
                <button className="secondary-button" type="button" onClick={() => setShowContext(true)}>
                  Understand context
                </button>
              </div>
            </>
          )}
        </article>

        <form className="wgap-form" onSubmit={submitDevotion}>
          {WGAP_FIELDS.map((field) => (
            <section className="wgap-field" key={field.key}>
              <div className="wgap-section-title">
                <span className="wgap-letter">{field.letter}</span>
                <label htmlFor={`wgap-${field.key}`}>{field.label}</label>
              </div>
              <textarea
                id={`wgap-${field.key}`}
                value={wgap[field.key] || ''}
                onChange={(event) => updateField(field.key, event.target.value)}
                placeholder={field.placeholder}
                rows={field.rows}
                readOnly={completed}
              />
            </section>
          ))}

          {message && <p className="form-message error-message" role="alert">{message}</p>}

          {completed ? (
            <section className="devotion-complete-card" aria-live="polite">
              <div className="devotion-complete-message">
                <span aria-hidden="true">✓</span>
                <div>
                  <strong>{completionType === 'additional' ? 'Additional devotion saved' : 'Daily rhythm complete'}</strong>
                  <p>{completionType === 'additional'
                    ? 'Your daily rhythm was already complete. This reflection has been added to your Journey.'
                    : 'You made room for God today. Your reflection has been saved.'}</p>
                </div>
              </div>
              <div className="devotion-complete-actions">
                <button className="primary-button" type="button" onClick={onViewSaved}>View in Journey</button>
                <button className="secondary-button" type="button" onClick={onReturnHome}>Return home</button>
                <button className="secondary-button" type="button" onClick={onSpendMore}>Spend more time in the Word</button>
              </div>
            </section>
          ) : (
            <button className="primary-button submit-button" type="submit" disabled={isSaving}>{isSaving ? 'Saving reflection…' : isAdditional ? 'Save additional devotion' : 'Complete today’s devotion'}</button>
          )}
        </form>
      </div>
    </main>
  );
}
