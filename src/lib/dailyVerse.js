import dailyVersePool from '../data/dailyVersePool.js';
import { getBibleVerse } from './bible.js';
import {
  formatManilaDate,
  getManilaDateKey,
  getManilaGreeting,
  parseDateKey,
} from './manilaTime.js';

export const DAILY_VERSE_EPOCH = '2026-07-13';
export { formatManilaDate, getManilaDateKey, getManilaGreeting };

function hashSeed(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledPool(cycle) {
  const items = dailyVersePool.slice();
  const random = seededRandom(hashSeed(`ekklesia-pulse-daily-verse:${cycle}`));
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function referenceFor(item) {
  return `${item.bookName} ${item.chapter}:${item.verse}`;
}

export function getDailyVerseSelection(dateKey = getManilaDateKey()) {
  if (!dailyVersePool.length) throw new Error('The daily verse pool is empty.');
  const selectedDate = parseDateKey(dateKey);
  const epoch = parseDateKey(DAILY_VERSE_EPOCH);
  if (!selectedDate || !epoch) throw new Error(`Invalid date key: ${dateKey}`);
  const daysSinceEpoch = Math.floor((selectedDate.timestamp - epoch.timestamp) / 86400000);
  const safeDay = Math.max(0, daysSinceEpoch);
  const cycle = Math.floor(safeDay / dailyVersePool.length);
  const position = safeDay % dailyVersePool.length;
  return { ...shuffledPool(cycle)[position], dateKey, cycle, cyclePosition: position };
}

export async function getDailyVerseForDate(dateKey = getManilaDateKey()) {
  const selection = getDailyVerseSelection(dateKey);
  const { verse } = await getBibleVerse(selection.bookSlug, selection.chapter, selection.verse);
  return {
    ...selection,
    text: verse.text,
    scriptureText: verse.text,
    reference: referenceFor(selection),
    source: 'daily-suggestion',
  };
}

export function getEligibleAdditionalVerses({ officialReference = '', recentReferences = [] } = {}) {
  const recent = new Set(recentReferences);
  const withoutOfficial = dailyVersePool.filter((item) => referenceFor(item) !== officialReference);
  const withoutRecent = withoutOfficial.filter((item) => !recent.has(referenceFor(item)));
  return withoutRecent.length ? withoutRecent : withoutOfficial;
}

export function getAdditionalVerseSuggestion({
  dateKey = getManilaDateKey(),
  officialReference = '',
  recentReferences = [],
  sessionSeed = '0',
} = {}) {
  const eligible = getEligibleAdditionalVerses({ officialReference, recentReferences });
  if (!eligible.length) return null;
  const numericSeed = Number.parseInt(sessionSeed, 10);
  const offset = Number.isFinite(numericSeed) ? numericSeed : hashSeed(String(sessionSeed));
  const index = (hashSeed(`ekklesia-pulse-additional:${dateKey}`) + offset) % eligible.length;
  const selected = eligible[index];
  return {
    ...selected,
    dateKey,
    reference: referenceFor(selected),
    source: 'additional-suggestion',
  };
}

export async function getAdditionalVerseForSession(options = {}) {
  const selection = getAdditionalVerseSuggestion(options);
  if (!selection) return null;
  const { verse } = await getBibleVerse(selection.bookSlug, selection.chapter, selection.verse);
  return { ...selection, text: verse.text, scriptureText: verse.text };
}
