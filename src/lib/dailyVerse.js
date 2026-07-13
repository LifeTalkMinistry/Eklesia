import dailyVersePool from '../data/dailyVersePool.js';
import { getBibleVerse } from './bible.js';

export const DAILY_VERSE_EPOCH = '2026-07-13';
const MANILA_TIME_ZONE = 'Asia/Manila';

function parseDateKey(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error(`Invalid date key: ${dateKey}`);
  const [year, month, day] = dateKey.split('-').map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error(`Invalid calendar date: ${dateKey}`);
  return timestamp;
}

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
  const random = seededRandom(hashSeed(`eklesia-daily-verse:${cycle}`));
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

export function getManilaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function formatManilaDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TIME_ZONE,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function getManilaGreeting(date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: MANILA_TIME_ZONE, hour: '2-digit', hourCycle: 'h23' }).format(date));
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function getDailyVerseSelection(dateKey = getManilaDateKey()) {
  if (!dailyVersePool.length) throw new Error('The daily verse pool is empty.');
  const daysSinceEpoch = Math.floor((parseDateKey(dateKey) - parseDateKey(DAILY_VERSE_EPOCH)) / 86400000);
  const safeDay = Math.max(0, daysSinceEpoch);
  const cycle = Math.floor(safeDay / dailyVersePool.length);
  const position = safeDay % dailyVersePool.length;
  return { ...shuffledPool(cycle)[position], dateKey, cycle, cyclePosition: position };
}

export async function getDailyVerseForDate(dateKey = getManilaDateKey()) {
  const selection = getDailyVerseSelection(dateKey);
  const { verse } = await getBibleVerse(selection.bookSlug, selection.chapter, selection.verse);
  return { ...selection, text: verse.text, reference: `${selection.bookName} ${selection.chapter}:${selection.verse}` };
}
