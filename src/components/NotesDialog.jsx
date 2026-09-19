import { useEffect, useRef, useState } from 'react';
import { createNote, getNotes, saveNotes } from '../services/notesService.js';
import AccessibleDialog from './AccessibleDialog.jsx';
import './NotesDialog.css';

function noteLabel(note) {
  const title = note?.title?.trim();
  if (title) return title;
  const firstLine = note?.body?.trim().split(/\r?\n/)[0];
  return firstLine || 'Untitled note';
}

function formatUpdatedAt(value) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function formatInsertDate() {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());
}

export default function NotesDialog({ open, onClose, triggerRef, initialNoteId = '' }) {
  const [notes, setNotes] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [status, setStatus] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const titleRef = useRef(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    setMenuOpen(false);
    const restored = getNotes();
    if (restored.length) {
      const preferredNote = initialNoteId
        ? restored.find((note) => note.id === initialNoteId)
        : null;
      setNotes(restored);
      setActiveId(preferredNote?.id || restored[0].id);
      setStatus('');
      return;
    }

    const firstNote = createNote();
    const result = saveNotes([firstNote]);
    setNotes([firstNote]);
    setActiveId(firstNote.id);
    setStatus(result.persisted ? '' : result.message);
  }, [initialNoteId, open]);

  const activeNote = notes.find((note) => note.id === activeId) || null;

  function persist(nextNotes, successMessage = 'Saved') {
    setNotes(nextNotes);
    const result = saveNotes(nextNotes);
    setStatus(result.persisted ? successMessage : result.message);
    return result;
  }

  function addNote() {
    const nextNote = createNote();
    persist([nextNote, ...notes], 'New note created');
    setActiveId(nextNote.id);
    setMenuOpen(false);
    window.requestAnimationFrame(() => titleRef.current?.focus());
  }

  function duplicateActive() {
    if (!activeNote) return;
    const copy = createNote({
      title: activeNote.title?.trim() ? `${activeNote.title.trim()} copy` : '',
      body: activeNote.body || '',
    });
    persist([copy, ...notes], 'Note duplicated');
    setActiveId(copy.id);
    setMenuOpen(false);
    window.requestAnimationFrame(() => titleRef.current?.focus());
  }

  function updateActive(patch) {
    if (!activeNote) return;
    const updated = {
      ...activeNote,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    const nextNotes = notes.map((note) => (note.id === activeNote.id ? updated : note));
    persist(nextNotes);
  }

  function deleteActive() {
    if (!activeNote) return;
    if (!window.confirm(`Delete “${noteLabel(activeNote)}”?`)) return;

    const nextNotes = notes.filter((note) => note.id !== activeNote.id);
    persist(nextNotes, 'Note deleted');
    setMenuOpen(false);
    onClose?.();
  }

  function insertBodyText(text) {
    if (!activeNote) return;
    const textarea = bodyRef.current;
    const start = textarea?.selectionStart ?? activeNote.body.length;
    const end = textarea?.selectionEnd ?? start;
    const nextBody = `${activeNote.body.slice(0, start)}${text}${activeNote.body.slice(end)}`;
    updateActive({ body: nextBody });

    window.requestAnimationFrame(() => {
      const nextCursor = start + text.length;
      bodyRef.current?.focus();
      bodyRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  return (
    <AccessibleDialog
      open={open}
      onRequestClose={onClose}
      triggerRef={triggerRef}
      labelledBy="notes-dialog-title"
      initialFocusRef={titleRef}
      className="notes-dialog"
    >
      <h2 id="notes-dialog-title" className="notes-visually-hidden">Note editor</h2>

      <div className="notes-editor-topbar">
        <div className="notes-editor-actions">
          <button
            className="notes-editor-more"
            type="button"
            aria-label="More note actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
          >
            <span aria-hidden="true">•••</span>
          </button>
          <button className="notes-editor-close" type="button" onClick={onClose} aria-label="Close note">×</button>
        </div>

        {menuOpen ? (
          <div className="notes-editor-menu" role="menu" aria-label="Note actions">
            <button type="button" role="menuitem" onClick={addNote}>New note</button>
            <button type="button" role="menuitem" onClick={duplicateActive} disabled={!activeNote}>Duplicate note</button>
            <button className="is-danger" type="button" role="menuitem" onClick={deleteActive} disabled={!activeNote}>Delete note</button>
          </div>
        ) : null}
      </div>

      <section className="notes-writing-surface" aria-label="Note editor">
        {activeNote ? (
          <>
            <label className="notes-visually-hidden" htmlFor="notes-title">Note title</label>
            <input
              ref={titleRef}
              id="notes-title"
              className="notes-title-input"
              type="text"
              maxLength="120"
              placeholder="Untitled note"
              value={activeNote.title}
              onChange={(event) => updateActive({ title: event.target.value })}
            />

            <label className="notes-visually-hidden" htmlFor="notes-body">Note</label>
            <textarea
              ref={bodyRef}
              id="notes-body"
              className="notes-body-input"
              maxLength="20000"
              placeholder="Start writing…"
              value={activeNote.body}
              onChange={(event) => updateActive({ body: event.target.value })}
            />
          </>
        ) : (
          <div className="notes-editor-empty">
            <strong>No note selected</strong>
            <button type="button" onClick={addNote}>Create note</button>
          </div>
        )}
      </section>

      <footer className="notes-editor-toolbar">
        <div className="notes-toolbar-tools" aria-label="Note tools">
          <button type="button" onClick={() => insertBodyText('☐ ')} disabled={!activeNote} aria-label="Insert checklist item" title="Checklist">☐</button>
          <button type="button" onClick={() => insertBodyText('• ')} disabled={!activeNote} aria-label="Insert bullet" title="Bullet list">•</button>
          <button type="button" onClick={() => insertBodyText(formatInsertDate())} disabled={!activeNote} aria-label="Insert today's date" title="Insert date">Date</button>
        </div>
        <span className="notes-save-status" aria-live="polite">
          {status || (activeNote ? `Saved · ${formatUpdatedAt(activeNote.updatedAt)}` : '')}
        </span>
      </footer>
    </AccessibleDialog>
  );
}
