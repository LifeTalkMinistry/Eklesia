const manifestCache = { value: null, promise: null };
const bookCache = new Map();

function dataUrl(relativePath) {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.replace(/\/$/, '')}/data/bible/bsb/${relativePath.replace(/^\//, '')}`;
}

async function fetchJson(url, label) {
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(`Unable to load ${label}. Check your connection and try again.`, { cause: error });
  }
  if (!response.ok) throw new Error(`Unable to load ${label} (${response.status}).`);
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`${label} contains invalid JSON.`, { cause: error });
  }
}

export async function loadBibleManifest() {
  if (manifestCache.value) return manifestCache.value;
  if (!manifestCache.promise) {
    manifestCache.promise = fetchJson(dataUrl('manifest.json'), 'the Bible book list')
      .then((manifest) => {
        if (!Array.isArray(manifest) || manifest.length !== 66) throw new Error('The Bible book list is incomplete.');
        manifestCache.value = manifest;
        return manifest;
      })
      .catch((error) => {
        manifestCache.promise = null;
        throw error;
      });
  }
  return manifestCache.promise;
}

export async function loadBibleBook(bookSlug) {
  if (!bookSlug) throw new Error('A Bible book is required.');
  if (bookCache.has(bookSlug)) return bookCache.get(bookSlug);
  const promise = fetchJson(dataUrl(`books/${bookSlug}.json`), `${bookSlug} Bible data`)
    .then((book) => {
      if (!book || book.slug !== bookSlug || !Array.isArray(book.chapters)) throw new Error(`Bible data for ${bookSlug} is malformed.`);
      return book;
    })
    .catch((error) => {
      bookCache.delete(bookSlug);
      throw error;
    });
  bookCache.set(bookSlug, promise);
  return promise;
}

export async function getBibleChapter(bookSlug, chapterNumber) {
  const number = Number(chapterNumber);
  if (!Number.isInteger(number) || number < 1) throw new Error('The chapter number must be a positive integer.');
  const book = await loadBibleBook(bookSlug);
  const chapter = book.chapters.find((item) => item.number === number);
  if (!chapter) throw new Error(`${book.name} chapter ${number} is unavailable.`);
  return { book, chapter };
}

export async function getBibleVerse(bookSlug, chapterNumber, verseNumber) {
  const number = Number(verseNumber);
  if (!Number.isInteger(number) || number < 1) throw new Error('The verse number must be a positive integer.');
  const { book, chapter } = await getBibleChapter(bookSlug, chapterNumber);
  const verse = chapter.verses.find((item) => item.number === number);
  if (!verse) throw new Error(`${book.name} ${chapter.number}:${number} is unavailable.`);
  return { book, chapter, verse };
}
