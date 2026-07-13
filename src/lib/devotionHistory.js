import { getManilaDateKey } from './dailyVerse.js';

const STORAGE_KEY = 'eklesia-wgap-history-v1';

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

export function getRecentCompletionCount(history, days = 7) {
  const completedDates = new Set(history.map((entry) => entry.dateKey));
  let count = 0;

  for (let index = 0; index < days; index += 1) {
    const date = new Date(Date.now() - index * 86400000);
    if (completedDates.has(getManilaDateKey(date))) count += 1;
  }

  return count;
}
