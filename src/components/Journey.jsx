import { formatDevotionHistoryDate, getRecentCompletionCount } from '../lib/devotionHistory.js';

const REVIEW_FIELDS = [
  ['G', 'Gets Ko', 'getsKo'],
  ['A', 'Application', 'application'],
  ['P', 'Prayer', 'prayer'],
];

function JourneyReview({ entry, onBack }) {
  const devotion = entry.devotion;
  const scripturePreview = devotion.previewText || devotion.text;

  return (
    <section className="panel-page journey-review-page">
      <button className="journey-back-button" type="button" onClick={onBack}>← Devotion history</button>
      <p className="dashboard-eyebrow">Saved WGAP devotion</p>
      <h2>{devotion.reference}</h2>
      <p className="panel-intro">{formatDevotionHistoryDate(entry.completedAt)}</p>

      <article className="history-review-card history-word-card">
        <div className="history-review-heading">
          <span>W</span>
          <strong>Word of God</strong>
        </div>
        <p className="history-reference">{devotion.reference} · BSB</p>
        <blockquote>“{scripturePreview}”</blockquote>
      </article>

      {REVIEW_FIELDS.map(([letter, label, key]) => (
        <article className="history-review-card" key={key}>
          <div className="history-review-heading">
            <span>{letter}</span>
            <strong>{label}</strong>
          </div>
          <p className="history-entry-text">{entry.wgap[key]}</p>
        </article>
      ))}
    </section>
  );
}

export default function Journey({ history, selectedEntryId, onSelectEntry, onCloseEntry }) {
  const selectedEntry = history.find((entry) => entry.id === selectedEntryId);
  if (selectedEntry) return <JourneyReview entry={selectedEntry} onBack={onCloseEntry} />;

  const weeklyCount = getRecentCompletionCount(history);
  const weeklyPercentage = Math.round((weeklyCount / 7) * 100);

  return (
    <section className="panel-page">
      <p className="dashboard-eyebrow">Your spiritual journey</p>
      <h2>Small steps are becoming a rhythm.</h2>
      <p className="panel-intro">Review the WGAP devotions you have completed and keep noticing how God is growing you.</p>

      <div className="journey-progress-card">
        <div
          className="progress-ring"
          aria-label={`${weeklyPercentage} percent weekly consistency`}
          style={{ background: `radial-gradient(circle,#0d1913 56%,transparent 57%), conic-gradient(#b8d7be 0 ${weeklyPercentage}%,rgba(255,255,255,.07) ${weeklyPercentage}% 100%)` }}
        >
          <span>{weeklyPercentage}%</span>
        </div>
        <div>
          <p className="dashboard-eyebrow">Weekly consistency</p>
          <h3>{weeklyCount ? 'Keep building the rhythm' : 'Your next step starts today'}</h3>
          <p>{weeklyCount} of the last 7 days have a saved WGAP devotion.</p>
        </div>
      </div>

      <section className="journey-history-section">
        <div className="journey-history-heading">
          <div>
            <p className="dashboard-eyebrow">Private journal</p>
            <h3>Your Devotion History</h3>
          </div>
          <span>{history.length}</span>
        </div>

        {history.length ? (
          <div className="devotion-history-list">
            {history.map((entry) => (
              <button className="devotion-history-card" type="button" key={entry.id} onClick={() => onSelectEntry(entry.id)}>
                <span className="history-check" aria-hidden="true">✓</span>
                <span className="history-card-copy">
                  <small>{formatDevotionHistoryDate(entry.completedAt)}</small>
                  <strong>{entry.devotion.reference}</strong>
                  <span>WGAP completed</span>
                </span>
                <span className="history-arrow" aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="journey-history-empty">
            <span aria-hidden="true">✦</span>
            <h3>Your completed devotions will appear here.</h3>
            <p>Finish a WGAP devotion to begin your private history.</p>
          </div>
        )}
      </section>

      <div className="privacy-card"><span aria-hidden="true">🔒</span><div><h3>Your reflections stay private</h3><p>Only you can open the Gets Ko, Application, and Prayer entries saved on this device.</p></div></div>
    </section>
  );
}
