import {
  DAY_IN_MS,
  MANILA_TIME_ZONE,
  formatManilaDateKey,
  getManilaDateKey,
  getManilaTimestamp,
  parseDateKey,
  shiftDateKey,
} from '../lib/manilaTime.js';

export const DEVOTIONS_STORAGE_KEY = 'ekklesiaPulse.devotions';
export const LAST_BIBLE_LOCATION_KEY = 'ekklesiaPulse.lastBibleLocation';
export const DEVOTION_DATA_VERSION_KEY = 'ekklesiaPulse.devotionDataVersion';
export const DEVOTION_DATA_VERSION = 3;

const LEGACY_HISTORY_KEY = 'ekklesiaPulse-wgap-history-v1';
const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const VALID_SOURCES = new Set(['daily-suggestion', 'additional-suggestion', 'bible-selection', 'continue-reading', 'notebook-capture']);

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error('Ekklesia Pulse local data could not be parsed', error);
    return fallback;
  }
}

function createUniqueId(dateKey) {
  const randomPart = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `devotion-${dateKey}-${randomPart}`;
}

function inferDateKey(entry) {
  if (parseDateKey(entry?.dateKey)) return entry.dateKey;
  if (!entry?.completedAt) return null;
  const completedAt = new Date(entry.completedAt);
  return Number.isNaN(completedAt.getTime()) ? null : getManilaDateKey(completedAt);
}

function normalizeWgap(wgap = {}) {
  return {
    word: typeof wgap.word === 'string' ? wgap.word.trim() : '',
    gratitude: typeof wgap.gratitude === 'string'
      ? wgap.gratitude.trim()
      : typeof wgap.getsKo === 'string' ? wgap.getsKo.trim() : '',
    application: typeof wgap.application === 'string' ? wgap.application.trim() : '',
    prayer: typeof wgap.prayer === 'string' ? wgap.prayer.trim() : '',
  };
}

function normalizeStoredEntry(entry, dailyDates = new Set()) {
  if (!entry || typeof entry !== 'object') return null;
  const devotion = entry.devotion && typeof entry.devotion === 'object' ? entry.devotion : entry;
  const dateKey = inferDateKey(entry);
  if (!dateKey) return null;

  const devotionFormat = entry.devotionFormat === 'notebook' || devotion.devotionFormat === 'notebook'
    ? 'notebook'
    : 'digital';
  const isNotebook = devotionFormat === 'notebook';
  const verseStart = Number(devotion.verseStart ?? devotion.startVerse ?? devotion.verse);
  const verseEnd = Number(devotion.verseEnd ?? devotion.endVerse ?? verseStart);
  const completedAtDate = new Date(entry.completedAt || Date.now());
  const completedAt = Number.isNaN(completedAtDate.getTime()) ? getManilaTimestamp() : completedAtDate.toISOString();
  const requestedType = entry.type === 'additional' ? 'additional' : 'daily';
  const type = requestedType === 'daily' && dailyDates.has(dateKey) ? 'additional' : requestedType;
  if (type === 'daily') dailyDates.add(dateKey);

  const imageId = typeof entry.imageId === 'string' && entry.imageId.trim()
    ? entry.imageId.trim()
    : typeof devotion.imageId === 'string' && devotion.imageId.trim() ? devotion.imageId.trim() : null;

  return {
    id: typeof entry.id === 'string' && entry.id ? entry.id : createUniqueId(dateKey),
    submissionKey: typeof entry.submissionKey === 'string' ? entry.submissionKey : '',
    dateKey,
    completedAt,
    type,
    source: VALID_SOURCES.has(entry.source)
      ? entry.source
      : VALID_SOURCES.has(devotion.source)
        ? devotion.source
        : isNotebook ? 'notebook-capture' : devotion.devotionType === 'personal' ? 'bible-selection' : 'daily-suggestion',
    devotionFormat,
    imageId,
    imageCount: imageId ? 1 : 0,
    note: typeof entry.note === 'string'
      ? entry.note.trim()
      : typeof devotion.note === 'string' ? devotion.note.trim() : '',
    bookId: isNotebook ? '' : devotion.bookId || '',
    bookSlug: isNotebook ? '' : devotion.bookSlug || '',
    bookName: isNotebook ? '' : devotion.bookName || '',
    chapter: isNotebook ? 0 : Number(devotion.chapter) || 1,
    verseStart: isNotebook ? 0 : Number.isFinite(verseStart) ? verseStart : 1,
    verseEnd: isNotebook ? 0 : Number.isFinite(verseEnd) ? verseEnd : Number.isFinite(verseStart) ? verseStart : 1,
    reference: isNotebook
      ? String(devotion.reference || '').trim()
      : devotion.reference || 'Scripture reflection',
    translation: isNotebook ? '' : devotion.translation || 'BSB',
    title: isNotebook
      ? String(devotion.title || '').trim()
      : devotion.title || 'Personal Scripture reflection',
    theme: isNotebook ? 'Handwritten reflection' : devotion.theme || (devotion.devotionType === 'personal' ? 'Selected from the Bible' : ''),
    prompt: isNotebook ? '' : devotion.prompt || (devotion.devotionType === 'personal' ? 'What is God showing you through this passage?' : ''),
    scriptureText: isNotebook ? '' : devotion.scriptureText || devotion.fullText || devotion.text || devotion.previewText || '',
    reflection: typeof entry.reflection === 'string' ? entry.reflection : '',
    wgap: normalizeWgap(entry.wgap),
  };
}

function sortNewestFirst(entries) {
  return [...entries].sort((a, b) => {
    if (a.dateKey !== b.dateKey) return b.dateKey.localeCompare(a.dateKey);
    return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
  });
}

function readStoredDevotions() {
  if (typeof window === 'undefined') return [];
  const parsed = safeParse(window.localStorage.getItem(DEVOTIONS_STORAGE_KEY), []);
  if (!Array.isArray(parsed)) return [];
  const dailyDates = new Set();
  return sortNewestFirst(parsed.map((entry) => normalizeStoredEntry(entry, dailyDates)).filter(Boolean));
}

function migrateLegacyData() {
  if (typeof window === 'undefined') return;
  const currentVersion = Number(window.localStorage.getItem(DEVOTION_DATA_VERSION_KEY) || 0);
  if (currentVersion >= DEVOTION_DATA_VERSION) return;

  try {
    const existing = readStoredDevotions();
    const legacy = safeParse(window.localStorage.getItem(LEGACY_HISTORY_KEY), []);
    const candidates = [...existing, ...(Array.isArray(legacy) ? legacy : [])];
    const dailyDates = new Set();
    const seenIds = new Set();
    const migrated = [];

    candidates.forEach((candidate) => {
      const normalized = normalizeStoredEntry(candidate, dailyDates);
      if (!normalized) return;
      const dedupeKey = `${normalized.id}:${normalized.completedAt}:${normalized.reference}`;
      if (seenIds.has(dedupeKey)) return;
      seenIds.add(dedupeKey);
      migrated.push(normalized);
    });

    window.localStorage.setItem(DEVOTIONS_STORAGE_KEY, JSON.stringify(sortNewestFirst(migrated)));
    window.localStorage.setItem(DEVOTION_DATA_VERSION_KEY, String(DEVOTION_DATA_VERSION));
  } catch (error) {
    console.error('Legacy devotion migration could not be completed', error);
  }
}

function writeDevotions(entries) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEVOTIONS_STORAGE_KEY, JSON.stringify(sortNewestFirst(entries)));
}

export function getAllDevotions() {
  migrateLegacyData();
  return readStoredDevotions();
}

export function getDevotionsForDate(dateKey, entries = getAllDevotions()) {
  return sortNewestFirst(entries.filter((entry) => entry.dateKey === dateKey));
}

export function getOfficialDailyDevotion(dateKey = getManilaDateKey(), entries = getAllDevotions()) {
  return entries.find((entry) => entry.dateKey === dateKey && entry.type === 'daily') || null;
}

export function hasCompletedDailyRhythm(dateKey = getManilaDateKey(), entries = getAllDevotions()) {
  return Boolean(getOfficialDailyDevotion(dateKey, entries));
}

export function getAdditionalDevotionsForDate(dateKey = getManilaDateKey(), entries = getAllDevotions()) {
  return getDevotionsForDate(dateKey, entries).filter((entry) => entry.type === 'additional');
}

export function saveCompletedDevotion(devotion, wgap, options = {}) {
  if (!devotion || typeof devotion !== 'object') throw new Error('A valid devotion is required.');
  const currentEntries = getAllDevotions();
  const submissionKey = typeof options.submissionKey === 'string' ? options.submissionKey : '';
  const duplicate = submissionKey
    ? currentEntries.find((entry) => entry.submissionKey === submissionKey)
    : null;
  if (duplicate) return { entry: duplicate, type: duplicate.type, isDuplicate: true };

  const completedAt = options.completedAt instanceof Date ? options.completedAt : new Date();
  const dateKey = getManilaDateKey(completedAt);
  const officialExists = currentEntries.some((entry) => entry.dateKey === dateKey && entry.type === 'daily');
  const finalType = officialExists ? 'additional' : 'daily';
  const verseStart = Number(devotion.verseStart ?? devotion.startVerse ?? devotion.verse) || 1;
  const verseEnd = Number(devotion.verseEnd ?? devotion.endVerse ?? verseStart) || verseStart;
  const source = VALID_SOURCES.has(devotion.source)
    ? devotion.source
    : finalType === 'daily' ? 'daily-suggestion' : 'additional-suggestion';

  const entry = {
    id: createUniqueId(dateKey),
    submissionKey,
    dateKey,
    completedAt: completedAt.toISOString(),
    type: finalType,
    source,
    devotionFormat: 'digital',
    imageId: null,
    imageCount: 0,
    note: '',
    bookId: devotion.bookId || '',
    bookSlug: devotion.bookSlug || '',
    bookName: devotion.bookName || '',
    chapter: Number(devotion.chapter) || 1,
    verseStart,
    verseEnd,
    reference: devotion.reference || 'Scripture reflection',
    translation: 'BSB',
    title: devotion.title || 'Personal Scripture reflection',
    theme: devotion.theme || 'Selected from the Bible',
    prompt: devotion.prompt || 'What is God showing you through this passage?',
    scriptureText: devotion.fullText || devotion.scriptureText || devotion.text || devotion.previewText || '',
    reflection: typeof devotion.reflection === 'string' ? devotion.reflection : '',
    wgap: normalizeWgap(wgap),
  };

  writeDevotions([entry, ...currentEntries]);
  return { entry, type: finalType, isDuplicate: false };
}


export function saveNotebookDevotion(notebookDetails, options = {}) {
  if (!notebookDetails || typeof notebookDetails !== 'object') {
    throw new Error('Notebook devotion details are required.');
  }

  const imageId = typeof notebookDetails.imageId === 'string' ? notebookDetails.imageId.trim() : '';
  if (!imageId) throw new Error('A saved notebook image is required.');

  const currentEntries = getAllDevotions();
  const submissionKey = typeof options.submissionKey === 'string' ? options.submissionKey : '';
  const duplicate = submissionKey
    ? currentEntries.find((entry) => entry.submissionKey === submissionKey)
    : null;
  if (duplicate) return { entry: duplicate, type: duplicate.type, isDuplicate: true };

  const completedAt = options.completedAt instanceof Date ? options.completedAt : new Date();
  const dateKey = getManilaDateKey(completedAt);
  const officialExists = currentEntries.some((entry) => entry.dateKey === dateKey && entry.type === 'daily');
  const finalType = officialExists ? 'additional' : 'daily';

  const entry = {
    id: createUniqueId(dateKey),
    submissionKey,
    dateKey,
    completedAt: completedAt.toISOString(),
    type: finalType,
    source: 'notebook-capture',
    devotionFormat: 'notebook',
    imageId,
    imageCount: 1,
    note: String(notebookDetails.note || '').trim().slice(0, 300),
    bookId: '',
    bookSlug: '',
    bookName: '',
    chapter: 0,
    verseStart: 0,
    verseEnd: 0,
    reference: String(notebookDetails.reference || '').trim().slice(0, 80),
    translation: '',
    title: String(notebookDetails.title || '').trim().slice(0, 100),
    theme: 'Handwritten reflection',
    prompt: '',
    scriptureText: '',
    reflection: '',
    wgap: normalizeWgap(),
  };

  writeDevotions([entry, ...currentEntries]);
  return { entry, type: finalType, isDuplicate: false };
}

export function updateNotebookImageReference(entryId, imageId) {
  const currentEntries = getAllDevotions();
  const targetIndex = currentEntries.findIndex((entry) => entry.id === entryId);
  if (targetIndex < 0) throw new Error('The notebook devotion could not be found.');

  const target = currentEntries[targetIndex];
  if (target.devotionFormat !== 'notebook') throw new Error('The selected devotion is not a notebook devotion.');

  const nextImageId = typeof imageId === 'string' && imageId.trim() ? imageId.trim() : null;
  const updated = {
    ...target,
    imageId: nextImageId,
    imageCount: nextImageId ? 1 : 0,
  };
  const nextEntries = [...currentEntries];
  nextEntries[targetIndex] = updated;
  writeDevotions(nextEntries);
  return updated;
}

export function getJourneyEntries(entries = getAllDevotions()) {
  return sortNewestFirst(entries);
}

function completedDateSet(entries) {
  return new Set(entries.map((entry) => entry.dateKey).filter((dateKey) => parseDateKey(dateKey)));
}

export function getWeeklyRhythm(referenceDate = new Date(), entries = getAllDevotions()) {
  const completedDates = completedDateSet(entries);
  const todayKey = getManilaDateKey(referenceDate);
  const parsedToday = parseDateKey(todayKey);
  if (!parsedToday) return { todayKey, week: [], weeklyCount: 0 };

  const dayNumber = new Date(parsedToday.timestamp).getUTCDay();
  const mondayKey = shiftDateKey(todayKey, -((dayNumber + 6) % 7));
  const week = WEEKDAY_LABELS.map((label, index) => {
    const dateKey = shiftDateKey(mondayKey, index);
    const parsed = parseDateKey(dateKey);
    return {
      label,
      dateKey,
      complete: completedDates.has(dateKey),
      isToday: dateKey === todayKey,
      isFuture: Boolean(parsed && parsed.timestamp > parsedToday.timestamp),
    };
  });

  return { todayKey, week, weeklyCount: week.filter((day) => day.complete).length };
}

export function getCurrentRhythmStreak(referenceDate = new Date(), entries = getAllDevotions()) {
  const completedDates = completedDateSet(entries);
  const todayKey = getManilaDateKey(referenceDate);
  let cursor = completedDates.has(todayKey) ? todayKey : shiftDateKey(todayKey, -1);
  let streak = 0;
  while (completedDates.has(cursor)) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}

function getRecentCompletionCount(entries, days, referenceDate) {
  const dates = completedDateSet(entries);
  const todayKey = getManilaDateKey(referenceDate);
  let count = 0;
  for (let index = 0; index < days; index += 1) {
    if (dates.has(shiftDateKey(todayKey, -index))) count += 1;
  }
  return count;
}

function growthSignal(count) {
  if (count === 0) return 'Starting';
  if (count <= 2) return 'Building';
  if (count <= 4) return 'Growing';
  if (count <= 6) return 'Steady';
  return 'Strong';
}

export function getDevotionMetrics(entries = getAllDevotions(), referenceDate = new Date()) {
  const weekly = getWeeklyRhythm(referenceDate, entries);
  const recentCount = getRecentCompletionCount(entries, 7, referenceDate);
  return {
    ...weekly,
    weeklyPercentage: Math.round((weekly.weeklyCount / 7) * 100),
    currentStreak: getCurrentRhythmStreak(referenceDate, entries),
    savedCount: entries.length,
    recentCount,
    growthSignal: growthSignal(recentCount),
  };
}

export function getRecentlyCompletedReferences(days = 30, referenceDate = new Date(), entries = getAllDevotions()) {
  const cutoff = referenceDate.getTime() - days * DAY_IN_MS;
  return entries
    .filter((entry) => new Date(entry.completedAt).getTime() >= cutoff)
    .map((entry) => entry.reference)
    .filter(Boolean);
}

export function getLastBibleLocation() {
  if (typeof window === 'undefined') return null;

  let storedLocation = null;
  try {
    storedLocation = window.localStorage.getItem(LAST_BIBLE_LOCATION_KEY);
  } catch (error) {
    console.warn('Ekklesia Pulse could not read the Bible position from this device.', error);
    return null;
  }

  const location = safeParse(storedLocation, null);
  if (!location || typeof location !== 'object' || !location.bookSlug || !location.chapter) return null;
  return {
    bookSlug: location.bookSlug,
    bookName: location.bookName || location.bookSlug,
    chapter: Number(location.chapter) || 1,
    verse: Number(location.verse) || 1,
  };
}

export function saveLastBibleLocation(location) {
  if (typeof window === 'undefined' || !location?.bookSlug || !location?.chapter) {
    return { ok: false, persisted: false };
  }

  const normalized = {
    bookSlug: location.bookSlug,
    bookName: location.bookName || location.bookSlug,
    chapter: Number(location.chapter) || 1,
    verse: Number(location.verse) || 1,
  };

  try {
    window.localStorage.setItem(LAST_BIBLE_LOCATION_KEY, JSON.stringify(normalized));
    return { ok: true, persisted: true };
  } catch (error) {
    console.warn('Ekklesia Pulse could not save the Bible position on this device.', error);
    return { ok: false, persisted: false };
  }
}

export function formatArchiveEntryDate(dateKey, _completedAt, { includeYear = false } = {}) {
  return formatManilaDateKey(dateKey, includeYear ? { year: 'numeric' } : {});
}

export function formatCompletionTime(completedAt) {
  const date = new Date(completedAt);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function groupDevotionsByDate(entries = getAllDevotions()) {
  const groups = new Map();
  sortNewestFirst(entries).forEach((entry) => {
    if (!groups.has(entry.dateKey)) groups.set(entry.dateKey, []);
    groups.get(entry.dateKey).push(entry);
  });
  return Array.from(groups, ([dateKey, items]) => ({
    dateKey,
    entries: [...items].sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()),
  }));
}
