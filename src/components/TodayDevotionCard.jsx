export default function TodayDevotionCard({
  dailyVerse,
  officialDevotion,
  completed,
  loading,
  error,
  onStart,
  onReview,
  onSpendMore,
}) {
  if (dailyVerse && completed) {
    const reference = officialDevotion?.reference || dailyVerse.reference;
    return (
      <section className="today-card today-card-complete" aria-label="Today’s devotion is complete">
        <div className="completion-status-row">
          <span className="completion-check" aria-hidden="true">✓</span>
          <span className="completion-badge">Completed today</span>
        </div>

        <div className="completion-copy">
          <p className="verse-reference">{reference} · BSB</p>
          <h3>Devotion complete</h3>
        </div>

        <div className="additional-devotion-actions">
          <button className="card-button completion-review-button" type="button" onClick={onReview}>
            Review today’s devotion
            <span aria-hidden="true">→</span>
          </button>
          <button className="secondary-button spend-more-button" type="button" onClick={onSpendMore}>
            Spend more time in the Word
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="today-card" aria-busy={loading}>
      <div className="today-card-topline">
        <span className="soft-badge">Today&apos;s devotion</span>
        <span className="reading-time">5 min read</span>
      </div>

      {loading && <p className="status-message" aria-live="polite">Preparing today&apos;s Scripture…</p>}
      {error && <p className="status-message error-message" role="alert">Today&apos;s verse could not be loaded. Please try again shortly.</p>}

      {dailyVerse && (
        <>
          <p className="verse-reference">{dailyVerse.reference} · BSB</p>
          <h3>{dailyVerse.title}</h3>
          <p>{dailyVerse.theme} — {dailyVerse.prompt}</p>
          <button className="card-button" type="button" onClick={onStart}>
            Choose today’s devotion
            <span aria-hidden="true">→</span>
          </button>
        </>
      )}
    </section>
  );
}
