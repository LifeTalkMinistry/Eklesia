export const MANILA_TIME_ZONE = 'Asia/Manila';
export const DAY_IN_MS = 86400000;

function toValidDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getManilaDateParts(value = new Date()) {
  const date = toValidDate(value);
  if (!date) return null;

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

export function getManilaDateKey(value = new Date()) {
  const parts = getManilaDateParts(value);
  if (!parts) return '';
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function getManilaGreeting(value = new Date()) {
  const parts = getManilaDateParts(value);
  if (!parts) return 'Hello';
  if (parts.hour < 12) return 'Good morning';
  if (parts.hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function getManilaTimestamp(value = new Date()) {
  const date = toValidDate(value);
  return date ? date.toISOString() : '';
}

export function isSameManilaDate(timestampA, timestampB) {
  const firstKey = getManilaDateKey(timestampA);
  const secondKey = getManilaDateKey(timestampB);
  return Boolean(firstKey && secondKey && firstKey === secondKey);
}

export function parseDateKey(dateKey) {
  if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day, timestamp };
}

export function shiftDateKey(dateKey, amount) {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return dateKey;
  return new Date(parsed.timestamp + amount * DAY_IN_MS).toISOString().slice(0, 10);
}

export function formatManilaDate(value = new Date(), options = {}) {
  const date = toValidDate(value);
  if (!date) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TIME_ZONE,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...options,
  }).format(date);
}

export function formatManilaDateKey(dateKey, options = {}) {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TIME_ZONE,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...options,
  }).format(new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12)));
}
