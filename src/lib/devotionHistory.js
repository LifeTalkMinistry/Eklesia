import { getManilaDateKey } from './dailyVerse.js';

const STORAGE_KEY = 'eklesia-wgap-history-v1';
const DAY_IN_MS = 86400000;
const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function shiftDateKey(dateKey, amount) {
  const shifted = new Date(parseDateKey(dateKey) + amount * DAY_IN_MS);
  return shifted.toISOString().slice(0, 10);
}

function getCompletedDateSet(history) {
  return new Set(history.map((entry) => entry.dateKey).filter(Boolean));
}

function getGrowthSignal(recentCount) {
  if (recentCount === 0) return 'Starting';
  if (recentCount <= 2) return 'Building';
  if (recentCount <= 4) return 'Growing';
  if (recentCount <= 6) return 'Steady';
  return 'Strong';
}

export function loadDevotionHistory() {
  if (typeof window === 'undefined') return [];

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((entry) => entry && entry.id && entry.dateKey && entry.devotion && entry.wgap)
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
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

export function formatDevotionHistoryDate(completedAt) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(completedAt));
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
  const todayDayNumber = new Date(parseDateKey(todayKey)).getUTCDay();
  const daysSinceMonday = (todayDayNumber + 6) % 7;
  const mondayKey = shiftDateKey(todayKey, -daysSinceMonday);

  const week = WEEKDAY_LABELS.map((label, index) => {
    const dateKey = shiftDateKey(mondayKey, index);
    return {
      label,
      dateKey,
      complete: completedDates.has(dateKey),
      isToday: dateKey === todayKey,
      isFuture: parseDateKey(dateKey) > parseDateKey(todayKey),
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
