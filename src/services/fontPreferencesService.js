import { FONT_OPTIONS } from '../config/fontCatalog.js';
import { getBrowserStorage, STORAGE_KEYS } from './storageRegistry.js';

export { FONT_OPTIONS } from '../config/fontCatalog.js';

const GOOGLE_FONT_STYLESHEET_ID = 'ekklesia-google-fonts';
const loadedFontFamilies = new Set();

export const DEFAULT_FONT_PREFERENCES = Object.freeze({ fontId: 'pulse-default' });

function normalizePreferences(preferences = {}) {
  const fontId = FONT_OPTIONS.some((option) => option.id === preferences.fontId)
    ? preferences.fontId
    : DEFAULT_FONT_PREFERENCES.fontId;
  return { fontId };
}

function encodeGoogleFamily(family) {
  return encodeURIComponent(family).replace(/%20/g, '+');
}

function syncGoogleFontStylesheet() {
  if (typeof document === 'undefined' || loadedFontFamilies.size === 0) return;

  let stylesheet = document.getElementById(GOOGLE_FONT_STYLESHEET_ID);
  if (!stylesheet) {
    stylesheet = document.createElement('link');
    stylesheet.id = GOOGLE_FONT_STYLESHEET_ID;
    stylesheet.rel = 'stylesheet';
    document.head.appendChild(stylesheet);
  }

  const families = [...loadedFontFamilies]
    .sort((first, second) => first.localeCompare(second))
    .map((family) => `family=${encodeGoogleFamily(family)}`)
    .join('&');
  const nextHref = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  if (stylesheet.href !== nextHref) stylesheet.href = nextHref;
}

export function loadFontOptions(options = []) {
  let changed = false;
  options.forEach((option) => {
    if (!option?.googleFamily || loadedFontFamilies.has(option.googleFamily)) return;
    loadedFontFamilies.add(option.googleFamily);
    changed = true;
  });
  if (changed) syncGoogleFontStylesheet();
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
  loadFontOptions([option]);

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
