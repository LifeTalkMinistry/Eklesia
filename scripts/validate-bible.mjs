import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const bibleRoot = path.join(root, 'public', 'data', 'bible', 'bsb');
const expectedBooks = [
  ['GEN','genesis'],['EXO','exodus'],['LEV','leviticus'],['NUM','numbers'],['DEU','deuteronomy'],['JOS','joshua'],['JDG','judges'],['RUT','ruth'],['1SA','1-samuel'],['2SA','2-samuel'],['1KI','1-kings'],['2KI','2-kings'],['1CH','1-chronicles'],['2CH','2-chronicles'],['EZR','ezra'],['NEH','nehemiah'],['EST','esther'],['JOB','job'],['PSA','psalms'],['PRO','proverbs'],['ECC','ecclesiastes'],['SNG','song-of-solomon'],['ISA','isaiah'],['JER','jeremiah'],['LAM','lamentations'],['EZK','ezekiel'],['DAN','daniel'],['HOS','hosea'],['JOL','joel'],['AMO','amos'],['OBA','obadiah'],['JON','jonah'],['MIC','micah'],['NAM','nahum'],['HAB','habakkuk'],['ZEP','zephaniah'],['HAG','haggai'],['ZEC','zechariah'],['MAL','malachi'],['MAT','matthew'],['MRK','mark'],['LUK','luke'],['JHN','john'],['ACT','acts'],['ROM','romans'],['1CO','1-corinthians'],['2CO','2-corinthians'],['GAL','galatians'],['EPH','ephesians'],['PHP','philippians'],['COL','colossians'],['1TH','1-thessalonians'],['2TH','2-thessalonians'],['1TI','1-timothy'],['2TI','2-timothy'],['TIT','titus'],['PHM','philemon'],['HEB','hebrews'],['JAS','james'],['1PE','1-peter'],['2PE','2-peter'],['1JN','1-john'],['2JN','2-john'],['3JN','3-john'],['JUD','jude'],['REV','revelation'],
];

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function fail(message) {
  throw new Error(message);
}

async function main() {
  const manifest = await readJson(path.join(bibleRoot, 'manifest.json'));
  if (!Array.isArray(manifest) || manifest.length !== 66) fail(`Expected exactly 66 books, found ${manifest.length}.`);

  const ids = new Set();
  const booksBySlug = new Map();
  let chapterCount = 0;
  let verseCount = 0;

  for (let index = 0; index < expectedBooks.length; index += 1) {
    const [expectedId, expectedSlug] = expectedBooks[index];
    const entry = manifest[index];
    if (!entry || entry.id !== expectedId || entry.slug !== expectedSlug || entry.order !== index + 1) fail(`Canonical order mismatch at position ${index + 1}.`);
    if (ids.has(entry.id)) fail(`Duplicate book ID: ${entry.id}`);
    ids.add(entry.id);
    const bookPath = path.join(bibleRoot, 'books', `${entry.slug}.json`);
    await access(bookPath);
    const book = await readJson(bookPath);
    if (book.id !== entry.id || book.slug !== entry.slug || book.name !== entry.name || book.testament !== entry.testament) fail(`Book metadata mismatch: ${entry.slug}`);
    if (!Array.isArray(book.chapters) || !book.chapters.length) fail(`${entry.name} has no chapters.`);
    if (book.chapters.length !== entry.chapterCount) fail(`${entry.name} chapter count does not match the manifest.`);
    const chapterNumbers = new Set();
    for (const chapter of book.chapters) {
      if (!Number.isInteger(chapter.number) || chapter.number < 1 || chapterNumbers.has(chapter.number)) fail(`Invalid or duplicate chapter in ${entry.name}.`);
      chapterNumbers.add(chapter.number);
      if (!Array.isArray(chapter.verses) || !chapter.verses.length) fail(`${entry.name} ${chapter.number} has no verses.`);
      const verseNumbers = new Set();
      for (const verse of chapter.verses) {
        if (!Number.isInteger(verse.number) || verse.number < 1 || verseNumbers.has(verse.number)) fail(`Invalid or duplicate verse in ${entry.name} ${chapter.number}.`);
        if (typeof verse.text !== 'string' || !verse.text.trim()) fail(`Empty verse text in ${entry.name} ${chapter.number}:${verse.number}.`);
        verseNumbers.add(verse.number);
        verseCount += 1;
      }
    }
    chapterCount += book.chapters.length;
    booksBySlug.set(book.slug, book);
  }

  const poolModule = await import(`${pathToFileURL(path.join(root, 'src', 'data', 'dailyVersePool.js')).href}?validation=${Date.now()}`);
  const pool = poolModule.dailyVersePool;
  if (!Array.isArray(pool) || !pool.length) fail('The curated daily verse pool is empty.');
  const representedBooks = new Set();
  const entryIds = new Set();
  const allowedKeys = new Set(['id','bookId','bookSlug','bookName','chapter','verse','title','theme','prompt']);

  for (const entry of pool) {
    if (!entry || typeof entry !== 'object') fail('A curated daily verse entry is invalid.');
    if (entryIds.has(entry.id)) fail(`Duplicate curated entry ID: ${entry.id}`);
    entryIds.add(entry.id);
    for (const key of Object.keys(entry)) if (!allowedKeys.has(key)) fail(`Unexpected field "${key}" in ${entry.id}. Bible text must not be stored in the curated pool.`);
    if ('text' in entry) fail(`Bible text is stored in curated entry ${entry.id}.`);
    for (const field of ['id','bookId','bookSlug','bookName','title','theme','prompt']) if (typeof entry[field] !== 'string' || !entry[field].trim()) fail(`${entry.id || 'Curated entry'} is missing ${field}.`);
    if (!Number.isInteger(entry.chapter) || entry.chapter < 1 || !Number.isInteger(entry.verse) || entry.verse < 1) fail(`${entry.id} has an invalid reference.`);
    const book = booksBySlug.get(entry.bookSlug);
    if (!book || book.id !== entry.bookId || book.name !== entry.bookName) fail(`${entry.id} points to mismatched book metadata.`);
    const chapter = book.chapters.find((item) => item.number === entry.chapter);
    const verse = chapter?.verses.find((item) => item.number === entry.verse);
    if (!verse) fail(`${entry.id} does not resolve to an actual BSB verse.`);
    representedBooks.add(entry.bookId);
  }

  for (const [bookId] of expectedBooks) if (!representedBooks.has(bookId)) fail(`Curated pool does not include ${bookId}.`);

  const poolSource = await readFile(path.join(root, 'src', 'data', 'dailyVersePool.js'), 'utf8');
  if (/\btext\s*:/.test(poolSource) || /“[^”]{25,}”/.test(poolSource)) fail('dailyVersePool.js appears to contain Bible text.');

  console.log(`Bible validation passed: ${manifest.length} books, ${chapterCount} chapters, ${verseCount} verses, ${pool.length} curated entries.`);
}

main().catch((error) => {
  console.error(`Bible validation failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
