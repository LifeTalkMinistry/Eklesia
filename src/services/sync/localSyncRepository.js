import { STORAGE_KEYS } from '../storageRegistry.js';
import { getLocalProfile, replaceLocalProfileFromSync } from '../profileService.js';
import { readAccountStorage, writeAccountStorage } from './accountScopedStorage.js';

const VERSION_STORAGE_KEY = 'ekklesiaPulse.syncRecordVersions';

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function readVersions() {
  const raw = readAccountStorage(VERSION_STORAGE_KEY, '{}').value;
  const parsed = safeParse(raw, {});
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
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

function readLocalDevotions() {
  const raw = readAccountStorage(STORAGE_KEYS.devotions, '[]').value;
  const entries = safeParse(raw, []);
  return Array.isArray(entries) ? entries.filter((entry) => entry?.id) : [];
}

function sortDevotions(entries) {
  return [...entries].sort((first, second) => {
    if (first.dateKey !== second.dateKey) return String(second.dateKey).localeCompare(String(first.dateKey));
    return new Date(second.completedAt || 0).getTime() - new Date(first.completedAt || 0).getTime();
  });
}

function writeLocalDevotions(entries) {
  return writeAccountStorage(STORAGE_KEYS.devotions, JSON.stringify(sortDevotions(entries)));
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

export function createDevotionMutation(entry, operation = 'upsert') {
  if (!entry?.id) return null;
  const notebook = entry.devotionFormat === 'notebook';
  return {
    entityType: 'devotion-entry',
    clientRecordId: String(entry.id),
    operation: operation === 'delete' ? 'delete' : 'upsert',
    baseVersion: getLocalRecordVersion('devotion-entry', String(entry.id)),
    payload: operation === 'delete' ? {} : {
      dateKey: String(entry.dateKey || ''),
      completedAt: String(entry.completedAt || new Date().toISOString()),
      devotionType: entry.type === 'additional' ? 'additional' : 'daily',
      source: String(entry.source || ''),
      devotionFormat: notebook ? 'notebook' : 'typed',
      bibleBookId: notebook ? '' : String(entry.bookId || ''),
      bibleBookName: notebook ? '' : String(entry.bookName || ''),
      chapter: notebook ? null : Number(entry.chapter) || null,
      verseStart: notebook ? null : Number(entry.verseStart) || null,
      verseEnd: notebook ? null : Number(entry.verseEnd) || null,
      reference: String(entry.reference || ''),
      translation: notebook ? '' : String(entry.translation || ''),
      title: String(entry.title || ''),
      theme: String(entry.theme || ''),
      prompt: notebook ? '' : String(entry.prompt || ''),
      scriptureText: notebook ? '' : String(entry.scriptureText || ''),
      personalReflection: String(entry.reflection || ''),
      wgapWord: String(entry.wgap?.word || ''),
      wgapGratitude: String(entry.wgap?.gratitude || entry.wgap?.getsKo || ''),
      wgapApplication: String(entry.wgap?.application || ''),
      wgapPrayer: String(entry.wgap?.prayer || ''),
      notebookMetadata: notebook ? {
        imageId: entry.imageId || null,
        imageCount: Number(entry.imageCount) || 0,
        note: String(entry.note || ''),
        submissionKey: String(entry.submissionKey || ''),
      } : {
        bookSlug: String(entry.bookSlug || ''),
        submissionKey: String(entry.submissionKey || ''),
      },
    },
  };
}

function toLocalDevotion(record, existing = null) {
  const payload = record.payload || {};
  const metadata = payload.notebookMetadata && typeof payload.notebookMetadata === 'object'
    ? payload.notebookMetadata
    : {};
  const notebook = payload.devotionFormat === 'notebook';
  return {
    id: String(record.clientRecordId),
    submissionKey: String(metadata.submissionKey || existing?.submissionKey || ''),
    dateKey: String(payload.dateKey || existing?.dateKey || ''),
    completedAt: String(payload.completedAt || record.updatedAt || record.changedAt || existing?.completedAt || new Date().toISOString()),
    type: payload.devotionType === 'additional' ? 'additional' : 'daily',
    source: String(payload.source || existing?.source || (notebook ? 'notebook-capture' : 'daily-suggestion')),
    devotionFormat: notebook ? 'notebook' : 'digital',
    imageId: notebook ? (metadata.imageId || existing?.imageId || null) : null,
    imageCount: notebook ? (Number(metadata.imageCount) || (metadata.imageId ? 1 : Number(existing?.imageCount) || 0)) : 0,
    note: notebook ? String(metadata.note || existing?.note || '') : '',
    bookId: notebook ? '' : String(payload.bibleBookId || ''),
    bookSlug: notebook ? '' : String(metadata.bookSlug || existing?.bookSlug || ''),
    bookName: notebook ? '' : String(payload.bibleBookName || ''),
    chapter: notebook ? 0 : Number(payload.chapter) || 1,
    verseStart: notebook ? 0 : Number(payload.verseStart) || 1,
    verseEnd: notebook ? 0 : Number(payload.verseEnd) || Number(payload.verseStart) || 1,
    reference: String(payload.reference || ''),
    translation: notebook ? '' : String(payload.translation || 'BSB'),
    title: String(payload.title || ''),
    theme: String(payload.theme || (notebook ? 'Handwritten reflection' : '')),
    prompt: notebook ? '' : String(payload.prompt || ''),
    scriptureText: notebook ? '' : String(payload.scriptureText || ''),
    reflection: String(payload.personalReflection || ''),
    wgap: {
      word: String(payload.wgapWord || ''),
      gratitude: String(payload.wgapGratitude || ''),
      application: String(payload.wgapApplication || ''),
      prayer: String(payload.wgapPrayer || ''),
    },
  };
}

function applyDevotionRecord(record) {
  const clientRecordId = String(record.clientRecordId || '');
  if (!clientRecordId) return { applied: false, reason: 'invalid-devotion-record' };
  const remoteVersion = Number(record.version || record.recordVersion || 0);
  const localVersion = getLocalRecordVersion('devotion-entry', clientRecordId);
  if (remoteVersion && remoteVersion < localVersion) return { applied: false, reason: 'older-version' };

  const entries = readLocalDevotions();
  const existingIndex = entries.findIndex((entry) => String(entry.id) === clientRecordId);
  const isDeleted = record.operation === 'delete' || Boolean(record.deletedAt);

  if (isDeleted) {
    if (existingIndex >= 0) entries.splice(existingIndex, 1);
    writeLocalDevotions(entries);
    setLocalRecordVersion('devotion-entry', clientRecordId, remoteVersion);
    return { applied: true, deleted: true, clientRecordId };
  }

  const existing = existingIndex >= 0 ? entries[existingIndex] : null;
  const devotion = toLocalDevotion(record, existing);
  if (existingIndex >= 0) entries[existingIndex] = devotion;
  else entries.push(devotion);
  const writeResult = writeLocalDevotions(entries);
  setLocalRecordVersion('devotion-entry', clientRecordId, remoteVersion);
  return { applied: true, persisted: writeResult.persisted, devotion };
}

export function applyCanonicalRecord(record) {
  if (!record?.entityType) return { applied: false, reason: 'invalid-record' };
  if (record.entityType === 'profile') return applyProfileRecord(record);
  if (record.entityType === 'devotion-entry') return applyDevotionRecord(record);
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

export function getSyncableLocalSnapshot({ unsyncedOnly = false } = {}) {
  const records = [];
  const profile = createProfileMutation();
  if (profile && (!unsyncedOnly || profile.baseVersion === 0)) records.push(profile);
  readLocalDevotions().forEach((entry) => {
    const mutation = createDevotionMutation(entry);
    if (mutation && (!unsyncedOnly || mutation.baseVersion === 0)) records.push(mutation);
  });
  return records;
}

export { VERSION_STORAGE_KEY };
