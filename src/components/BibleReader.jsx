import { useEffect, useMemo, useState } from 'react';
import { loadBibleBook, loadBibleManifest } from '../lib/bible.js';
import { saveLastBibleLocation } from '../services/devotionService.js';

const MAX_SELECTED_VERSES = 5;

export default function BibleReader({ target, onReturn, selectionMode = false, onSelectVerse, onCancelSelection }) {
  const [manifest, setManifest] = useState([]);
  const [testament, setTestament] = useState(target?.testament || 'all');
  const [bookSlug, setBookSlug] = useState(target?.bookSlug || 'genesis');
  const [chapterNumber, setChapterNumber] = useState(target?.chapter || 1);
  const [highlightVerse, setHighlightVerse] = useState(target?.verse || null);
  const [highlightEndVerse, setHighlightEndVerse] = useState(target?.endVerse || target?.verse || null);
  const [highlightLabel, setHighlightLabel] = useState(target?.label || 'Today’s verse');
  const [selectedRange, setSelectedRange] = useState(null);
  const [selectionError, setSelectionError] = useState('');
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadBibleManifest()
      .then((books) => {
        if (cancelled) return;
        setManifest(books);
        if (books.length && !books.some((item) => item.slug === bookSlug)) setBookSlug(books[0].slug);
      })
      .catch((loadError) => {
        console.error('Bible manifest load failed', loadError);
        if (!cancelled) setError('The Bible book list could not be loaded. Please try again.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!target?.bookSlug) return;
    setBookSlug(target.bookSlug);
    setChapterNumber(target.chapter || 1);
    setHighlightVerse(target.verse || null);
    setHighlightEndVerse(target.endVerse || target.verse || null);
    setHighlightLabel(target.label || 'Today’s verse');
    setSelectedRange(null);
    setSelectionError('');
    const matchingBook = manifest.find((item) => item.slug === target.bookSlug);
    if (matchingBook) setTestament(matchingBook.testament);
  }, [target?.bookSlug, target?.chapter, target?.verse, target?.endVerse, target?.label, manifest]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    loadBibleBook(bookSlug)
      .then((loadedBook) => {
        if (cancelled) return;
        setBook(loadedBook);
        if (!loadedBook.chapters.some((chapter) => chapter.number === chapterNumber)) setChapterNumber(1);
      })
      .catch((loadError) => {
        console.error(`Bible book load failed: ${bookSlug}`, loadError);
        if (!cancelled) setError('This Bible book could not be loaded. Please choose another book or try again.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [bookSlug]);

  useEffect(() => {
    if (!book || !chapterNumber) return;
    saveLastBibleLocation({
      bookSlug,
      bookName: book.name,
      chapter: chapterNumber,
      verse: 1,
    });
  }, [book, bookSlug, chapterNumber]);

  const chapter = book?.chapters.find((item) => item.number === chapterNumber) || null;
  const visibleBooks = useMemo(() => manifest.filter((item) => testament === 'all' || item.testament === testament), [manifest, testament]);

  const selectedPassage = useMemo(() => {
    if (!selectedRange || !book || !chapter) return null;
    const startVerse = selectedRange.start;
    const endVerse = selectedRange.end ?? startVerse;
    const verses = chapter.verses.filter((verse) => verse.number >= startVerse && verse.number <= endVerse);
    if (!verses.length) return null;

    return {
      bookId: book.id,
      bookSlug,
      bookName: book.name,
      chapter: chapter.number,
      verse: startVerse,
      startVerse,
      endVerse,
      firstVerseText: verses[0].text,
      text: verses.map((verse) => verse.text).join(' '),
    };
  }, [selectedRange, book, chapter, bookSlug]);

  useEffect(() => {
    if (!chapter || !highlightVerse) return;
    const id = `bible-verse-${bookSlug}-${chapterNumber}-${highlightVerse}`;
    const timer = window.setTimeout(() => {
      const element = document.getElementById(id);
      if (!element) return;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      element.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
      element.focus({ preventScroll: true });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [bookSlug, chapterNumber, highlightVerse, chapter]);

  function clearSelection() {
    setSelectedRange(null);
    setSelectionError('');
  }

  function clearHighlight() {
    setHighlightVerse(null);
    setHighlightEndVerse(null);
    setHighlightLabel('');
  }

  function changeTestament(nextTestament) {
    setTestament(nextTestament);
    clearSelection();
    const first = manifest.find((item) => nextTestament === 'all' || item.testament === nextTestament);
    if (first && !manifest.find((item) => item.slug === bookSlug && (nextTestament === 'all' || item.testament === nextTestament))) {
      setBookSlug(first.slug);
      setChapterNumber(1);
      clearHighlight();
    }
  }

  function openChapter(nextBookSlug, nextChapter) {
    setBookSlug(nextBookSlug);
    setChapterNumber(nextChapter);
    clearHighlight();
    clearSelection();
  }

  function goPrevious() {
    if (!book || !manifest.length) return;
    if (chapterNumber > 1) return openChapter(bookSlug, chapterNumber - 1);
    const index = manifest.findIndex((item) => item.slug === bookSlug);
    if (index > 0) openChapter(manifest[index - 1].slug, manifest[index - 1].chapterCount);
  }

  function goNext() {
    if (!book || !manifest.length) return;
    if (chapterNumber < book.chapters.length) return openChapter(bookSlug, chapterNumber + 1);
    const index = manifest.findIndex((item) => item.slug === bookSlug);
    if (index >= 0 && index < manifest.length - 1) openChapter(manifest[index + 1].slug, 1);
  }

  function chooseVerse(verse) {
    if (!book || !chapter) return;
    setSelectionError('');

    if (!selectedRange || selectedRange.end !== null) {
      setSelectedRange({ start: verse.number, end: null });
      return;
    }

    if (verse.number === selectedRange.start) {
      setSelectedRange({ start: verse.number, end: null });
      return;
    }

    const start = Math.min(selectedRange.start, verse.number);
    const end = Math.max(selectedRange.start, verse.number);
    if (end - start + 1 > MAX_SELECTED_VERSES) {
      setSelectionError(`Choose a contiguous passage of up to ${MAX_SELECTED_VERSES} verses.`);
      return;
    }

    setSelectedRange({ start, end });
  }

  const selectionReference = selectedPassage
    ? `${selectedPassage.bookName} ${selectedPassage.chapter}:${selectedPassage.startVerse}${selectedPassage.endVerse === selectedPassage.startVerse ? '' : `–${selectedPassage.endVerse}`}`
    : '';

  let selectionInstruction = 'Tap once for one verse, or tap another verse to set the ending.';
  if (selectedRange?.end === null) selectionInstruction = 'Tap another verse for the ending, or continue with this verse only.';
  if (selectedRange?.end !== null && selectedRange) selectionInstruction = 'Tap any new verse to begin a different selection.';

  return (
    <section className="bible-reader" aria-busy={loading}>
      <div className="bible-title-row">
        <div>
          <p className="dashboard-eyebrow">{selectionMode ? 'Additional devotion' : 'Scripture'}</p>
          <h2>{selectionMode ? 'Choose a passage' : 'Bible'}</h2>
          <p className="panel-intro">{selectionMode ? `Select one verse or up to ${MAX_SELECTED_VERSES} contiguous verses.` : 'Berean Standard Bible'}</p>
        </div>
        {selectionMode && <button className="secondary-button compact-button" type="button" onClick={onCancelSelection}>Back to choices</button>}
      </div>

      {selectionMode && <div className="selection-instructions" aria-live="polite"><strong>{selectedRange ? (selectedRange.end === null ? 'Starting verse selected' : 'Passage selected') : 'Select your starting verse'}</strong><p>{selectionInstruction}</p>{selectionError && <p className="selection-error" role="alert">{selectionError}</p>}</div>}

      <div className="testament-filter" aria-label="Filter Bible books by testament">
        {[["all", "All"], ["old", "Old Testament"], ["new", "New Testament"]].map(([value, label]) => <button key={value} className={testament === value ? 'active' : ''} type="button" onClick={() => changeTestament(value)}>{label}</button>)}
      </div>

      <div className="bible-controls">
        <label htmlFor="bible-book">Book<select id="bible-book" value={bookSlug} onChange={(event) => { setBookSlug(event.target.value); setChapterNumber(1); clearHighlight(); clearSelection(); }}>{visibleBooks.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label>
        <label htmlFor="bible-chapter">Chapter<select id="bible-chapter" value={chapterNumber} disabled={!book} onChange={(event) => { setChapterNumber(Number(event.target.value)); clearHighlight(); clearSelection(); }}>{book?.chapters.map((item) => <option key={item.number} value={item.number}>{item.number}</option>)}</select></label>
      </div>

      <div className="chapter-nav">
        <button type="button" onClick={goPrevious} disabled={!book || (bookSlug === manifest[0]?.slug && chapterNumber === 1)}>← Previous</button>
        <strong>{book ? `${book.name} ${chapterNumber}` : 'Loading chapter'}</strong>
        <button type="button" onClick={goNext} disabled={!book || (bookSlug === manifest.at(-1)?.slug && chapterNumber === book?.chapters.length)}>Next →</button>
      </div>

      {loading && <p className="status-message" aria-live="polite">Loading Scripture…</p>}
      {error && <p className="page-error" role="alert">{error}</p>}
      {!loading && !error && chapter && (
        <article className={`chapter-text ${selectionMode ? 'selecting-verses' : ''}`} aria-label={`${book.name} chapter ${chapter.number}`}>
          <div className="chapter-heading-row">
            <h3>{book.name} {chapter.number}</h3>
            {!selectionMode && onReturn && <button className="secondary-button passage-return-button" type="button" onClick={onReturn}>← Back to devotion</button>}
          </div>
          {chapter.verses.map((verse) => {
            const selectedEnd = selectedRange?.end ?? selectedRange?.start;
            const inSelectedRange = selectedRange && verse.number >= selectedRange.start && verse.number <= selectedEnd;
            const isStart = selectedRange?.start === verse.number;
            const isEnd = selectedRange?.end !== null && selectedRange?.end === verse.number;
            const selectionLabel = isStart && selectedRange?.end === null ? 'Start' : isStart ? 'Start' : isEnd ? 'End' : '';
            const effectiveHighlightEnd = highlightEndVerse ?? highlightVerse;
            const inHighlightRange = highlightVerse && verse.number >= highlightVerse && verse.number <= effectiveHighlightEnd;
            const isHighlightStart = highlightVerse === verse.number;
            const isHighlightEnd = effectiveHighlightEnd === verse.number;

            if (selectionMode) {
              return (
                <button
                  id={`bible-verse-${bookSlug}-${chapterNumber}-${verse.number}`}
                  key={verse.number}
                  className={`chapter-verse-button ${inSelectedRange ? 'selected-range' : ''} ${isStart ? 'range-start' : ''} ${isEnd ? 'range-end' : ''}`}
                  type="button"
                  aria-pressed={Boolean(inSelectedRange)}
                  onClick={() => chooseVerse(verse)}
                >
                  <span><sup>{verse.number}</sup>{verse.text}</span>
                  {selectionLabel && <span className="highlight-label">{selectionLabel}</span>}
                </button>
              );
            }

            if (onReturn && isHighlightEnd) {
              return (
                <div className="verse-return-anchor" key={verse.number}>
                  <p id={`bible-verse-${bookSlug}-${chapterNumber}-${verse.number}`} className={inHighlightRange ? 'highlighted-verse' : ''} tabIndex={isHighlightStart ? -1 : undefined}><sup>{verse.number}</sup>{verse.text}{isHighlightStart && highlightLabel && <span className="highlight-label">{highlightLabel}</span>}</p>
                  <div className="passage-return-row"><button className="secondary-button passage-return-button" type="button" onClick={onReturn}>← Back to devotion</button></div>
                </div>
              );
            }

            return <p id={`bible-verse-${bookSlug}-${chapterNumber}-${verse.number}`} key={verse.number} className={inHighlightRange ? 'highlighted-verse' : ''} tabIndex={isHighlightStart ? -1 : undefined}><sup>{verse.number}</sup>{verse.text}{isHighlightStart && highlightLabel && <span className="highlight-label">{highlightLabel}</span>}</p>;
          })}
        </article>
      )}

      {selectionMode && selectedPassage && (
        <div className="verse-selection-bar" aria-live="polite">
          <div><small>{selectedPassage.startVerse === selectedPassage.endVerse ? 'Selected verse' : 'Selected passage'}</small><strong>{selectionReference}</strong></div>
          <div className="verse-selection-actions">
            <button className="secondary-button" type="button" onClick={clearSelection}>Clear selection</button>
            <button className="primary-button" type="button" onClick={() => onSelectVerse(selectedPassage)}>Use this passage for devotion</button>
          </div>
        </div>
      )}

      <p className="bible-attribution">The Holy Bible, Berean Standard Bible (BSB). This text of God&apos;s Word has been dedicated to the public domain.</p>
    </section>
  );
}
