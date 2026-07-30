import { STORAGE_KEYS } from '../storageRegistry.js';
import { getLocalProfile, replaceLocalProfileFromSync } from '../profileService.js';
import { readAccountStorage, writeAccountStorage } from './accountScopedStorage.js';

const VERSION_STORAGE_KEY = 'ekklesiaPulse.syncRecordVersions';

function readVersions() {
  const raw = readAccountStorage(VERSION_STORAGE_KEY, '{}').value;
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeVersions(versions) {
  writeAccountStorage(VERSION_STORAGE_KEY, JSON.stringify(versions));
}

function recordKey(entityType, clientRecordId) {
  return `${entityType}:${clientRecordId}`;
}

export function getLocalRecordVersion(entityType, clientRecordId) {
  const version = Number(readVersions()[recordKey(entityType, clientRecordId)] || 0);
  return Number.isSafeInteger(version) && version >= 0 ? version : 0;
}

export function setLocalRecordVersion(entityType, clientRecordId, version) {
  const normalized = Number(version);
  if (!Number.isSafeInteger(normalized) || normalized < 0) return;
  const versions = readVersions();
  versions[recordKey(entityType, clientRecordId)] = normalized;
  writeVersions(versions);
}

function applyProfileRecord(record) {
  if (record.deletedAt || record.operation === 'delete') return { applied: false, reason: 'profile-delete-unsupported' };
  const existing = getLocalProfile().data;
  const payload = record.payload || {};
  const result = replaceLocalProfileFromSync({
    displayName: payload.displayName,
    churchName: existing?.churchName || '',
    ministryName: existing?.ministryName || '',
    createdAt: record.createdAt || existing?.createdAt,
    updatedAt: record.updatedAt || record.changedAt || new Date().toISOString(),
    alphaNoticeAcceptedAt: existing?.alphaNoticeAcceptedAt || '',
  });
  if (result.ok) setLocalRecordVersion('profile', record.clientRecordId || 'profile', Number(record.version || record.recordVersion || 0));
  return { applied: result.ok, result };
}

export function applyCanonicalRecord(record) {
  if (!record?.entityType) return { applied: false, reason: 'invalid-record' };
  if (record.entityType === 'profile') return applyProfileRecord(record);
  return { applied: false, reason: 'unsupported-entity' };
}

export function applyCanonicalRecords(records = []) {
  return records.map(applyCanonicalRecord);
}

export function createProfileMutation(profile = getLocalProfile().data) {
  if (!profile?.displayName) return null;
  return {
    entityType: 'profile',
    clientRecordId: 'profile',
    operation: 'upsert',
    baseVersion: getLocalRecordVersion('profile', 'profile'),
    payload: { displayName: profile.displayName },
  };
}

export function getSyncableLocalSnapshot() {
  const profile = createProfileMutation();
  return profile ? [profile] : [];
}

export { VERSION_STORAGE_KEY };
