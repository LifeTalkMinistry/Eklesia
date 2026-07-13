export default function TodayDevotionCard({ dailyVerse, completed, loading, error, onStart }) {
  if (dailyVerse && completed) {
    return (
      <section className="today-card today-card-complete" aria-label="Today’s devotion is complete">
        <div className="completion-status-row">
          <span className="completion-check" aria-hidden="true">✓</span>
          <span className="completion-badge">Completed today</span>
        </div>

        <div className="completion-copy">
          <p className="verse-reference">{dailyVerse.reference} · BSB</p>
          <h3>Devotion complete</h3>
          <p>Your WGAP for today is saved in Journey.</p>
        </div>

        <button className="card-button completion-review-button" type="button" onClick={onStart}>
          Review devotion
          <span aria-hidden="true">→</span>
        </button>
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
