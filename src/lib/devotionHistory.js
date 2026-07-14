import { getManilaDateKey } from './dailyVerse.js';

const STORAGE_KEY = 'ekklesiaPulse-wgap-history-v1';
const DAY_IN_MS = 86400000;
const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MANILA_TIME_ZONE = 'Asia/Manila';

function parseDateKey(dateKey) {
  if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;

  const [year, month, day] = dateKey.split('-').map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;

  return { year, month, day, timestamp };
}

function shiftDateKey(dateKey, amount) {
  const parsedDate = parseDateKey(dateKey);
  if (!parsedDate) return dateKey;
  const shifted = new Date(parsedDate.timestamp + amount * DAY_IN_MS);
  return shifted.toISOString().slice(0, 10);
}

function getArchiveDateKey(entry) {
  if (parseDateKey(entry?.dateKey)) return entry.dateKey;

  const completedDate = new Date(entry?.completedAt);
  if (!Number.isNaN(completedDate.getTime())) return getManilaDateKey(completedDate);

  return null;
}

function getCompletedDateSet(history) {
  return new Set(history.map((entry) => getArchiveDateKey(entry)).filter(Boolean));
}

function getGrowthSignal(recentCount) {
  if (recentCount === 0) return 'Starting';
  if (recentCount <= 2) return 'Building';
  if (recentCount <= 4) return 'Growing';
  if (recentCount <= 6) return 'Steady';
  return 'Strong';
}

function getEntryCompletedTimestamp(entry, fallbackTimestamp) {
  const completedTimestamp = new Date(entry?.completedAt).getTime();
  return Number.isNaN(completedTimestamp) ? fallbackTimestamp : completedTimestamp;
}

export function loadDevotionHistory() {
  if (typeof window === 'undefined') return [];

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((entry) => entry && entry.id && entry.devotion && entry.wgap && getArchiveDateKey(entry))
      .sort((a, b) => {
        const aDateKey = getArchiveDateKey(a);
        const bDateKey = getArchiveDateKey(b);
        if (aDateKey !== bDateKey) return bDateKey.localeCompare(aDateKey);
        return getEntryCompletedTimestamp(b, 0) - getEntryCompletedTimestamp(a, 0);
      });
  } catch (error) {
    console.error('Devotion history could not be loaded', error);
    return [];
  }
}

export function saveDevotionHistory(history) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('Devotion history could not be saved', error);
  }
}

export function createDevotionHistoryRecord(devotion, wgap, completedAt = new Date()) {
  const dateKey = getManilaDateKey(completedAt);

  return {
    id: `wgap-${dateKey}`,
    dateKey,
    completedAt: completedAt.toISOString(),
    devotion: { ...devotion },
    wgap: {
      getsKo: wgap.getsKo.trim(),
      application: wgap.application.trim(),
      prayer: wgap.prayer.trim(),
    },
  };
}

export function formatArchiveEntryDate(dateKey, completedAt, { includeYear = false } = {}) {
  const archiveDateKey = parseDateKey(dateKey) ? dateKey : getArchiveDateKey({ completedAt });
  const parsedDate = parseDateKey(archiveDateKey);
  if (!parsedDate) return 'Date unavailable';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TIME_ZONE,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  }).format(new Date(Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day, 12)));
}

export function formatDevotionHistoryDate(completedAt) {
  return formatArchiveEntryDate(null, completedAt);
}

export function formatDevotionCount(count) {
  return `${count} ${count === 1 ? 'devotion' : 'devotions'}`;
}

export function groupDevotionHistoryByYearAndMonth(history) {
  if (!Array.isArray(history)) return [];

  const years = new Map();

  history.forEach((entry) => {
    if (!entry || !entry.id || !entry.devotion || !entry.wgap) return;

    const archiveDateKey = getArchiveDateKey(entry);
    const parsedDate = parseDateKey(archiveDateKey);
    if (!parsedDate) return;

    if (!years.has(parsedDate.year)) {
      years.set(parsedDate.year, {
        year: parsedDate.year,
        count: 0,
        months: new Map(),
      });
    }

    const yearGroup = years.get(parsedDate.year);
    if (!yearGroup.months.has(parsedDate.month)) {
      yearGroup.months.set(parsedDate.month, {
        month: parsedDate.month,
        monthName: new Intl.DateTimeFormat('en-US', {
          timeZone: MANILA_TIME_ZONE,
          month: 'long',
        }).format(new Date(Date.UTC(parsedDate.year, parsedDate.month - 1, 1, 12))),
        count: 0,
        entries: [],
      });
    }

    const monthGroup = yearGroup.months.get(parsedDate.month);
    const fallbackTimestamp = Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day, 12);

    yearGroup.count += 1;
    monthGroup.count += 1;
    monthGroup.entries.push({
      ...entry,
      archiveDateKey,
      archiveSortTimestamp: getEntryCompletedTimestamp(entry, fallbackTimestamp),
    });
  });

  return Array.from(years.values())
    .sort((a, b) => b.year - a.year)
    .map((yearGroup) => ({
      year: yearGroup.year,
      count: yearGroup.count,
      months: Array.from(yearGroup.months.values())
        .sort((a, b) => b.month - a.month)
        .map((monthGroup) => ({
          ...monthGroup,
          entries: monthGroup.entries.sort((a, b) => {
            if (a.archiveDateKey !== b.archiveDateKey) return b.archiveDateKey.localeCompare(a.archiveDateKey);
            return b.archiveSortTimestamp - a.archiveSortTimestamp;
          }),
        })),
    }));
}

export function getRecentCompletionCount(history, days = 7, date = new Date()) {
  const completedDates = getCompletedDateSet(history);
  const todayKey = getManilaDateKey(date);
  let count = 0;

  for (let index = 0; index < days; index += 1) {
    if (completedDates.has(shiftDateKey(todayKey, -index))) count += 1;
  }

  return count;
}

export function getDevotionMetrics(history, date = new Date()) {
  const completedDates = getCompletedDateSet(history);
  const todayKey = getManilaDateKey(date);
  const parsedToday = parseDateKey(todayKey);
  const todayDayNumber = new Date(parsedToday.timestamp).getUTCDay();
  const daysSinceMonday = (todayDayNumber + 6) % 7;
  const mondayKey = shiftDateKey(todayKey, -daysSinceMonday);

  const week = WEEKDAY_LABELS.map((label, index) => {
    const dateKey = shiftDateKey(mondayKey, index);
    const parsedDate = parseDateKey(dateKey);
    return {
      label,
      dateKey,
      complete: completedDates.has(dateKey),
      isToday: dateKey === todayKey,
      isFuture: parsedDate.timestamp > parsedToday.timestamp,
    };
  });

  const weeklyCount = week.filter((day) => day.complete).length;
  const recentCount = getRecentCompletionCount(history, 7, date);

  let streakCursor = completedDates.has(todayKey) ? todayKey : shiftDateKey(todayKey, -1);
  let currentStreak = 0;

  while (completedDates.has(streakCursor)) {
    currentStreak += 1;
    streakCursor = shiftDateKey(streakCursor, -1);
  }

  return {
    todayKey,
    week,
    weeklyCount,
    weeklyPercentage: Math.round((weeklyCount / 7) * 100),
    currentStreak,
    savedCount: history.length,
    recentCount,
    growthSignal: getGrowthSignal(recentCount),
  };
}
