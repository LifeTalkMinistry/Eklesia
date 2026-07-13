import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://bereanbible.com/bsb.txt';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outputRoot = path.join(root, 'public', 'data', 'bible', 'bsb');

const BOOKS = [
  ['GEN', 'genesis', 'Genesis', 'old'], ['EXO', 'exodus', 'Exodus', 'old'],
  ['LEV', 'leviticus', 'Leviticus', 'old'], ['NUM', 'numbers', 'Numbers', 'old'],
  ['DEU', 'deuteronomy', 'Deuteronomy', 'old'], ['JOS', 'joshua', 'Joshua', 'old'],
  ['JDG', 'judges', 'Judges', 'old'], ['RUT', 'ruth', 'Ruth', 'old'],
  ['1SA', '1-samuel', '1 Samuel', 'old'], ['2SA', '2-samuel', '2 Samuel', 'old'],
  ['1KI', '1-kings', '1 Kings', 'old'], ['2KI', '2-kings', '2 Kings', 'old'],
  ['1CH', '1-chronicles', '1 Chronicles', 'old'], ['2CH', '2-chronicles', '2 Chronicles', 'old'],
  ['EZR', 'ezra', 'Ezra', 'old'], ['NEH', 'nehemiah', 'Nehemiah', 'old'],
  ['EST', 'esther', 'Esther', 'old'], ['JOB', 'job', 'Job', 'old'],
  ['PSA', 'psalms', 'Psalms', 'old'], ['PRO', 'proverbs', 'Proverbs', 'old'],
  ['ECC', 'ecclesiastes', 'Ecclesiastes', 'old'], ['SNG', 'song-of-solomon', 'Song of Solomon', 'old'],
  ['ISA', 'isaiah', 'Isaiah', 'old'], ['JER', 'jeremiah', 'Jeremiah', 'old'],
  ['LAM', 'lamentations', 'Lamentations', 'old'], ['EZK', 'ezekiel', 'Ezekiel', 'old'],
  ['DAN', 'daniel', 'Daniel', 'old'], ['HOS', 'hosea', 'Hosea', 'old'],
  ['JOL', 'joel', 'Joel', 'old'], ['AMO', 'amos', 'Amos', 'old'],
  ['OBA', 'obadiah', 'Obadiah', 'old'], ['JON', 'jonah', 'Jonah', 'old'],
  ['MIC', 'micah', 'Micah', 'old'], ['NAM', 'nahum', 'Nahum', 'old'],
  ['HAB', 'habakkuk', 'Habakkuk', 'old'], ['ZEP', 'zephaniah', 'Zephaniah', 'old'],
  ['HAG', 'haggai', 'Haggai', 'old'], ['ZEC', 'zechariah', 'Zechariah', 'old'],
  ['MAL', 'malachi', 'Malachi', 'old'], ['MAT', 'matthew', 'Matthew', 'new'],
  ['MRK', 'mark', 'Mark', 'new'], ['LUK', 'luke', 'Luke', 'new'],
  ['JHN', 'john', 'John', 'new'], ['ACT', 'acts', 'Acts', 'new'],
  ['ROM', 'romans', 'Romans', 'new'], ['1CO', '1-corinthians', '1 Corinthians', 'new'],
  ['2CO', '2-corinthians', '2 Corinthians', 'new'], ['GAL', 'galatians', 'Galatians', 'new'],
  ['EPH', 'ephesians', 'Ephesians', 'new'], ['PHP', 'philippians', 'Philippians', 'new'],
  ['COL', 'colossians', 'Colossians', 'new'], ['1TH', '1-thessalonians', '1 Thessalonians', 'new'],
  ['2TH', '2-thessalonians', '2 Thessalonians', 'new'], ['1TI', '1-timothy', '1 Timothy', 'new'],
  ['2TI', '2-timothy', '2 Timothy', 'new'], ['TIT', 'titus', 'Titus', 'new'],
  ['PHM', 'philemon', 'Philemon', 'new'], ['HEB', 'hebrews', 'Hebrews', 'new'],
  ['JAS', 'james', 'James', 'new'], ['1PE', '1-peter', '1 Peter', 'new'],
  ['2PE', '2-peter', '2 Peter', 'new'], ['1JN', '1-john', '1 John', 'new'],
  ['2JN', '2-john', '2 John', 'new'], ['3JN', '3-john', '3 John', 'new'],
  ['JUD', 'jude', 'Jude', 'new'], ['REV', 'revelation', 'Revelation', 'new'],
].map(([id, slug, name, testament], index) => ({ id, slug, name, testament, order: index + 1 }));

async function getSourceText() {
  const suppliedPath = process.argv[2] || process.env.BSB_SOURCE_FILE;
  if (suppliedPath) return readFile(path.resolve(suppliedPath), 'utf8');

  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`Official BSB download failed: ${response.status} ${response.statusText}`);
  return response.text();
}

function parseSource(source) {
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (!lines[0]?.includes('Berean Standard Bible') || !lines[1]?.includes('public domain')) {
    throw new Error('The source header does not identify the official public-domain Berean Standard Bible text.');
  }
  const data = new Map(BOOKS.map((book) => [book.name, new Map()]));
  let parsedVerseCount = 0;
  const omittedPlaceholders = [];

  for (const [index, line] of lines.entries()) {
    if (index < 3 || !line.trim()) continue;
    const match = line.match(/^(.+?) (\d+):(\d+)\t(.*)$/);
    if (!match) throw new Error(`Malformed source line ${index + 1}: ${line.slice(0, 120)}`);
    const [, sourceBookName, chapterRaw, verseRaw, text] = match;
    const bookName = sourceBookName === 'Psalm' ? 'Psalms' : sourceBookName;
    if (!data.has(bookName)) throw new Error(`Unexpected or non-canonical book at line ${index + 1}: ${sourceBookName}`);
    const chapterNumber = Number(chapterRaw);
    const verseNumber = Number(verseRaw);
    if (!Number.isInteger(chapterNumber) || chapterNumber < 1 || !Number.isInteger(verseNumber) || verseNumber < 1) {
      throw new Error(`Invalid verse reference at line ${index + 1}`);
    }
    if (!text.trim()) {
      omittedPlaceholders.push(`${bookName} ${chapterNumber}:${verseNumber}`);
      continue;
    }
    const chapters = data.get(bookName);
    if (!chapters.has(chapterNumber)) chapters.set(chapterNumber, []);
    const verses = chapters.get(chapterNumber);
    if (verses.some((verse) => verse.number === verseNumber)) throw new Error(`Duplicate ${bookName} ${chapterNumber}:${verseNumber}`);
    verses.push({ number: verseNumber, text });
    parsedVerseCount += 1;
  }

  return { data, parsedVerseCount, omittedPlaceholders };
}

async function main() {
  const source = await getSourceText();
  const { data, parsedVerseCount, omittedPlaceholders } = parseSource(source);
  await mkdir(path.join(outputRoot, 'books'), { recursive: true });
  const manifest = [];
  let chapterCount = 0;

  for (const book of BOOKS) {
    const sourceChapters = data.get(book.name);
    if (!sourceChapters?.size) throw new Error(`Missing book: ${book.name}`);
    const chapterNumbers = [...sourceChapters.keys()].sort((a, b) => a - b);
    chapterNumbers.forEach((number, index) => {
      if (number !== index + 1) throw new Error(`Missing chapter in ${book.name}; expected ${index + 1}, found ${number}`);
    });
    const chapters = chapterNumbers.map((number) => {
      const verses = sourceChapters.get(number).sort((a, b) => a.number - b.number);
      if (!verses.length) throw new Error(`No non-empty verses found in ${book.name} ${number}.`);
      return { number, verses };
    });
    chapterCount += chapters.length;
    const bookFile = { id: book.id, slug: book.slug, name: book.name, testament: book.testament, chapters };
    await writeFile(path.join(outputRoot, 'books', `${book.slug}.json`), `${JSON.stringify(bookFile)}\n`, 'utf8');
    manifest.push({ ...book, chapterCount: chapters.length });
  }

  await writeFile(path.join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  if (omittedPlaceholders.length) console.warn(`Skipped ${omittedPlaceholders.length} empty verse-number placeholders present in the official source: ${omittedPlaceholders.join(', ')}`);
  console.log(`Imported ${BOOKS.length} books, ${chapterCount} chapters, and ${parsedVerseCount} non-empty verses from ${SOURCE_URL}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
