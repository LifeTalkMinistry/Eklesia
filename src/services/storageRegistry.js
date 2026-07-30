import { getActiveAccountId } from './sync/accountContext.js';

export const STORAGE_KEYS = Object.freeze({
  localProfile: 'ekklesiaPulse.localProfile',
  introductionSeen: 'ekklesiaPulse.introductionSeen',
  onboardingComplete: 'ekklesiaPulse.onboardingComplete',
  alphaNoticeAccepted: 'ekklesiaPulse.alphaNoticeAccepted',
  devotions: 'ekklesiaPulse.devotions',
  lastBibleLocation: 'ekklesiaPulse.lastBibleLocation',
  devotionDataVersion: 'ekklesiaPulse.devotionDataVersion',
  joinedEcosystemId: 'ekklesiaPulse.joinedEcosystemId',
  activeWorkspace: 'ekklesiaPulse.activeWorkspace',
  organizationPrototype: 'ekklesiaPulse.organizationPrototype',
  brandMigrationVersion: 'ekklesiaPulse.brandMigrationVersion',
  fontPreferences: 'ekklesiaPulse.fontPreferences',
  themePreferences: 'ekklesiaPulse.themePreferences',
  messagingPrototype: 'ekklesiaPulse.messagingPrototype',
  messagingOutbox: 'ekklesiaPulse.messagingOutbox',
  messagingSyncState: 'ekklesiaPulse.messagingSyncState',
  backendAccessToken: 'ekklesiaPulse.backendAccessToken',
  backendAccountId: 'ekklesiaPulse.backendAccountId',
  syncDeviceId: 'ekklesiaPulse.syncDeviceId',
  syncState: 'ekklesiaPulse.syncState',
  syncOutboxFallback: 'ekklesiaPulse.syncOutboxFallback',
  syncActiveBatch: 'ekklesiaPulse.syncActiveBatch',
  legacyClaimRegistry: 'ekklesiaPulse.legacyClaimRegistry',
  legacyWgapHistory: 'ekklesiaPulse-wgap-history-v1',
});

export const DEVICE_LOCAL_STORAGE_KEYS = Object.freeze([
  STORAGE_KEYS.introductionSeen,
  STORAGE_KEYS.backendAccessToken,
  STORAGE_KEYS.backendAccountId,
  STORAGE_KEYS.syncDeviceId,
  STORAGE_KEYS.legacyClaimRegistry,
  STORAGE_KEYS.brandMigrationVersion,
]);

export const ACCOUNT_OWNED_STORAGE_KEYS = Object.freeze([
  STORAGE_KEYS.localProfile,
  STORAGE_KEYS.onboardingComplete,
  STORAGE_KEYS.alphaNoticeAccepted,
  STORAGE_KEYS.devotions,
  STORAGE_KEYS.lastBibleLocation,
  STORAGE_KEYS.devotionDataVersion,
  STORAGE_KEYS.joinedEcosystemId,
  STORAGE_KEYS.activeWorkspace,
  STORAGE_KEYS.organizationPrototype,
  STORAGE_KEYS.fontPreferences,
  STORAGE_KEYS.themePreferences,
  STORAGE_KEYS.messagingPrototype,
  STORAGE_KEYS.messagingOutbox,
  STORAGE_KEYS.messagingSyncState,
  STORAGE_KEYS.syncState,
  STORAGE_KEYS.syncOutboxFallback,
  STORAGE_KEYS.syncActiveBatch,
  STORAGE_KEYS.legacyWgapHistory,
]);

export const INDEXED_DB_STORAGE_AREAS = Object.freeze([
  Object.freeze({
    database: 'ekklesia-pulse',
    store: 'notebookImages',
    purpose: 'Private notebook devotion images',
  }),
  Object.freeze({
    database: 'ekklesia-pulse',
    store: 'syncOutbox',
    purpose: 'Offline account mutation queue',
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

const ACCOUNT_KEY_SET = new Set(ACCOUNT_OWNED_STORAGE_KEYS);
const ACCOUNT_STORAGE_PREFIX = 'ekklesiaPulse.account';

function accountKeySuffix(key) {
  if (key.startsWith('ekklesiaPulse.')) return key.slice('ekklesiaPulse.'.length);
  if (key.startsWith('ekklesiaPulse-')) return `legacy.${key.slice('ekklesiaPulse-'.length)}`;
  return key;
}

function resolveStorageKey(key) {
  if (!ACCOUNT_KEY_SET.has(key)) return key;
  const accountId = getActiveAccountId();
  if (!accountId) return '';
  return `${ACCOUNT_STORAGE_PREFIX}.${accountId}.${accountKeySuffix(key)}`;
}

export function getRawBrowserStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch (error) {
    console.warn('Ekklesia Pulse cannot currently access browser storage.', error);
    return null;
  }
}

export function getBrowserStorage() {
  const raw = getRawBrowserStorage();
  if (!raw) return null;

  return {
    get length() {
      return raw.length;
    },
    key(index) {
      return raw.key(index);
    },
    getItem(key) {
      const resolvedKey = resolveStorageKey(String(key));
      return resolvedKey ? raw.getItem(resolvedKey) : null;
    },
    setItem(key, value) {
      const resolvedKey = resolveStorageKey(String(key));
      if (!resolvedKey) throw new Error('Sign in before saving account-owned Ekklesia data.');
      raw.setItem(resolvedKey, String(value));
    },
    removeItem(key) {
      const resolvedKey = resolveStorageKey(String(key));
      if (resolvedKey) raw.removeItem(resolvedKey);
    },
    clear() {
      throw new Error('Use the Ekklesia data tools instead of clearing all browser storage.');
    },
  };
}

export function isLocalStorageAvailable() {
  const storage = getRawBrowserStorage();
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
