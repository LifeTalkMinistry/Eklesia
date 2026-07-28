import { getBrowserStorage, STORAGE_KEYS } from './storageRegistry.js';

export const THEME_OPTIONS = Object.freeze([
  Object.freeze({
    id: 'pulse-dark',
    label: 'Pulse Dark',
    description: 'Organic dark surfaces, warm highlights, and the original Pulse character.',
    colorScheme: 'dark',
    browserColor: '#07100c',
    preview: ['#07100c', '#102019', '#b8d8c4', '#e8d9aa'],
  }),
  Object.freeze({
    id: 'light',
    label: 'Light',
    description: 'Clean white cards, restrained shadows, and bright open spacing.',
    colorScheme: 'light',
    browserColor: '#edf0ea',
    preview: ['#edf0ea', '#ffffff', '#2f7250', '#9b6b31'],
  }),
  Object.freeze({
    id: 'midnight',
    label: 'Midnight',
    description: 'Deep navy structure, cool blue controls, and violet active states.',
    colorScheme: 'dark',
    browserColor: '#040b17',
    preview: ['#040b17', '#0d203d', '#86b7ff', '#c7a5ff'],
  }),
  Object.freeze({
    id: 'parchment',
    label: 'Parchment',
    description: 'Book-like cream surfaces, flatter cards, and warm editorial details.',
    colorScheme: 'light',
    browserColor: '#d8ccb4',
    preview: ['#d8ccb4', '#fff8ea', '#52705b', '#865e30'],
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

function applyThemeAttributes(element, option) {
  if (!element) return;

  // Ekklesia-specific identifiers retained for existing selectors.
  element.dataset.ekklesiaTheme = option.id;
  element.dataset.ekklesiaUiSkin = option.id;

  // Design-system attributes mirror mature multi-theme systems.
  element.dataset.uiTheme = option.id;
  element.dataset.colorMode = option.colorScheme;
  element.dataset.lightTheme = option.colorScheme === 'light' ? option.id : 'light';
  element.dataset.darkTheme = option.colorScheme === 'dark' ? option.id : 'pulse-dark';
}

function applyViewportSkin(option) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  applyThemeAttributes(root, option);
  root.style.colorScheme = option.colorScheme;
  root.style.backgroundColor = option.browserColor;

  if (document.body) {
    applyThemeAttributes(document.body, option);
    document.body.style.backgroundColor = option.browserColor;
  }

  const appRoot = document.getElementById('root');
  if (appRoot) {
    applyThemeAttributes(appRoot, option);
    appRoot.style.backgroundColor = option.browserColor;
  }

  updateBrowserThemeColor(option.browserColor);
}

export function applyThemePreferences(preferences) {
  const normalized = normalizePreferences(preferences);
  applyViewportSkin(getThemeOption(normalized.themeId));
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
