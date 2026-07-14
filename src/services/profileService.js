import { getBrowserStorage, STORAGE_KEYS } from './storageRegistry.js';

export const PROFILE_LIMITS = Object.freeze({
  displayName: { min: 2, max: 40 },
  churchName: { min: 0, max: 80 },
  ministryName: { min: 0, max: 80 },
});

const memoryState = {
  profile: null,
  onboardingComplete: false,
  alphaNoticeAcceptedAt: '',
};

function nowIso() {
  return new Date().toISOString();
}

function trimText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateProfileFields(values = {}) {
  const data = {
    displayName: trimText(values.displayName),
    churchName: trimText(values.churchName),
    ministryName: trimText(values.ministryName),
  };
  const errors = {};

  if (!data.displayName) {
    errors.displayName = 'Enter the name you would like Ekklesia Pulse to use.';
  } else if (data.displayName.length < PROFILE_LIMITS.displayName.min) {
    errors.displayName = 'Your name must contain at least 2 characters.';
  } else if (data.displayName.length > PROFILE_LIMITS.displayName.max) {
    errors.displayName = 'Your name must contain 40 characters or fewer.';
  }

  if (data.churchName.length > PROFILE_LIMITS.churchName.max) {
    errors.churchName = 'Church must contain 80 characters or fewer.';
  }

  if (data.ministryName.length > PROFILE_LIMITS.ministryName.max) {
    errors.ministryName = 'Ministry or group must contain 80 characters or fewer.';
  }

  return { ok: Object.keys(errors).length === 0, data, errors };
}

function normalizeStoredProfile(value) {
  if (!value || typeof value !== 'object') return null;
  const validation = validateProfileFields(value);
  if (!validation.ok) return null;

  const createdAt = typeof value.createdAt === 'string' && value.createdAt
    ? value.createdAt
    : nowIso();
  const updatedAt = typeof value.updatedAt === 'string' && value.updatedAt
    ? value.updatedAt
    : createdAt;

  return {
    ...validation.data,
    createdAt,
    updatedAt,
    alphaNoticeAcceptedAt: typeof value.alphaNoticeAcceptedAt === 'string'
      ? value.alphaNoticeAcceptedAt
      : '',
  };
}

function readStorageValue(key) {
  const storage = getBrowserStorage();
  if (!storage) return { available: false, value: null };
  try {
    return { available: true, value: storage.getItem(key) };
  } catch (error) {
    console.warn(`Ekklesia Pulse could not read ${key}.`, error);
    return { available: false, value: null };
  }
}

function writeStorageValue(key, value) {
  const storage = getBrowserStorage();
  if (!storage) return { persisted: false };
  try {
    storage.setItem(key, value);
    return { persisted: storage.getItem(key) === value };
  } catch (error) {
    console.warn(`Ekklesia Pulse could not save ${key}.`, error);
    return { persisted: false, error };
  }
}

function removeStorageValue(key) {
  const storage = getBrowserStorage();
  if (!storage) return { removed: false, unavailable: true };
  try {
    storage.removeItem(key);
    return { removed: storage.getItem(key) === null };
  } catch (error) {
    console.warn(`Ekklesia Pulse could not remove ${key}.`, error);
    return { removed: false, error };
  }
}

export function getLocalProfile() {
  const stored = readStorageValue(STORAGE_KEYS.localProfile);
  if (stored.value === null) {
    return { ok: true, data: memoryState.profile, persisted: stored.available };
  }

  try {
    const profile = normalizeStoredProfile(JSON.parse(stored.value));
    if (!profile) {
      removeStorageValue(STORAGE_KEYS.localProfile);
      return {
        ok: true,
        data: memoryState.profile,
        persisted: false,
        warning: 'The saved device profile was not valid and was ignored.',
      };
    }
    memoryState.profile = profile;
    return { ok: true, data: profile, persisted: true };
  } catch (error) {
    console.warn('The Ekklesia Pulse device profile could not be parsed.', error);
    removeStorageValue(STORAGE_KEYS.localProfile);
    return {
      ok: true,
      data: memoryState.profile,
      persisted: false,
      warning: 'The saved device profile could not be read and was ignored.',
    };
  }
}

export function saveLocalProfile(profile) {
  const validation = validateProfileFields(profile);
  if (!validation.ok) return validation;

  const existing = normalizeStoredProfile(memoryState.profile || getLocalProfile().data);
  const timestamp = nowIso();
  const normalized = {
    ...validation.data,
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
    alphaNoticeAcceptedAt: existing?.alphaNoticeAcceptedAt || '',
  };

  memoryState.profile = normalized;
  const writeResult = writeStorageValue(STORAGE_KEYS.localProfile, JSON.stringify(normalized));

  return {
    ok: true,
    data: normalized,
    persisted: writeResult.persisted,
    message: writeResult.persisted
      ? ''
      : 'Your profile could not be saved on this device. It will be available only during this session.',
  };
}

export function updateLocalProfile(changes) {
  const current = getLocalProfile().data;
  if (!current) {
    return { ok: false, errors: {}, message: 'A local device profile is not available to update.' };
  }
  return saveLocalProfile({ ...current, ...changes });
}

export function hasCompletedOnboarding() {
  const stored = readStorageValue(STORAGE_KEYS.onboardingComplete);
  if (stored.value !== null) memoryState.onboardingComplete = stored.value === 'true';
  return memoryState.onboardingComplete;
}

export function setOnboardingComplete() {
  memoryState.onboardingComplete = true;
  const result = writeStorageValue(STORAGE_KEYS.onboardingComplete, 'true');
  return { ok: true, persisted: result.persisted };
}

export function resetOnboarding() {
  memoryState.onboardingComplete = false;
  const result = removeStorageValue(STORAGE_KEYS.onboardingComplete);
  return { ok: !result.error && !result.unavailable, removed: result.removed };
}

export function hasAcceptedAlphaNotice() {
  const stored = readStorageValue(STORAGE_KEYS.alphaNoticeAccepted);
  if (stored.value) memoryState.alphaNoticeAcceptedAt = stored.value;
  return Boolean(memoryState.alphaNoticeAcceptedAt);
}

export function acceptAlphaNotice() {
  const acceptedAt = nowIso();
  memoryState.alphaNoticeAcceptedAt = acceptedAt;
  const storageResult = writeStorageValue(STORAGE_KEYS.alphaNoticeAccepted, acceptedAt);

  if (memoryState.profile) {
    const updatedProfile = {
      ...memoryState.profile,
      alphaNoticeAcceptedAt: acceptedAt,
      updatedAt: acceptedAt,
    };
    memoryState.profile = updatedProfile;
    writeStorageValue(STORAGE_KEYS.localProfile, JSON.stringify(updatedProfile));
  }

  return { ok: true, acceptedAt, persisted: storageResult.persisted };
}

export function resetAlphaNotice() {
  memoryState.alphaNoticeAcceptedAt = '';
  const storageResult = removeStorageValue(STORAGE_KEYS.alphaNoticeAccepted);

  if (memoryState.profile) {
    const updatedProfile = {
      ...memoryState.profile,
      alphaNoticeAcceptedAt: '',
      updatedAt: nowIso(),
    };
    memoryState.profile = updatedProfile;
    writeStorageValue(STORAGE_KEYS.localProfile, JSON.stringify(updatedProfile));
  }

  return { ok: !storageResult.error && !storageResult.unavailable, removed: storageResult.removed };
}

export function clearLocalProfile({ removeStorage = true } = {}) {
  memoryState.profile = null;
  memoryState.onboardingComplete = false;
  memoryState.alphaNoticeAcceptedAt = '';

  if (!removeStorage) return { ok: true };

  const results = [
    removeStorageValue(STORAGE_KEYS.localProfile),
    removeStorageValue(STORAGE_KEYS.onboardingComplete),
    removeStorageValue(STORAGE_KEYS.alphaNoticeAccepted),
  ];
  return { ok: results.every((result) => !result.error && !result.unavailable) };
}
