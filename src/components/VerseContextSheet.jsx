import { useEffect, useRef, useState } from 'react';
import { getVerseContext } from '../data/verseContexts.js';
import { getBibleChapter } from '../lib/bible.js';
import './VerseContextSheet.css';

function getVerseRange(devotion) {
  const start = devotion?.verseStart ?? devotion?.startVerse ?? devotion?.verse;
  const end = devotion?.verseEnd ?? devotion?.endVerse ?? start;
  return { start: Number(start), end: Number(end) };
}

export default function VerseContextSheet({ open, onClose, devotion, triggerRef }) {
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);
  const [nearbyVerses, setNearbyVerses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { start, end } = getVerseRange(devotion);
  const context = getVerseContext(devotion);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    setNearbyVerses([]);
    setError('');
    setLoading(true);

    if (!devotion?.bookSlug || !devotion?.chapter || !start) {
      setLoading(false);
      setError('The surrounding passage is unavailable for this selection.');
    } else {
      getBibleChapter(devotion.bookSlug, devotion.chapter)
        .then(({ chapter }) => {
          if (cancelled) return;
          const firstVerse = Math.max(1, start - 2);
          const lastVerse = Math.min(
            chapter.verses.at(-1)?.number || end,
            end + 2,
          );
          setNearbyVerses(
            chapter.verses.filter((verse) => verse.number >= firstVerse && verse.number <= lastVerse),
          );
        })
        .catch((chapterError) => {
          console.error('Verse context could not load the surrounding passage', chapterError);
          if (!cancelled) setError('The nearby verses could not be loaded. Please try again.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    const focusPanel = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusableElements = panelRef.current.querySelectorAll(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusableElements.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(focusPanel);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => {
        const focusTarget = triggerRef?.current || previouslyFocused;
        focusTarget?.focus?.();
      });
    };
  }, [open, onClose, devotion, start, end, triggerRef]);

  if (!open) return null;

  return (
    <div
      className="verse-context-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="verse-context-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="verse-context-title"
        aria-describedby="verse-context-summary"
        ref={panelRef}
      >
        <header className="verse-context-header">
          <div>
            <p className="verse-context-eyebrow">Understand the passage</p>
            <h2 id="verse-context-title">Verse context</h2>
            <span>{devotion?.reference} · BSB</span>
          </div>
          <button
            className="verse-context-close"
            type="button"
            onClick={onClose}
            ref={closeButtonRef}
            aria-label="Close verse context"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="verse-context-content">
          <section className="verse-context-summary" aria-labelledby="verse-context-explanation-title">
            <p className="verse-context-label">What is happening here?</p>
            <h3 id="verse-context-explanation-title">The verse inside its larger passage</h3>
            <p id="verse-context-summary">{context}</p>
          </section>

          <section className="verse-context-nearby" aria-labelledby="verse-context-nearby-title">
            <div className="verse-context-section-heading">
              <div>
                <p className="verse-context-label">Around this verse</p>
                <h3 id="verse-context-nearby-title">Nearby Scripture</h3>
              </div>
              <span>BSB</span>
            </div>

            {loading && <p className="verse-context-status" role="status">Loading the surrounding passage…</p>}
            {error && <p className="verse-context-status verse-context-error" role="alert">{error}</p>}

            {!loading && !error && (
              <div className="verse-context-verses">
                {nearbyVerses.map((verse) => {
                  const highlighted = verse.number >= start && verse.number <= end;
                  return (
                    <p className={highlighted ? 'is-highlighted' : ''} key={verse.number}>
                      <sup>{verse.number}</sup>
                      <span>{verse.text}</span>
                    </p>
                  );
                })}
              </div>
            )}
          </section>

          <p className="verse-context-note">
            Context helps us understand a verse faithfully before applying it personally.
          </p>

          <button className="primary-button verse-context-done" type="button" onClick={onClose}>
            Return to my devotion
          </button>
        </div>
      </section>
    </div>
  );
}
