import { useEffect, useMemo, useState } from 'react';
import { getVerseContext } from '../data/verseContexts.js';
import { getBibleVerse } from '../lib/bible.js';
import { getWeeklyRhythm } from '../services/devotionService.js';
import './DevotionContext.css';

const WGAP_FIELDS = [
  {
    key: 'gratitude',
    letter: 'G',
    label: 'Gets Ko',
    placeholder: 'What did you understand or receive from this passage?',
  },
  {
    key: 'application',
    letter: 'A',
    label: 'Application',
    placeholder: 'What specific response will you carry into your life?',
  },
  {
    key: 'prayer',
    letter: 'P',
    label: 'Prayer',
    placeholder: 'Write your honest prayer to God...',
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
  const [menuOpen, setMenuOpen] = useState(false);

  const isAdditional = devotion?.flowType === 'additional' || completionType === 'additional';
  const weeklyRhythm = useMemo(() => getWeeklyRhythm(), [completed, devotion?.reference]);
  const verseStart = devotion?.verseStart ?? devotion?.startVerse ?? devotion?.verse;
  const verseEnd = devotion?.verseEnd ?? devotion?.endVerse ?? verseStart;
  const isSelectedPassage = Boolean(verseStart && verseEnd > verseStart);
  const shouldCompactCompletedPassage = Boolean(completed && isSelectedPassage);

  useEffect(() => {
    setShowContext(false);
    setMenuOpen(false);
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
    return (
      <main className="devotion-shell devotion-writing-shell">
        <div className="devotion-frame devotion-writing-frame">
          <header className="devotion-writing-topbar">
            <span />
            <button className="devotion-writing-close" type="button" onClick={onBack} aria-label="Close devotion">×</button>
          </header>
          <p className="page-error" role="alert">The selected Scripture could not be loaded. Please return and choose a verse again.</p>
        </div>
      </main>
    );
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
    <main className="devotion-shell devotion-writing-shell">
      <div className="devotion-frame devotion-writing-frame">
        <header className="devotion-writing-topbar">
          <div
            className="devotion-week-rhythm"
            aria-label={`${weeklyRhythm.weeklyCount} of 7 devotional days completed this week`}
          >
            {weeklyRhythm.week.map((day) => (
              <span
                className={`devotion-week-dot ${day.complete ? 'is-complete' : ''} ${day.isToday ? 'is-today' : ''} ${day.isFuture ? 'is-future' : ''}`}
                key={day.dateKey}
                aria-label={`${day.label}: ${day.complete ? 'devotion completed' : day.isFuture ? 'upcoming' : 'not completed'}`}
                aria-current={day.isToday ? 'date' : undefined}
              />
            ))}
          </div>
          <div className="devotion-writing-actions">
            <button
              className="devotion-writing-more"
              type="button"
              aria-label="More devotion actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((current) => !current)}
            >
              <span aria-hidden="true">•••</span>
            </button>
            <button className="devotion-writing-close" type="button" onClick={onBack} aria-label="Close devotion">×</button>
          </div>

          {menuOpen ? (
            <div className="devotion-writing-menu" role="menu" aria-label="Devotion actions">
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onReadChapter(); }}>{passageButtonLabel}</button>
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setShowContext((current) => !current); }}>
                {showContext ? 'Show verse' : 'Understand context'}
              </button>
            </div>
          ) : null}
        </header>

        <div className="devotion-writing-scroll">
          {isAdditional && !completed ? (
            <p className="devotion-writing-note">Your daily rhythm is already complete. This devotion will be added to Journey.</p>
          ) : null}

          <section className="devotion-writing-section devotion-word-section" aria-labelledby="devotion-word-heading">
            <div className="devotion-writing-section-heading">
              <span className="devotion-writing-letter" aria-hidden="true">W</span>
              <div>
                <small>Word of God</small>
                <strong id="devotion-word-heading">{devotion.reference} · BSB</strong>
              </div>
            </div>

            {showContext ? (
              <div className="devotion-context-surface">
                <p className="inline-verse-context-kicker">What is happening here?</p>
                <p className="inline-verse-context-copy">{verseContext}</p>
                <button className="devotion-inline-action" type="button" onClick={() => setShowContext(false)}>← Back to verse</button>
              </div>
            ) : (
              <>
                {scripturePreview ? (
                  <blockquote>“{scripturePreview}”</blockquote>
                ) : shouldCompactCompletedPassage && !reviewVerseError ? (
                  <p className="status-message" role="status">Loading the starting verse…</p>
                ) : null}
                {reviewVerseError ? <p className="status-message error-message" role="alert">{reviewVerseError}</p> : null}
                <div className="devotion-word-actions">
                  <button className="devotion-inline-action" type="button" onClick={onReadChapter}>{passageButtonLabel}</button>
                  <button className="devotion-inline-action" type="button" onClick={() => setShowContext(true)}>Understand context</button>
                </div>
              </>
            )}
          </section>

          <form id="wgap-devotion-form" className="devotion-writing-form" onSubmit={submitDevotion}>
            {WGAP_FIELDS.map((field) => (
              <section className="devotion-writing-section devotion-response-section" key={field.key}>
                <div className="devotion-writing-section-heading">
                  <span className="devotion-writing-letter" aria-hidden="true">{field.letter}</span>
                  <div>
                    <small>{field.label}</small>
                    <label htmlFor={`wgap-${field.key}`}>{field.placeholder}</label>
                  </div>
                </div>
                <textarea
                  id={`wgap-${field.key}`}
                  value={wgap[field.key] || ''}
                  onChange={(event) => updateField(field.key, event.target.value)}
                  placeholder="Start writing…"
                  readOnly={completed}
                />
              </section>
            ))}

            {message ? <p className="devotion-writing-message error-message" role="alert">{message}</p> : null}

            {completed ? (
              <section className="devotion-complete-card devotion-writing-complete" aria-live="polite">
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
            ) : null}
          </form>
        </div>

        <footer className="devotion-writing-toolbar">
          <div className="devotion-writing-progress" aria-label="WGAP sections">
            <span className="is-word">W</span>
            <span className={wgap.gratitude?.trim() ? 'is-filled' : ''}>G</span>
            <span className={wgap.application?.trim() ? 'is-filled' : ''}>A</span>
            <span className={wgap.prayer?.trim() ? 'is-filled' : ''}>P</span>
          </div>
          {completed ? (
            <span className="devotion-writing-saved">Saved</span>
          ) : (
            <button className="devotion-writing-submit" type="submit" form="wgap-devotion-form" disabled={isSaving}>
              {isSaving ? 'Saving…' : isAdditional ? 'Save devotion' : 'Complete devotion'}
            </button>
          )}
        </footer>
      </div>
    </main>
  );
}
