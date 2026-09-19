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

function notePreview(note) {
  const text = note?.body?.trim().replace(/\s+/g, ' ');
  return text || 'Start writing…';
}

function formatUpdatedAt(value) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return '';
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default function NotesDialog({ open, onClose, triggerRef }) {
  const [notes, setNotes] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [status, setStatus] = useState('');
  const titleRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const restored = getNotes();
    if (restored.length) {
      setNotes(restored);
      setActiveId(restored[0].id);
      setStatus('');
      return;
    }

    const firstNote = createNote();
    const result = saveNotes([firstNote]);
    setNotes([firstNote]);
    setActiveId(firstNote.id);
    setStatus(result.persisted ? '' : result.message);
  }, [open]);

  const activeNote = notes.find((note) => note.id === activeId) || null;

  function persist(nextNotes, successMessage = 'Saved') {
    setNotes(nextNotes);
    const result = saveNotes(nextNotes);
    setStatus(result.persisted ? successMessage : result.message);
  }

  function addNote() {
    const nextNote = createNote();
    persist([nextNote, ...notes], 'New note created');
    setActiveId(nextNote.id);
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
    setActiveId(nextNotes[0]?.id || '');
  }

  return (
    <AccessibleDialog
      open={open}
      onRequestClose={onClose}
      triggerRef={triggerRef}
      labelledBy="notes-dialog-title"
      describedBy="notes-dialog-description"
      initialFocusRef={titleRef}
      className="notes-dialog"
    >
      <div className="notes-dialog-topline">
        <div>
          <p className="dashboard-eyebrow">Personal space</p>
          <h2 id="notes-dialog-title">Notes</h2>
        </div>
        <button className="notes-dialog-close" type="button" onClick={onClose} aria-label="Close notes">×</button>
      </div>

      <p id="notes-dialog-description" className="notes-dialog-description">
        Keep quick thoughts, reminders, or anything you want to return to inside Ekklesia Pulse.
      </p>

      <div className="notes-dialog-layout">
        <aside className="notes-list-panel" aria-label="Your notes">
          <div className="notes-list-heading">
            <span>{notes.length} {notes.length === 1 ? 'note' : 'notes'}</span>
            <button type="button" onClick={addNote} aria-label="Create a new note">+ New</button>
          </div>

          <div className="notes-list" role="list">
            {notes.length ? notes.map((note) => (
              <button
                className={`notes-list-item ${note.id === activeId ? 'is-active' : ''}`}
                type="button"
                key={note.id}
                onClick={() => {
                  setActiveId(note.id);
                  setStatus('');
                }}
                role="listitem"
                aria-current={note.id === activeId ? 'true' : undefined}
              >
                <strong>{noteLabel(note)}</strong>
                <span>{notePreview(note)}</span>
                <small>{formatUpdatedAt(note.updatedAt)}</small>
              </button>
            )) : (
              <div className="notes-list-empty">No notes yet.</div>
            )}
          </div>
        </aside>

        <section className="notes-editor" aria-label="Note editor">
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
                id="notes-body"
                className="notes-body-input"
                maxLength="20000"
                placeholder="Write anything you want to remember…"
                value={activeNote.body}
                onChange={(event) => updateActive({ body: event.target.value })}
              />

              <div className="notes-editor-footer">
                <span className="notes-save-status" aria-live="polite">
                  {status || `Updated ${formatUpdatedAt(activeNote.updatedAt)}`}
                </span>
                <button className="notes-delete-button" type="button" onClick={deleteActive}>Delete note</button>
              </div>
            </>
          ) : (
            <div className="notes-editor-empty">
              <span aria-hidden="true">✎</span>
              <strong>No note selected</strong>
              <p>Create a note to start writing.</p>
              <button type="button" onClick={addNote}>Create note</button>
            </div>
          )}
        </section>
      </div>

      <p className="notes-storage-note">Notes are private to your signed-in Ekklesia profile on this device.</p>
    </AccessibleDialog>
  );
}
