import { useEffect, useMemo, useState } from 'react';
import {
  formatArchiveEntryDate,
  formatDevotionCount,
  groupDevotionHistoryByYearAndMonth,
} from '../lib/devotionHistory.js';

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
      <p className="panel-intro">{formatArchiveEntryDate(entry.dateKey, entry.completedAt, { includeYear: true })}</p>

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

function monthDrawerKey(year, month) {
  return `${year}-${month}`;
}

export default function Journey({ history, selectedEntryId, onSelectEntry, onCloseEntry }) {
  const safeHistory = Array.isArray(history) ? history : [];
  const archive = useMemo(() => groupDevotionHistoryByYearAndMonth(safeHistory), [safeHistory]);
  const [expandedYear, setExpandedYear] = useState(null);
  const [expandedMonths, setExpandedMonths] = useState(() => new Set());
  const selectedEntry = safeHistory.find((entry) => entry.id === selectedEntryId);

  useEffect(() => {
    if (!archive.length) {
      setExpandedYear(null);
      return;
    }

    setExpandedYear((currentYear) => {
      if (currentYear && archive.some((yearGroup) => yearGroup.year === currentYear)) return currentYear;
      return archive[0].year;
    });

    const newestMonth = archive[0].months[0];
    if (!newestMonth) return;

    const newestMonthKey = monthDrawerKey(archive[0].year, newestMonth.month);
    setExpandedMonths((currentMonths) => {
      if (currentMonths.size) return currentMonths;
      return new Set([newestMonthKey]);
    });
  }, [archive]);

  if (selectedEntry) return <JourneyReview entry={selectedEntry} onBack={onCloseEntry} />;

  function toggleYear(year) {
    setExpandedYear((currentYear) => (currentYear === year ? null : year));
  }

  function toggleMonth(year, month) {
    const key = monthDrawerKey(year, month);
    setExpandedMonths((currentMonths) => {
      const nextMonths = new Set(currentMonths);
      if (nextMonths.has(key)) nextMonths.delete(key);
      else nextMonths.add(key);
      return nextMonths;
    });
  }

  return (
    <section className="panel-page journey-archive-page">
      <header className="journey-archive-header">
        <p className="dashboard-eyebrow">Your devotion journey</p>
        <h2>A record of your time in the Word.</h2>
        <p className="panel-intro">Look back on the Scriptures, insights, applications, and prayers that shaped your journey.</p>
      </header>

      {archive.length ? (
        <div className="devotion-archive" aria-label="Completed WGAP devotions">
          {archive.map((yearGroup) => {
            const yearIsExpanded = expandedYear === yearGroup.year;
            const yearPanelId = `devotion-archive-year-${yearGroup.year}`;

            return (
              <section className={`archive-year-drawer ${yearIsExpanded ? 'is-expanded' : ''}`} key={yearGroup.year}>
                <h3 className="archive-drawer-heading">
                  <button
                    className="archive-drawer-button archive-year-button"
                    type="button"
                    aria-expanded={yearIsExpanded}
                    aria-controls={yearPanelId}
                    onClick={() => toggleYear(yearGroup.year)}
                  >
                    <span className="archive-drawer-title">{yearGroup.year}</span>
                    <span className="archive-drawer-meta">
                      <span>{formatDevotionCount(yearGroup.count)}</span>
                      <span className="archive-chevron" aria-hidden="true">⌄</span>
                    </span>
                  </button>
                </h3>

                <div className="archive-year-content" id={yearPanelId} hidden={!yearIsExpanded}>
                  {yearGroup.months.map((monthGroup) => {
                    const monthKey = monthDrawerKey(yearGroup.year, monthGroup.month);
                    const monthIsExpanded = expandedMonths.has(monthKey);
                    const monthPanelId = `devotion-archive-month-${yearGroup.year}-${monthGroup.month}`;

                    return (
                      <section className={`archive-month-drawer ${monthIsExpanded ? 'is-expanded' : ''}`} key={monthKey}>
                        <h4 className="archive-drawer-heading">
                          <button
                            className="archive-drawer-button archive-month-button"
                            type="button"
                            aria-expanded={monthIsExpanded}
                            aria-controls={monthPanelId}
                            onClick={() => toggleMonth(yearGroup.year, monthGroup.month)}
                          >
                            <span className="archive-drawer-title">{monthGroup.monthName}</span>
                            <span className="archive-drawer-meta">
                              <span>{formatDevotionCount(monthGroup.count)}</span>
                              <span className="archive-chevron" aria-hidden="true">⌄</span>
                            </span>
                          </button>
                        </h4>

                        <div className="archive-month-content" id={monthPanelId} hidden={!monthIsExpanded}>
                          {monthGroup.entries.map((entry) => (
                            <button
                              className="devotion-archive-entry"
                              type="button"
                              key={entry.id}
                              onClick={() => onSelectEntry(entry.id)}
                            >
                              <span className="archive-entry-copy">
                                <strong>{formatArchiveEntryDate(entry.archiveDateKey, entry.completedAt)}</strong>
                                <span className="archive-entry-reference">{entry.devotion.reference || 'Scripture reflection'}</span>
                                <small>WGAP completed</small>
                              </span>
                              <span className="history-arrow" aria-hidden="true">→</span>
                            </button>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="journey-history-empty archive-empty-state">
          <span aria-hidden="true">✦</span>
          <h3>Your devotion journey begins here.</h3>
          <p>Complete a WGAP devotion and it will appear in your archive.</p>
        </div>
      )}
    </section>
  );
}
