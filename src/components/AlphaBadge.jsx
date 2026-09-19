import { useRef, useState } from 'react';
import NotesDialog from './NotesDialog.jsx';

export default function AlphaBadge({ compact = false }) {
  const [notesOpen, setNotesOpen] = useState(false);
  const notesButtonRef = useRef(null);

  if (!compact) {
    return <span className="alpha-badge">PRIVATE ALPHA</span>;
  }

  return (
    <>
      <button
        ref={notesButtonRef}
        className={`notes-header-button ${notesOpen ? 'is-open' : ''}`.trim()}
        type="button"
        aria-label="Open notes"
        aria-haspopup="dialog"
        aria-expanded={notesOpen}
        title="Notes"
        onClick={() => setNotesOpen(true)}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6.5 4.5h9.8a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z" />
          <path d="M8 8h6.8" />
          <path d="M8 11.5h6.8" />
          <path d="M8 15h4.2" />
          <path d="M18.3 7.2 20 5.5" />
        </svg>
      </button>
      <NotesDialog open={notesOpen} onClose={() => setNotesOpen(false)} triggerRef={notesButtonRef} />
    </>
  );
}
