import { useEffect, useMemo, useState } from 'react';
import { loadBibleBook, loadBibleManifest } from '../lib/bible.js';

export default function BibleReader({ target, onReturn, selectionMode = false, onSelectVerse, onCancelSelection }) {
  const [manifest, setManifest] = useState([]);
  const [testament, setTestament] = useState(target?.testament || 'all');
  const [bookSlug, setBookSlug] = useState(target?.bookSlug || 'genesis');
  const [chapterNumber, setChapterNumber] = useState(target?.chapter || 1);
  const [highlightVerse, setHighlightVerse] = useState(target?.verse || null);
  const [selectedVerse, setSelectedVerse] = useState(null);
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
        if (!books.some((item) => item.slug === bookSlug)) setBookSlug(books[0].slug);
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
    setSelectedVerse(null);
    const matchingBook = manifest.find((item) => item.slug === target.bookSlug);
    if (matchingBook) setTestament(matchingBook.testament);
  }, [target?.bookSlug, target?.chapter, target?.verse, manifest]);

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

  const chapter = book?.chapters.find((item) => item.number === chapterNumber) || null;
  const visibleBooks = useMemo(() => manifest.filter((item) => testament === 'all' || item.testament === testament), [manifest, testament]);

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

  function changeTestament(nextTestament) {
    setTestament(nextTestament);
    setSelectedVerse(null);
    const first = manifest.find((item) => nextTestament === 'all' || item.testament === nextTestament);
    if (first && !manifest.find((item) => item.slug === bookSlug && (nextTestament === 'all' || item.testament === nextTestament))) {
      setBookSlug(first.slug);
      setChapterNumber(1);
      setHighlightVerse(null);
    }
  }

  function openChapter(nextBookSlug, nextChapter) {
    setBookSlug(nextBookSlug);
    setChapterNumber(nextChapter);
    setHighlightVerse(null);
    setSelectedVerse(null);
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
    setSelectedVerse({
      bookId: book.id,
      bookSlug,
      bookName: book.name,
      chapter: chapter.number,
      verse: verse.number,
      text: verse.text,
    });
  }

  return (
    <section className="bible-reader" aria-busy={loading}>
      <div className="bible-title-row">
        <div>
          <p className="dashboard-eyebrow">{selectionMode ? 'Personal devotion' : 'Scripture'}</p>
          <h2>{selectionMode ? 'Choose a verse' : 'Bible'}</h2>
          <p className="panel-intro">{selectionMode ? 'Tap one verse to use for your private devotion.' : 'Berean Standard Bible'}</p>
        </div>
        {selectionMode && <button className="secondary-button compact-button" type="button" onClick={onCancelSelection}>Back to choices</button>}
        {!selectionMode && onReturn && <button className="secondary-button compact-button" type="button" onClick={onReturn}>Return to devotion</button>}
      </div>

      {selectionMode && <div className="selection-instructions" aria-live="polite"><strong>Find your passage</strong><p>Choose a testament, book, and chapter below. Then tap the verse you want to reflect on.</p></div>}

      <div className="testament-filter" aria-label="Filter Bible books by testament">
        {[["all", "All"], ["old", "Old Testament"], ["new", "New Testament"]].map(([value, label]) => <button key={value} className={testament === value ? 'active' : ''} type="button" onClick={() => changeTestament(value)}>{label}</button>)}
      </div>

      <div className="bible-controls">
        <label htmlFor="bible-book">Book<select id="bible-book" value={bookSlug} onChange={(event) => { setBookSlug(event.target.value); setChapterNumber(1); setHighlightVerse(null); setSelectedVerse(null); }}>{visibleBooks.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label>
        <label htmlFor="bible-chapter">Chapter<select id="bible-chapter" value={chapterNumber} disabled={!book} onChange={(event) => { setChapterNumber(Number(event.target.value)); setHighlightVerse(null); setSelectedVerse(null); }}>{book?.chapters.map((item) => <option key={item.number} value={item.number}>{item.number}</option>)}</select></label>
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
          <h3>{book.name} {chapter.number}</h3>
          {chapter.verses.map((verse) => {
            const highlighted = verse.number === highlightVerse;
            const selected = selectedVerse?.verse === verse.number;

            if (selectionMode) {
              return (
                <button
                  id={`bible-verse-${bookSlug}-${chapterNumber}-${verse.number}`}
                  key={verse.number}
                  className={`chapter-verse-button ${selected ? 'selected-verse' : ''}`}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => chooseVerse(verse)}
                >
                  <span><sup>{verse.number}</sup>{verse.text}</span>
                  {selected && <span className="highlight-label">Selected</span>}
                </button>
              );
            }

            return <p id={`bible-verse-${bookSlug}-${chapterNumber}-${verse.number}`} key={verse.number} className={highlighted ? 'highlighted-verse' : ''} tabIndex={highlighted ? -1 : undefined}><sup>{verse.number}</sup>{verse.text}{highlighted && <span className="highlight-label">Today&apos;s verse</span>}</p>;
          })}
        </article>
      )}

      {selectionMode && selectedVerse && (
        <div className="verse-selection-bar" aria-live="polite">
          <div><small>Selected verse</small><strong>{selectedVerse.bookName} {selectedVerse.chapter}:{selectedVerse.verse}</strong></div>
          <button className="primary-button" type="button" onClick={() => onSelectVerse(selectedVerse)}>Start devotion with this verse</button>
        </div>
      )}

      <p className="bible-attribution">The Holy Bible, Berean Standard Bible (BSB). This text of God&apos;s Word has been dedicated to the public domain.</p>
    </section>
  );
}
