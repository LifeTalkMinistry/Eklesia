export default function DevotionChoice({
  dailyVerse,
  loading,
  error,
  onBack,
  onUseSuggested,
  onChooseVerse,
}) {
  return (
    <main className="devotion-shell">
      <div className="devotion-frame choice-frame">
        <header className="devotion-header">
          <button className="icon-button" type="button" onClick={onBack} aria-label="Back to dashboard">←</button>
          <div>
            <p>Today&apos;s devotion</p>
            <strong>Choose how you want to begin</strong>
          </div>
        </header>

        <section className="devotion-choice" aria-labelledby="devotion-choice-title">
          <p className="dashboard-eyebrow">Your time with Scripture</p>
          <h2 id="devotion-choice-title">How would you like to reflect today?</h2>
          <p className="choice-intro">Use Eklesia&apos;s suggested verse, or choose a verse from the built-in Berean Standard Bible.</p>

          <div className="devotion-choice-grid">
            <article className="devotion-option recommended-option">
              <div className="option-topline">
                <span className="soft-badge">Suggested for today</span>
                <span className="reading-time">5 min</span>
              </div>

              {loading && <p className="status-message" aria-live="polite">Preparing today&apos;s Scripture…</p>}
              {error && <p className="status-message error-message" role="alert">Today&apos;s suggested verse could not be loaded.</p>}

              {dailyVerse && (
                <>
                  <p className="verse-reference">{dailyVerse.reference} · BSB</p>
                  <h3>{dailyVerse.title}</h3>
                  <p>{dailyVerse.theme} — {dailyVerse.prompt}</p>
                </>
              )}

              <button className="primary-button choice-action" type="button" onClick={onUseSuggested} disabled={!dailyVerse || loading}>
                Use today&apos;s suggested devotion
              </button>
            </article>

            <article className="devotion-option personal-option">
              <span className="option-icon" aria-hidden="true">✦</span>
              <p className="verse-reference">Personal Scripture reflection</p>
              <h3>Choose my own verse</h3>
              <p>Browse by testament, book, and chapter. Tap one exact BSB verse, then use it for your private devotion.</p>
              <button className="secondary-button choice-action" type="button" onClick={onChooseVerse}>
                Open the Bible and choose a verse
              </button>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
