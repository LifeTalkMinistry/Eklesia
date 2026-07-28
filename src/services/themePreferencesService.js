import { getBrowserStorage, STORAGE_KEYS } from './storageRegistry.js';

export const THEME_OPTIONS = Object.freeze([
  Object.freeze({
    id: 'pulse-dark',
    label: 'Pulse Dark',
    description: 'The original premium Ekklesia Pulse green experience.',
    colorScheme: 'dark',
    browserColor: '#08110d',
    preview: ['#08110d', '#102019', '#b8d8c4', '#e8d9aa'],
  }),
  Object.freeze({
    id: 'light',
    label: 'Light',
    description: 'Warm, bright surfaces with clear dark text.',
    colorScheme: 'light',
    browserColor: '#f4f1e8',
    preview: ['#f4f1e8', '#fffdf7', '#2f7250', '#a8793e'],
  }),
  Object.freeze({
    id: 'midnight',
    label: 'Midnight',
    description: 'Deep navy surfaces with calm blue highlights.',
    colorScheme: 'dark',
    browserColor: '#07101f',
    preview: ['#07101f', '#0d1b32', '#8ab6ff', '#c8a8ff'],
  }),
  Object.freeze({
    id: 'parchment',
    label: 'Parchment',
    description: 'A warm, book-inspired palette for reflective reading.',
    colorScheme: 'light',
    browserColor: '#e9dfc9',
    preview: ['#e9dfc9', '#f8f0df', '#8a6335', '#52705b'],
  }),
]);

export const DEFAULT_THEME_PREFERENCES = Object.freeze({ themeId: 'pulse-dark' });

function normalizePreferences(preferences = {}) {
  const themeId = THEME_OPTIONS.some((option) => option.id === preferences.themeId)
    ? preferences.themeId
    : DEFAULT_THEME_PREFERENCES.themeId;
  return { themeId };
}

export function getThemeOption(themeId) {
  return THEME_OPTIONS.find((option) => option.id === themeId) || THEME_OPTIONS[0];
}

export function getThemePreferences() {
  const storage = getBrowserStorage();
  if (!storage) return { ...DEFAULT_THEME_PREFERENCES };

  try {
    const saved = storage.getItem(STORAGE_KEYS.themePreferences);
    return saved ? normalizePreferences(JSON.parse(saved)) : { ...DEFAULT_THEME_PREFERENCES };
  } catch (error) {
    console.warn('Ekklesia Pulse could not restore the selected theme.', error);
    return { ...DEFAULT_THEME_PREFERENCES };
  }
}

function updateBrowserThemeColor(color) {
  if (typeof document === 'undefined') return;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', color);
}

export function applyThemePreferences(preferences) {
  const normalized = normalizePreferences(preferences);
  const option = getThemeOption(normalized.themeId);

  if (typeof document !== 'undefined') {
    document.documentElement.dataset.ekklesiaTheme = option.id;
    document.documentElement.style.colorScheme = option.colorScheme;
    updateBrowserThemeColor(option.browserColor);
  }

  return normalized;
}

export function initializeThemePreferences() {
  return applyThemePreferences(getThemePreferences());
}

export function saveThemePreferences(preferences) {
  const normalized = applyThemePreferences(preferences);
  const storage = getBrowserStorage();

  if (!storage) {
    return {
      ok: true,
      persisted: false,
      data: normalized,
      message: 'The theme changed for this session, but this browser cannot save it.',
    };
  }

  try {
    storage.setItem(STORAGE_KEYS.themePreferences, JSON.stringify(normalized));
    return { ok: true, persisted: true, data: normalized, message: '' };
  } catch (error) {
    console.warn('Ekklesia Pulse could not save the selected theme.', error);
    return {
      ok: true,
      persisted: false,
      data: normalized,
      message: 'The theme changed for this session, but this browser could not save it.',
    };
  }
}

export function resetThemePreferences({ removeStorage = true } = {}) {
  if (removeStorage) {
    const storage = getBrowserStorage();
    try {
      storage?.removeItem(STORAGE_KEYS.themePreferences);
    } catch (error) {
      console.warn('Ekklesia Pulse could not remove the saved theme preference.', error);
    }
  }

  return applyThemePreferences(DEFAULT_THEME_PREFERENCES);
}
