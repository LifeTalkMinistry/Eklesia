import { useState } from 'react';

const WGAP_FIELDS = [
  {
    key: 'getsKo',
    letter: 'G',
    label: 'Gets Ko',
    placeholder: 'Isulat kung ano ang malinaw na mensahe sa iyo...',
    rows: 4,
  },
  {
    key: 'application',
    letter: 'A',
    label: 'Application',
    placeholder: 'Isulat ang specific action na gagawin mo...',
    rows: 4,
  },
  {
    key: 'prayer',
    letter: 'P',
    label: 'Prayer',
    placeholder: 'Lord, tulungan Mo po ako na...',
    rows: 5,
  },
];

export default function Devotion({
  devotion,
  wgap,
  setWgap,
  completed,
  onComplete,
  onViewSaved,
  onReturnHome,
  onBack,
  onReadChapter,
}) {
  const [message, setMessage] = useState('');

  function updateField(field, value) {
    setWgap((current) => ({ ...current, [field]: value }));
    if (message) setMessage('');
  }

  function submitDevotion(event) {
    event.preventDefault();
    const missingFields = WGAP_FIELDS.filter((field) => !wgap[field.key]?.trim()).map((field) => field.label);

    if (missingFields.length) {
      setMessage(`Complete ${missingFields.join(', ')} before finishing your devotion.`);
      return;
    }

    setMessage('');
    onComplete();
  }

  if (!devotion) {
    return <main className="devotion-shell"><div className="devotion-frame"><header className="devotion-header"><button className="icon-button" type="button" onClick={onBack} aria-label="Back to dashboard">←</button><div><p>Personal devotion</p><strong>Scripture unavailable</strong></div></header><p className="page-error" role="alert">The selected Scripture could not be loaded. Please return and choose a verse again.</p></div></main>;
  }

  const devotionLabel = devotion.devotionType === 'personal' ? 'My chosen devotion' : 'Today’s suggested devotion';
  const isSelectedPassage = devotion.devotionType === 'personal' && devotion.endVerse > devotion.startVerse;
  const scripturePreview = devotion.previewText || devotion.text;

  return (
    <main className="devotion-shell">
      <div className="devotion-frame">
        <header className="devotion-header"><button className="icon-button" type="button" onClick={onBack} aria-label="Back to dashboard">←</button><div><p>{devotionLabel}</p><strong>WGAP Devotion</strong></div><span className="soft-badge">5 min</span></header>

        <article className="scripture-card wgap-word-card">
          <div className="wgap-section-title">
            <span className="wgap-letter">W</span>
            <div>
              <strong>Word of God</strong>
              <p className="dashboard-eyebrow">{devotion.reference} · BSB</p>
            </div>
          </div>
          <blockquote>“{scripturePreview}”</blockquote>
          <button className="secondary-button" type="button" onClick={onReadChapter}>{isSelectedPassage ? 'Read selected passage' : 'Read full chapter'}</button>
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
                <div><strong>Today&apos;s WGAP devotion is saved</strong><p>You can review it anytime from Journey.</p></div>
              </div>
              <div className="devotion-complete-actions">
                <button className="primary-button" type="button" onClick={onViewSaved}>View saved devotion</button>
                <button className="secondary-button" type="button" onClick={onReturnHome}>Return to Home</button>
              </div>
            </section>
          ) : (
            <button className="primary-button submit-button" type="submit">Complete today’s devotion</button>
          )}
        </form>
      </div>
    </main>
  );
}
