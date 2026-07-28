import { getBrowserStorage, STORAGE_KEYS } from './storageRegistry.js';

export const FONT_OPTIONS = Object.freeze([
  Object.freeze({
    id: 'pulse-default',
    label: 'Pulse Default',
    description: 'The original clean Ekklesia Pulse style.',
    family: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  }),
  Object.freeze({
    id: 'arial',
    label: 'Arial',
    description: 'Simple, familiar, and compact.',
    family: 'Arial, Helvetica, sans-serif',
  }),
  Object.freeze({
    id: 'verdana',
    label: 'Verdana',
    description: 'Wide letterforms that are comfortable on small screens.',
    family: 'Verdana, Geneva, sans-serif',
  }),
  Object.freeze({
    id: 'trebuchet',
    label: 'Trebuchet',
    description: 'Friendly and easy to scan.',
    family: '"Trebuchet MS", "Segoe UI", sans-serif',
  }),
  Object.freeze({
    id: 'georgia',
    label: 'Georgia',
    description: 'A reflective, book-like reading style.',
    family: 'Georgia, "Times New Roman", serif',
  }),
  Object.freeze({
    id: 'times',
    label: 'Times New Roman',
    description: 'A traditional printed-page style.',
    family: '"Times New Roman", Times, serif',
  }),
]);

export const DEFAULT_FONT_PREFERENCES = Object.freeze({ fontId: 'pulse-default' });

function normalizePreferences(preferences = {}) {
  const fontId = FONT_OPTIONS.some((option) => option.id === preferences.fontId)
    ? preferences.fontId
    : DEFAULT_FONT_PREFERENCES.fontId;
  return { fontId };
}

export function getFontOption(fontId) {
  return FONT_OPTIONS.find((option) => option.id === fontId) || FONT_OPTIONS[0];
}

export function getFontPreferences() {
  const storage = getBrowserStorage();
  if (!storage) return { ...DEFAULT_FONT_PREFERENCES };

  try {
    const saved = storage.getItem(STORAGE_KEYS.fontPreferences);
    return saved ? normalizePreferences(JSON.parse(saved)) : { ...DEFAULT_FONT_PREFERENCES };
  } catch (error) {
    console.warn('Ekklesia Pulse could not restore the selected font.', error);
    return { ...DEFAULT_FONT_PREFERENCES };
  }
}

export function applyFontPreferences(preferences) {
  const normalized = normalizePreferences(preferences);
  const option = getFontOption(normalized.fontId);

  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--ekklesia-user-font', option.family);
    document.documentElement.dataset.ekklesiaFont = option.id;
  }

  return normalized;
}

export function initializeFontPreferences() {
  return applyFontPreferences(getFontPreferences());
}

export function saveFontPreferences(preferences) {
  const normalized = applyFontPreferences(preferences);
  const storage = getBrowserStorage();

  if (!storage) {
    return {
      ok: true,
      persisted: false,
      data: normalized,
      message: 'The font changed for this session, but this browser cannot save it.',
    };
  }

  try {
    storage.setItem(STORAGE_KEYS.fontPreferences, JSON.stringify(normalized));
    return { ok: true, persisted: true, data: normalized, message: '' };
  } catch (error) {
    console.warn('Ekklesia Pulse could not save the selected font.', error);
    return {
      ok: true,
      persisted: false,
      data: normalized,
      message: 'The font changed for this session, but this browser could not save it.',
    };
  }
}

export function resetFontPreferences({ removeStorage = true } = {}) {
  if (removeStorage) {
    const storage = getBrowserStorage();
    try {
      storage?.removeItem(STORAGE_KEYS.fontPreferences);
    } catch (error) {
      console.warn('Ekklesia Pulse could not remove the saved font preference.', error);
    }
  }

  return applyFontPreferences(DEFAULT_FONT_PREFERENCES);
}
