import { getRawBrowserStorage } from '../storageRegistry.js';
import { getActiveAccountId } from './accountContext.js';

export const ACCOUNT_STORAGE_PREFIX = 'ekklesiaPulse.account';

function normalizeBaseKey(baseKey) {
  const key = String(baseKey || '').trim();
  if (key.startsWith('ekklesiaPulse.')) return key.slice('ekklesiaPulse.'.length);
  if (key.startsWith('ekklesiaPulse-')) return `legacy.${key.slice('ekklesiaPulse-'.length)}`;
  throw new Error(`Account-scoped storage requires an Ekklesia key: ${key || '(empty)'}`);
}

export function getAccountStorageKey(baseKey, accountId = getActiveAccountId()) {
  const normalizedAccountId = String(accountId || '').trim();
  if (!/^[1-9]\d*$/.test(normalizedAccountId)) return '';
  return `${ACCOUNT_STORAGE_PREFIX}.${normalizedAccountId}.${normalizeBaseKey(baseKey)}`;
}

export function readAccountStorage(baseKey, fallback = null, accountId = getActiveAccountId()) {
  const storage = getRawBrowserStorage();
  const key = getAccountStorageKey(baseKey, accountId);
  if (!storage || !key) return { available: Boolean(storage), scoped: false, key, value: fallback };

  try {
    const value = storage.getItem(key);
    return { available: true, scoped: true, key, value: value === null ? fallback : value };
  } catch (error) {
    console.warn(`Ekklesia Pulse could not read scoped storage ${key}.`, error);
    return { available: false, scoped: true, key, value: fallback, error };
  }
}

export function writeAccountStorage(baseKey, value, accountId = getActiveAccountId()) {
  const storage = getRawBrowserStorage();
  const key = getAccountStorageKey(baseKey, accountId);
  if (!storage || !key) return { persisted: false, scoped: false, key };

  try {
    storage.setItem(key, String(value));
    return { persisted: storage.getItem(key) === String(value), scoped: true, key };
  } catch (error) {
    console.warn(`Ekklesia Pulse could not write scoped storage ${key}.`, error);
    return { persisted: false, scoped: true, key, error };
  }
}

export function removeAccountStorage(baseKey, accountId = getActiveAccountId()) {
  const storage = getRawBrowserStorage();
  const key = getAccountStorageKey(baseKey, accountId);
  if (!storage || !key) return { removed: false, scoped: false, key };

  try {
    storage.removeItem(key);
    return { removed: storage.getItem(key) === null, scoped: true, key };
  } catch (error) {
    console.warn(`Ekklesia Pulse could not remove scoped storage ${key}.`, error);
    return { removed: false, scoped: true, key, error };
  }
}

export function copyLegacyValueIntoAccount(baseKey, accountId = getActiveAccountId()) {
  const storage = getRawBrowserStorage();
  const scopedKey = getAccountStorageKey(baseKey, accountId);
  if (!storage || !scopedKey) return { copied: false, reason: 'unavailable' };

  const legacyValue = storage.getItem(baseKey);
  if (legacyValue === null) return { copied: false, reason: 'missing' };
  if (storage.getItem(scopedKey) !== null) return { copied: false, reason: 'already-scoped' };

  storage.setItem(scopedKey, legacyValue);
  return { copied: true, key: scopedKey };
}

export function listAccountStorageKeys(accountId = getActiveAccountId()) {
  const storage = getRawBrowserStorage();
  const normalizedAccountId = String(accountId || '').trim();
  if (!storage || !/^[1-9]\d*$/.test(normalizedAccountId)) return [];
  const prefix = `${ACCOUNT_STORAGE_PREFIX}.${normalizedAccountId}.`;
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  return keys.sort();
}

export function clearAccountStorage(accountId = getActiveAccountId()) {
  const storage = getRawBrowserStorage();
  if (!storage) return { removed: 0 };
  const keys = listAccountStorageKeys(accountId);
  keys.forEach((key) => storage.removeItem(key));
  return { removed: keys.length };
}
