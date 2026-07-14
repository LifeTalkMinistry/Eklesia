import { APP_NAME, APP_STAGE, APP_VERSION } from '../config/appConfig.js';
import {
  clearLocalProfile,
  resetAlphaNotice,
  resetOnboarding,
} from './profileService.js';
import {
  getBrowserStorage,
  isLocalStorageAvailable,
  isOwnedStorageKey,
} from './storageRegistry.js';

export function getOwnedStorageKeys() {
  const storage = getBrowserStorage();
  if (!storage) return [];

  const keys = [];
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && isOwnedStorageKey(key)) keys.push(key);
    }
  } catch (error) {
    console.warn('Ekklesia Pulse could not inspect its local data keys.', error);
  }
  return keys;
}

function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)')?.matches
    || window.navigator?.standalone,
  );
}

export function createSafeDiagnosticSummary({
  category,
  feedback,
  attemptedAction = '',
  currentSection = 'Profile',
} = {}) {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unavailable';
  const screenWidth = typeof window !== 'undefined' ? window.screen?.width || window.innerWidth : 'Unavailable';
  const screenHeight = typeof window !== 'undefined' ? window.screen?.height || window.innerHeight : 'Unavailable';

  return [
    `Product: ${APP_NAME}`,
    `Stage: ${APP_STAGE}`,
    `App version: ${APP_VERSION}`,
    `Feedback category: ${String(category || 'Other').trim()}`,
    `Current application section: ${String(currentSection || 'Unknown').trim()}`,
    `Timestamp: ${new Date().toISOString()}`,
    `Browser user-agent: ${userAgent}`,
    `Screen dimensions: ${screenWidth} × ${screenHeight}`,
    `Installed as standalone PWA: ${isStandalonePwa() ? 'Yes' : 'No'}`,
    `Local storage available: ${isLocalStorageAvailable() ? 'Yes' : 'No'}`,
    '',
    'What happened or what would you improve?',
    String(feedback || '').trim(),
    '',
    'What were you trying to do?',
    String(attemptedAction || '').trim() || 'Not provided',
  ].join('\n');
}

export function restartIntroductionState() {
  const onboardingResult = resetOnboarding();
  const alphaResult = resetAlphaNotice();
  return {
    ok: onboardingResult.ok && alphaResult.ok,
    persisted: onboardingResult.persisted !== false && alphaResult.persisted !== false,
    message: onboardingResult.ok && alphaResult.ok
      ? onboardingResult.message || alphaResult.message || ''
      : 'The introduction could not be restarted completely on this device.',
  };
}

export function deleteAllEkklesiaPulseLocalData() {
  const storage = getBrowserStorage();
  const failedKeys = [];
  const removedKeys = [];

  if (!storage) {
    return {
      ok: false,
      removedKeys,
      failedKeys: ['browser-storage-unavailable'],
      message: 'Some local data could not be removed because this browser is blocking storage access. Please try again after allowing site storage.',
    };
  }

  getOwnedStorageKeys().forEach((key) => {
    try {
      storage.removeItem(key);
      if (storage.getItem(key) === null) removedKeys.push(key);
      else failedKeys.push(key);
    } catch (error) {
      console.warn(`Ekklesia Pulse could not remove ${key}.`, error);
      failedKeys.push(key);
    }
  });

  if (failedKeys.length === 0) clearLocalProfile({ removeStorage: false });

  return {
    ok: failedKeys.length === 0,
    removedKeys,
    failedKeys,
    message: failedKeys.length
      ? 'Some local data could not be removed. Please try again.'
      : 'Local Ekklesia Pulse data was removed from this device.',
  };
}
