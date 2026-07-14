import { useEffect, useMemo, useRef, useState } from 'react';
import { shareOrDownloadElementImage } from '../lib/exportElementImage.js';
import NotebookJourneyReview from './NotebookJourneyReview.jsx';
import {
  formatArchiveEntryDate,
  formatCompletionTime,
  groupDevotionsByDate,
} from '../services/devotionService.js';

const REVIEW_FIELDS = [
  ['G', 'Gets Ko', 'gratitude'],
  ['A', 'Application', 'application'],
  ['P', 'Prayer', 'prayer'],
];

const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  timeZone: 'UTC',
});

function countLabel(count, singular) {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

function createArchiveHierarchy(dateGroups) {
  const years = [];
  const yearLookup = new Map();

  dateGroups.forEach((day) => {
    const [yearValue, monthValue] = day.dateKey.split('-');
    const monthNumber = Number(monthValue);
    if (!yearValue || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) return;

    let year = yearLookup.get(yearValue);
    if (!year) {
      year = {
        key: yearValue,
        label: yearValue,
        dayCount: 0,
        devotionCount: 0,
        months: [],
        monthLookup: new Map(),
      };
      yearLookup.set(yearValue, year);
      years.push(year);
    }

    const monthKey = `${yearValue}-${monthValue}`;
    let month = year.monthLookup.get(monthKey);
    if (!month) {
      month = {
        key: monthKey,
        label: MONTH_FORMATTER.format(new Date(Date.UTC(Number(yearValue), monthNumber - 1, 1))),
        dayCount: 0,
        devotionCount: 0,
        days: [],
      };
      year.monthLookup.set(monthKey, month);
      year.months.push(month);
    }

    const devotionCount = day.entries.length;
    month.days.push(day);
    month.dayCount += 1;
    month.devotionCount += devotionCount;
    year.dayCount += 1;
    year.devotionCount += devotionCount;
  });

  return years.map(({ monthLookup, ...year }) => year);
}

function createDevotionImageFilename(entry) {
  const referenceSlug = String(entry?.reference || 'devotion')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `ekklesia-pulse-${referenceSlug || 'devotion'}-${entry?.dateKey || 'reflection'}.png`;
}

function JourneyReview({ entry, onBack }) {
  const imageAreaRef = useRef(null);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [shareError, setShareError] = useState(false);

  async function shareDevotionImage() {
    if (!imageAreaRef.current || isPreparingImage) return;

    setIsPreparingImage(true);
    setShareMessage('Preparing your devotion image…');
    setShareError(false);

    try {
      const result = await shareOrDownloadElementImage(imageAreaRef.current, {
        filename: createDevotionImageFilename(entry),
        title: `${entry.reference} · Ekklesia Pulse`,
        text: 'A reflection from my time in the Word.',
        backgroundColor: '#0b1711',
        padding: 24,
      });

      if (result === 'shared') setShareMessage('Your devotion image was shared.');
      else if (result === 'downloaded') setShareMessage('Your devotion image was downloaded.');
      else setShareMessage('');
    } catch (error) {
      console.error('The devotion image could not be prepared', error);
      setShareError(true);
      setShareMessage('The devotion image could not be created on this browser. Please try again.');
    } finally {
      setIsPreparingImage(false);
    }
  }

  return (
    <section className="panel-page journey-review-page">
      <div className="journey-review-toolbar">
        <button className="journey-back-button" type="button" onClick={onBack}>← Devotion history</button>
        <button
          className="journey-share-button"
          type="button"
          onClick={shareDevotionImage}
          disabled={isPreparingImage}
          aria-label="Share this devotion as an image"
        >
          <span aria-hidden="true">⇩</span>
          <span>{isPreparingImage ? 'Preparing…' : 'Share image'}</span>
        </button>
      </div>

      {shareMessage && (
        <p className={`journey-share-status ${shareError ? 'is-error' : ''}`} role={shareError ? 'alert' : 'status'}>
          {shareMessage}
        </p>
      )}

      <div className="journey-share-canvas" ref={imageAreaRef}>
        <header
          className="journey-image-heading"
          data-image-export-only
          data-image-export-display="flex"
          aria-hidden="true"
        >
          <div className="journey-image-brand">
            <span>E</span>
            <div>
              <strong>Ekklesia Pulse</strong>
              <small>My WGAP devotion</small>
            </div>
          </div>
          <p>
            {formatArchiveEntryDate(entry.dateKey, entry.completedAt, { includeYear: true })}
            <span> · </span>
            {entry.type === 'additional' ? 'Additional devotion' : 'Daily devotion'}
          </p>
        </header>

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

        <footer
          className="journey-image-footer"
          data-image-export-only
          data-image-export-display="flex"
          aria-hidden="true"
        >
          <span>Build your rhythm.</span>
          <strong>Strengthen the church.</strong>
        </footer>
      </div>
    </section>
  );
}

export default function Journey({ history, selectedEntryId, onSelectEntry, onCloseEntry, onEntryUpdated }) {
  const safeHistory = Array.isArray(history) ? history : [];
  const dateGroups = useMemo(() => groupDevotionsByDate(safeHistory), [safeHistory]);
  const archiveYears = useMemo(() => createArchiveHierarchy(dateGroups), [dateGroups]);
  const selectedEntry = safeHistory.find((entry) => entry.id === selectedEntryId);
  const latestDateKey = dateGroups[0]?.dateKey || '';
  const latestYearKey = latestDateKey.slice(0, 4);
  const latestMonthKey = latestDateKey.slice(0, 7);
  const [openYear, setOpenYear] = useState('');
  const [openMonth, setOpenMonth] = useState('');
  const [openDay, setOpenDay] = useState('');

  useEffect(() => {
    if (!latestDateKey) return;
    setOpenYear((current) => current || latestYearKey);
    setOpenMonth((current) => current || latestMonthKey);
    setOpenDay((current) => current || latestDateKey);
  }, [latestDateKey, latestMonthKey, latestYearKey]);

  if (selectedEntry?.devotionFormat === 'notebook') {
    return <NotebookJourneyReview entry={selectedEntry} onBack={onCloseEntry} onEntryUpdated={onEntryUpdated} />;
  }
  if (selectedEntry) return <JourneyReview entry={selectedEntry} onBack={onCloseEntry} />;

  function toggleYear(year) {
    const opening = openYear !== year.key;
    setOpenYear(opening ? year.key : '');
    if (opening) {
      const firstMonth = year.months[0];
      setOpenMonth(firstMonth?.key || '');
      setOpenDay(firstMonth?.days[0]?.dateKey || '');
    }
  }

  function toggleMonth(month) {
    const opening = openMonth !== month.key;
    setOpenMonth(opening ? month.key : '');
    if (opening) setOpenDay(month.days[0]?.dateKey || '');
  }

  return (
    <section className="panel-page journey-archive-page">
      <header className="journey-archive-header">
        <p className="dashboard-eyebrow">Your devotion journey</p>
        <h2>A record of your time in the Word.</h2>
        <p className="panel-intro">Open a year, month, and day to revisit every devotion you have completed.</p>
      </header>

      {archiveYears.length ? (
        <div className="devotion-archive" aria-label="Completed WGAP devotions organized by year, month, and day">
          {archiveYears.map((year) => {
            const yearOpen = openYear === year.key;
            const yearContentId = `archive-year-${year.key}`;

            return (
              <section className={`archive-year-drawer ${yearOpen ? 'is-expanded' : ''}`} key={year.key}>
                <h3 className="archive-drawer-heading">
                  <button
                    className="archive-drawer-button archive-year-button"
                    type="button"
                    onClick={() => toggleYear(year)}
                    aria-expanded={yearOpen}
                    aria-controls={yearContentId}
                  >
                    <span className="archive-drawer-title">{year.label}</span>
                    <span className="archive-drawer-meta">
                      <span>{countLabel(year.dayCount, 'day')}</span>
                      <span className="archive-chevron" aria-hidden="true">⌄</span>
                    </span>
                  </button>
                </h3>

                <div className="archive-year-content" id={yearContentId} hidden={!yearOpen}>
                  {year.months.map((month) => {
                    const monthOpen = openMonth === month.key;
                    const monthContentId = `archive-month-${month.key}`;

                    return (
                      <section className={`archive-month-drawer ${monthOpen ? 'is-expanded' : ''}`} key={month.key}>
                        <h4 className="archive-drawer-heading">
                          <button
                            className="archive-drawer-button archive-month-button"
                            type="button"
                            onClick={() => toggleMonth(month)}
                            aria-expanded={monthOpen}
                            aria-controls={monthContentId}
                          >
                            <span className="archive-drawer-title">{month.label}</span>
                            <span className="archive-drawer-meta">
                              <span>{countLabel(month.dayCount, 'day')}</span>
                              <span className="archive-chevron" aria-hidden="true">⌄</span>
                            </span>
                          </button>
                        </h4>

                        <div className="archive-month-content" id={monthContentId} hidden={!monthOpen}>
                          {month.days.map((day) => {
                            const dayOpen = openDay === day.dateKey;
                            const dayContentId = `archive-day-${day.dateKey}`;

                            return (
                              <section className={`archive-day-drawer ${dayOpen ? 'is-expanded' : ''}`} key={day.dateKey}>
                                <h5 className="archive-drawer-heading">
                                  <button
                                    className="archive-drawer-button archive-day-button"
                                    type="button"
                                    onClick={() => setOpenDay(dayOpen ? '' : day.dateKey)}
                                    aria-expanded={dayOpen}
                                    aria-controls={dayContentId}
                                  >
                                    <span className="archive-drawer-title">{formatArchiveEntryDate(day.dateKey, null)}</span>
                                    <span className="archive-drawer-meta">
                                      <span>{countLabel(day.entries.length, 'devotion')}</span>
                                      <span className="archive-chevron" aria-hidden="true">⌄</span>
                                    </span>
                                  </button>
                                </h5>

                                <div className="archive-day-content" id={dayContentId} hidden={!dayOpen}>
                                  {day.entries.map((entry) => (
                                    <button
                                      className="devotion-archive-entry"
                                      type="button"
                                      key={entry.id}
                                      onClick={() => onSelectEntry(entry.id)}
                                    >
                                      <span className="archive-entry-copy">
                                        <small>{entry.devotionFormat === 'notebook'
                                          ? 'Notebook devotion'
                                          : entry.type === 'additional' ? 'Additional devotion' : 'Daily devotion'}</small>
                                        <strong className="archive-entry-reference">
                                          {entry.devotionFormat === 'notebook'
                                            ? entry.reference || 'Handwritten reflection'
                                            : entry.reference}
                                        </strong>
                                        <span className="archive-entry-time">Completed at {formatCompletionTime(entry.completedAt)}</span>
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
              </section>
            );
          })}
        </div>
      ) : (
        <div className="journey-history-empty archive-empty-state">
          <span aria-hidden="true">✦</span>
          <h3>Your devotion journey begins here.</h3>
          <p>Complete a WGAP devotion and it will appear in your Journey.</p>
        </div>
      )}
    </section>
  );
}
