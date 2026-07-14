import { useMemo } from 'react';
import {
  formatArchiveEntryDate,
  formatCompletionTime,
  groupDevotionsByDate,
} from '../services/devotionService.js';

const REVIEW_FIELDS = [
  ['G', 'Gratitude', 'gratitude'],
  ['A', 'Application', 'application'],
  ['P', 'Prayer', 'prayer'],
];

function JourneyReview({ entry, onBack }) {
  return (
    <section className="panel-page journey-review-page">
      <button className="journey-back-button" type="button" onClick={onBack}>← Devotion history</button>
      <p className="dashboard-eyebrow">{entry.type === 'additional' ? 'Additional devotion' : 'Daily devotion'}</p>
      <h2>{entry.reference}</h2>
      <p className="panel-intro">{formatArchiveEntryDate(entry.dateKey, entry.completedAt, { includeYear: true })} · {formatCompletionTime(entry.completedAt)}</p>
      <p className="journey-private-reminder">This reflection is private to your Journey.</p>

      <article className="history-review-card history-word-card">
        <div className="history-review-heading"><span>W</span><strong>Word of God</strong></div>
        <p className="history-reference">{entry.reference} · BSB</p>
        <blockquote>“{entry.scriptureText}”</blockquote>
      </article>

      {REVIEW_FIELDS.map(([letter, label, key]) => entry.wgap?.[key] ? (
        <article className="history-review-card" key={key}>
          <div className="history-review-heading"><span>{letter}</span><strong>{label}</strong></div>
          <p className="history-entry-text">{entry.wgap[key]}</p>
        </article>
      ) : null)}
    </section>
  );
}

export default function Journey({ history, selectedEntryId, onSelectEntry, onCloseEntry }) {
  const safeHistory = Array.isArray(history) ? history : [];
  const dateGroups = useMemo(() => groupDevotionsByDate(safeHistory), [safeHistory]);
  const selectedEntry = safeHistory.find((entry) => entry.id === selectedEntryId);

  if (selectedEntry) return <JourneyReview entry={selectedEntry} onBack={onCloseEntry} />;

  return (
    <section className="panel-page journey-date-page">
      <header className="journey-archive-header">
        <p className="dashboard-eyebrow">Your devotion journey</p>
        <h2>A record of your time in the Word.</h2>
        <p className="panel-intro">Each date counts once toward your daily rhythm, while every private devotion remains available here.</p>
      </header>

      {dateGroups.length ? (
        <div className="journey-date-list" aria-label="Completed WGAP devotions grouped by Manila date">
          {dateGroups.map((group) => (
            <section className="journey-date-group" key={group.dateKey}>
              <h3>{formatArchiveEntryDate(group.dateKey, null)}</h3>
              <div className="journey-date-entries">
                {group.entries.map((entry) => (
                  <button className="journey-date-entry" type="button" key={entry.id} onClick={() => onSelectEntry(entry.id)}>
                    <span className={`journey-entry-type ${entry.type === 'additional' ? 'is-additional' : 'is-daily'}`}>
                      {entry.type === 'additional' ? 'Additional devotion' : 'Daily devotion'}
                    </span>
                    <strong>{entry.reference}</strong>
                    <small>Completed at {formatCompletionTime(entry.completedAt)}</small>
                    <span className="history-arrow" aria-hidden="true">→</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="journey-history-empty archive-empty-state">
          <span aria-hidden="true">✦</span>
          <h3>Your devotion journey begins here.</h3>
          <p>Complete a WGAP devotion and it will appear privately in your Journey.</p>
        </div>
      )}
    </section>
  );
}
