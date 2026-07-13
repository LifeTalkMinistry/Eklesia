export default function TodayDevotionCard({ dailyVerse, completed, loading, error, onStart }) {
  return (
    <section className={`today-card ${completed ? 'today-card-complete' : ''}`} aria-busy={loading}>
      <div className="today-card-topline">
        <span className="soft-badge">Today&apos;s devotion</span>
        <span className="reading-time">5 min read</span>
      </div>

      {loading && <p className="status-message" aria-live="polite">Preparing today&apos;s Scripture…</p>}
      {error && <p className="status-message error-message" role="alert">Today&apos;s verse could not be loaded. Please try again shortly.</p>}

      {dailyVerse && (
        <>
          <p className="verse-reference">{dailyVerse.reference} · BSB</p>
          <h3>{completed ? 'You showed up today.' : dailyVerse.title}</h3>
          <p>{completed ? 'Your WGAP devotion is saved. Revisit what God showed you and carry it through your day.' : `${dailyVerse.theme} — ${dailyVerse.prompt}`}</p>
          <button className="card-button" type="button" onClick={onStart}>
            {completed ? 'Review today’s devotion' : 'Choose today’s devotion'}
            <span aria-hidden="true">→</span>
          </button>
        </>
      )}
    </section>
  );
}
