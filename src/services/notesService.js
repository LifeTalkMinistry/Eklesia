import { getBrowserStorage, STORAGE_KEYS } from './storageRegistry.js';

const MAX_NOTES = 100;
const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 20_000;

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeDate(value, fallback) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function normalizeNote(note = {}, index = 0) {
  const fallbackDate = new Date().toISOString();
  const createdAt = normalizeDate(note.createdAt, fallbackDate);
  const updatedAt = normalizeDate(note.updatedAt, createdAt);
  const fallbackId = `restored-note-${index}-${createdAt}`;

  return {
    id: String(note.id || fallbackId).slice(0, 160),
    title: String(note.title || '').slice(0, MAX_TITLE_LENGTH),
    body: String(note.body || '').slice(0, MAX_BODY_LENGTH),
    createdAt,
    updatedAt,
  };
}

function normalizeNotes(notes) {
  if (!Array.isArray(notes)) return [];
  const seen = new Set();
  return notes
    .map(normalizeNote)
    .filter((note) => {
      if (!note.id || seen.has(note.id)) return false;
      seen.add(note.id);
      return true;
    })
    .slice(0, MAX_NOTES);
}

export function createNote(values = {}) {
  const now = new Date().toISOString();
  return normalizeNote({
    id: createId(),
    title: values.title || '',
    body: values.body || '',
    createdAt: now,
    updatedAt: now,
  });
}

export function getNotes() {
  const storage = getBrowserStorage();
  if (!storage) return [];

  try {
    const saved = storage.getItem(STORAGE_KEYS.notes);
    return saved ? normalizeNotes(JSON.parse(saved)) : [];
  } catch (error) {
    console.warn('Ekklesia Pulse could not restore your notes.', error);
    return [];
  }
}

export function saveNotes(notes) {
  const normalized = normalizeNotes(notes);
  const storage = getBrowserStorage();

  if (!storage) {
    return {
      ok: true,
      persisted: false,
      data: normalized,
      message: 'Your notes are available for this session, but this browser cannot save them.',
    };
  }

  try {
    storage.setItem(STORAGE_KEYS.notes, JSON.stringify(normalized));
    return { ok: true, persisted: true, data: normalized, message: '' };
  } catch (error) {
    console.warn('Ekklesia Pulse could not save your notes.', error);
    return {
      ok: true,
      persisted: false,
      data: normalized,
      message: 'Your changes are visible now, but this browser could not save them.',
    };
  }
}
