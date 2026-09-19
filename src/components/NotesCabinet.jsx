import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createNote, getNotes, saveNotes } from '../services/notesService.js';
import NotesDialog from './NotesDialog.jsx';
import './NotesCabinet.css';

const MONTH_FORMATTER = new Intl.DateTimeFormat(undefined, { month: 'long' });
const DAY_FORMATTER = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

function countLabel(count, singular) {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

function noteLabel(note) {
  const title = note?.title?.trim();
  if (title) return title;
  const firstLine = note?.body?.trim().split(/\r?\n/)[0];
  return firstLine || 'Untitled note';
}

function notePreview(note) {
  const text = note?.body?.trim().replace(/\s+/g, ' ');
  return text || 'Empty note';
}

function noteDateParts(value) {
  const date = new Date(value || '');
  if (!Number.isFinite(date.getTime())) return null;
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return {
    date,
    year,
    monthKey: `${year}-${month}`,
    dayKey: `${year}-${month}-${day}`,
  };
}

function createNotesHierarchy(notes) {
  const years = [];
  const yearLookup = new Map();

  [...notes]
    .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))
    .forEach((note) => {
      const parts = noteDateParts(note.createdAt);
      if (!parts) return;

      let year = yearLookup.get(parts.year);
      if (!year) {
        year = {
          key: parts.year,
          label: parts.year,
          noteCount: 0,
          months: [],
          monthLookup: new Map(),
        };
        yearLookup.set(parts.year, year);
        years.push(year);
      }

      let month = year.monthLookup.get(parts.monthKey);
      if (!month) {
        month = {
          key: parts.monthKey,
          label: MONTH_FORMATTER.format(parts.date),
          noteCount: 0,
          days: [],
          dayLookup: new Map(),
        };
        year.monthLookup.set(parts.monthKey, month);
        year.months.push(month);
      }

      let day = month.dayLookup.get(parts.dayKey);
      if (!day) {
        day = {
          key: parts.dayKey,
          label: DAY_FORMATTER.format(parts.date),
          notes: [],
        };
        month.dayLookup.set(parts.dayKey, day);
        month.days.push(day);
      }

      day.notes.push(note);
      month.noteCount += 1;
      year.noteCount += 1;
    });

  return years.map(({ monthLookup, ...year }) => ({
    ...year,
    months: year.months.map(({ dayLookup, ...month }) => month),
  }));
}

export default function NotesCabinet() {
  const [notes, setNotes] = useState(() => getNotes());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [initialNoteId, setInitialNoteId] = useState('');
  const triggerRef = useRef(null);
  const archiveYears = useMemo(() => createNotesHierarchy(notes), [notes]);
  const latestYearKey = archiveYears[0]?.key || '';
  const latestMonthKey = archiveYears[0]?.months[0]?.key || '';
  const latestDayKey = archiveYears[0]?.months[0]?.days[0]?.key || '';
  const [openYear, setOpenYear] = useState('');
  const [openMonth, setOpenMonth] = useState('');
  const [openDay, setOpenDay] = useState('');

  useEffect(() => {
    if (!latestDayKey) return;
    setOpenYear((current) => current || latestYearKey);
    setOpenMonth((current) => current || latestMonthKey);
    setOpenDay((current) => current || latestDayKey);
  }, [latestDayKey, latestMonthKey, latestYearKey]);

  function openNote(noteId, trigger) {
    triggerRef.current = trigger;
    setInitialNoteId(noteId);
    setDialogOpen(true);
  }

  function createNewNote(event) {
    const nextNote = createNote();
    const result = saveNotes([nextNote, ...getNotes()]);
    setNotes(result.data);
    openNote(nextNote.id, event.currentTarget);
  }

  function closeDialog() {
    setDialogOpen(false);
    setNotes(getNotes());
  }

  function toggleYear(year) {
    const opening = openYear !== year.key;
    setOpenYear(opening ? year.key : '');
    if (opening) {
      const firstMonth = year.months[0];
      setOpenMonth(firstMonth?.key || '');
      setOpenDay(firstMonth?.days[0]?.key || '');
    }
  }

  function toggleMonth(month) {
    const opening = openMonth !== month.key;
    setOpenMonth(opening ? month.key : '');
    if (opening) setOpenDay(month.days[0]?.key || '');
  }

  return (
    <>
      <section className="tools-notes-cabinet" aria-labelledby="tools-notes-cabinet-heading">
        <header className="tools-notes-cabinet-header">
          <div>
            <p className="dashboard-eyebrow">Notes storage</p>
            <h3 id="tools-notes-cabinet-heading">Your notes cabinet</h3>
            <p>Private notes organized by the day you created them, using the same cabinet pattern as your devotion history.</p>
          </div>
          <button className="tools-notes-new" type="button" onClick={createNewNote}>+ New note</button>
        </header>

        {archiveYears.length ? (
          <div className="devotion-archive tools-notes-archive" aria-label="Saved notes organized by year, month, and day">
            {archiveYears.map((year) => {
              const yearOpen = openYear === year.key;
              const yearContentId = `notes-year-${year.key}`;

              return (
                <section className={`archive-year-drawer ${yearOpen ? 'is-expanded' : ''}`} key={year.key}>
                  <h4 className="archive-drawer-heading">
                    <button
                      className="archive-drawer-button archive-year-button"
                      type="button"
                      onClick={() => toggleYear(year)}
                      aria-expanded={yearOpen}
                      aria-controls={yearContentId}
                    >
                      <span className="archive-drawer-title">{year.label}</span>
                      <span className="archive-drawer-meta">
                        <span>{countLabel(year.noteCount, 'note')}</span>
                        <span className="archive-chevron" aria-hidden="true">⌄</span>
                      </span>
                    </button>
                  </h4>

                  <div className="archive-year-content" id={yearContentId} hidden={!yearOpen}>
                    {year.months.map((month) => {
                      const monthOpen = openMonth === month.key;
                      const monthContentId = `notes-month-${month.key}`;

                      return (
                        <section className={`archive-month-drawer ${monthOpen ? 'is-expanded' : ''}`} key={month.key}>
                          <h5 className="archive-drawer-heading">
                            <button
                              className="archive-drawer-button archive-month-button"
                              type="button"
                              onClick={() => toggleMonth(month)}
                              aria-expanded={monthOpen}
                              aria-controls={monthContentId}
                            >
                              <span className="archive-drawer-title">{month.label}</span>
                              <span className="archive-drawer-meta">
                                <span>{countLabel(month.noteCount, 'note')}</span>
                                <span className="archive-chevron" aria-hidden="true">⌄</span>
                              </span>
                            </button>
                          </h5>

                          <div className="archive-month-content" id={monthContentId} hidden={!monthOpen}>
                            {month.days.map((day) => {
                              const dayOpen = openDay === day.key;
                              const dayContentId = `notes-day-${day.key}`;

                              return (
                                <section className={`archive-day-drawer ${dayOpen ? 'is-expanded' : ''}`} key={day.key}>
                                  <h6 className="archive-drawer-heading">
                                    <button
                                      className="archive-drawer-button archive-day-button"
                                      type="button"
                                      onClick={() => setOpenDay(dayOpen ? '' : day.key)}
                                      aria-expanded={dayOpen}
                                      aria-controls={dayContentId}
                                    >
                                      <span className="archive-drawer-title">{day.label}</span>
                                      <span className="archive-drawer-meta">
                                        <span>{countLabel(day.notes.length, 'note')}</span>
                                        <span className="archive-chevron" aria-hidden="true">⌄</span>
                                      </span>
                                    </button>
                                  </h6>

                                  <div className="archive-day-content" id={dayContentId} hidden={!dayOpen}>
                                    {day.notes.map((note) => (
                                      <button
                                        className="devotion-archive-entry tools-note-entry"
                                        type="button"
                                        key={note.id}
                                        onClick={(event) => openNote(note.id, event.currentTarget)}
                                      >
                                        <span className="archive-entry-copy">
                                          <small>Personal note</small>
                                          <strong className="archive-entry-reference">{noteLabel(note)}</strong>
                                          <span className="tools-note-preview">{notePreview(note)}</span>
                                          <span className="archive-entry-time">Updated {TIME_FORMATTER.format(new Date(note.updatedAt))}</span>
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
          <div className="journey-history-empty tools-notes-empty">
            <span aria-hidden="true">✎</span>
            <h3>Your notes cabinet is empty.</h3>
            <p>Create a note and it will be stored here by date.</p>
            <button className="tools-notes-new" type="button" onClick={createNewNote}>Create your first note</button>
          </div>
        )}
      </section>

      {typeof document !== 'undefined'
        ? createPortal(
          <NotesDialog
            open={dialogOpen}
            onClose={closeDialog}
            triggerRef={triggerRef}
            initialNoteId={initialNoteId}
          />,
          document.body,
        )
        : null}
    </>
  );
}
