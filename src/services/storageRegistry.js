export const STORAGE_KEYS = Object.freeze({
  localProfile: 'ekklesiaPulse.localProfile',
  onboardingComplete: 'ekklesiaPulse.onboardingComplete',
  alphaNoticeAccepted: 'ekklesiaPulse.alphaNoticeAccepted',
  devotions: 'ekklesiaPulse.devotions',
  lastBibleLocation: 'ekklesiaPulse.lastBibleLocation',
  devotionDataVersion: 'ekklesiaPulse.devotionDataVersion',
  joinedEcosystemId: 'ekklesiaPulse.joinedEcosystemId',
  organizationPrototype: 'ekklesiaPulse.organizationPrototype',
  brandMigrationVersion: 'ekklesiaPulse.brandMigrationVersion',
  legacyWgapHistory: 'ekklesiaPulse-wgap-history-v1',
});

export const INDEXED_DB_STORAGE_AREAS = Object.freeze([
  Object.freeze({
    database: 'ekklesia-pulse',
    store: 'notebookImages',
    purpose: 'Private notebook devotion images',
  }),
]);

export const CONFIRMED_LEGACY_STORAGE_KEYS = Object.freeze([
  'eklesia.devotions',
  'eklesia.joinedEcosystemId',
  'eklesia.lastBibleLocation',
  'eklesia.devotionDataVersion',
  'eklesia-wgap-history-v1',
]);

export const OWNED_STORAGE_PREFIXES = Object.freeze(['ekklesiaPulse.']);

export function getBrowserStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch (error) {
    console.warn('Ekklesia Pulse cannot currently access browser storage.', error);
    return null;
  }
}

export function isLocalStorageAvailable() {
  const storage = getBrowserStorage();
  if (!storage) return false;

  const testKey = 'ekklesiaPulse.__storageTest';
  try {
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return true;
  } catch (error) {
    console.warn('Ekklesia Pulse cannot currently save browser data.', error);
    return false;
  }
}

export function getRegisteredStorageKeys() {
  return [...Object.values(STORAGE_KEYS), ...CONFIRMED_LEGACY_STORAGE_KEYS];
}

export function isOwnedStorageKey(key) {
  return getRegisteredStorageKeys().includes(key)
    || OWNED_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix));
}
