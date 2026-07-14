import NotebookDevotionOption from './NotebookDevotionOption.jsx';

export default function DevotionChoice({
  dailyVerse,
  loading,
  error,
  onBack,
  onUseSuggested,
  onChooseVerse,
  onCaptureNotebook,
}) {
  return (
    <main className="devotion-shell">
      <div className="devotion-frame choice-frame">
        <header className="devotion-header">
          <button className="icon-button" type="button" onClick={onBack} aria-label="Back to dashboard">←</button>
          <div>
            <p>Today&apos;s devotion</p>
            <strong>Choose your devotion</strong>
          </div>
        </header>

        <section className="devotion-choice" aria-label="Choose your devotion">
          <div className="devotion-choice-grid">
            <article className="devotion-option recommended-option">
              <div className="option-topline">
                <span className="soft-badge">Suggested</span>
                <span className="reading-time">5 min</span>
              </div>

              {loading && <p className="status-message" aria-live="polite">Preparing today&apos;s Scripture…</p>}
              {error && <p className="status-message error-message" role="alert">Today&apos;s suggested verse could not be loaded.</p>}

              {dailyVerse && (
                <>
                  <p className="verse-reference">{dailyVerse.reference} · BSB</p>
                  <h3>{dailyVerse.title}</h3>
                </>
              )}

              <button className="primary-button choice-action" type="button" onClick={onUseSuggested} disabled={!dailyVerse || loading}>
                Use suggested devotion
              </button>
            </article>

            <article className="devotion-option personal-option">
              <div className="personal-option-heading">
                <span className="option-icon" aria-hidden="true">✦</span>
                <div>
                  <p className="verse-reference">Your own passage</p>
                  <h3>Choose my own verse</h3>
                </div>
              </div>
              <p className="option-note">Pick any verse from the built-in BSB.</p>
              <button className="secondary-button choice-action" type="button" onClick={onChooseVerse}>
                Browse the Bible
              </button>
            </article>

            <NotebookDevotionOption onPhotoSelected={onCaptureNotebook} />
          </div>
        </section>
      </div>
    </main>
  );
}
