import {
  ACCOUNT_OWNED_STORAGE_KEYS,
  STORAGE_KEYS,
  getRawBrowserStorage,
} from '../storageRegistry.js';
import {
  claimLegacyNotebookImages,
  countLegacyNotebookImages,
} from '../notebookImageService.js';
import { getActiveAccountId, requireActiveAccountId } from './accountContext.js';
import { copyLegacyValueIntoAccount, writeAccountStorage } from './accountScopedStorage.js';
import { createProfileMutation } from './localSyncRepository.js';
import { enqueueSyncMutation } from './syncOutbox.js';

const LEGACY_IMPORT_PENDING_KEY = 'ekklesiaPulse.legacyImportPending';

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function getRegistry(storage) {
  const parsed = safeParse(storage?.getItem(STORAGE_KEYS.legacyClaimRegistry), []);
  return Array.isArray(parsed) ? parsed : [];
}

function saveRegistry(storage, registry) {
  storage?.setItem(STORAGE_KEYS.legacyClaimRegistry, JSON.stringify(registry.slice(-100)));
}

function countMessageData(raw) {
  const state = safeParse(raw, {});
  const threads = Array.isArray(state?.threads) ? state.threads : [];
  let attachments = 0;
  threads.forEach((thread) => {
    (Array.isArray(thread?.messages) ? thread.messages : []).forEach((message) => {
      attachments += Array.isArray(message?.attachments) ? message.attachments.length : 0;
    });
  });
  return { conversations: threads.length, attachments };
}

function simpleFingerprint(parts) {
  const input = parts.join('\u241f');
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `legacy-${(hash >>> 0).toString(16).padStart(8, '0')}-${input.length}`;
}

function legacySnapshot(storage) {
  const values = {};
  ACCOUNT_OWNED_STORAGE_KEYS.forEach((key) => {
    if ([STORAGE_KEYS.syncState, STORAGE_KEYS.syncOutboxFallback].includes(key)) return;
    const value = storage?.getItem(key);
    if (value !== null && value !== undefined) values[key] = value;
  });
  return values;
}

export async function inspectLegacyDataClaim() {
  const accountId = getActiveAccountId();
  const storage = getRawBrowserStorage();
  if (!accountId || !storage) return { needed: false, counts: null };

  const values = legacySnapshot(storage);
  const devotions = safeParse(values[STORAGE_KEYS.devotions], []);
  const devotionEntries = Array.isArray(devotions) ? devotions : [];
  const messageCounts = countMessageData(values[STORAGE_KEYS.messagingPrototype]);
  const legacyNotebookImageCount = await countLegacyNotebookImages();
  const counts = {
    devotions: devotionEntries.length,
    notebookDevotions: devotionEntries.filter((entry) => (
      entry?.devotionFormat === 'notebook' || entry?.devotion?.devotionFormat === 'notebook'
    )).length,
    conversations: messageCounts.conversations,
    attachments: messageCounts.attachments,
    notebookImages: legacyNotebookImageCount,
  };

  const hasData = Object.keys(values).length > 0 || legacyNotebookImageCount > 0;
  if (!hasData) return { needed: false, counts, values: {}, fingerprint: '' };

  const fingerprint = simpleFingerprint([
    ...Object.entries(values).sort(([first], [second]) => first.localeCompare(second)).flat(),
    String(legacyNotebookImageCount),
  ]);
  const registry = getRegistry(storage);
  const alreadyClaimed = registry.some((entry) => (
    entry.fingerprint === fingerprint
    && ['imported', 'device-only'].includes(entry.decision)
  ));
  const alreadyHandledForAccount = registry.some((entry) => (
    entry.fingerprint === fingerprint
    && String(entry.accountId) === String(accountId)
    && ['imported', 'device-only'].includes(entry.decision)
  ));

  return {
    needed: !alreadyClaimed && !alreadyHandledForAccount,
    counts,
    values,
    fingerprint,
  };
}

async function copyLegacySnapshot(values) {
  const copied = [];
  Object.keys(values).forEach((key) => {
    const result = copyLegacyValueIntoAccount(key);
    if (result.copied) copied.push(key);
  });
  const notebookResult = await claimLegacyNotebookImages();
  return { copied, notebookImages: notebookResult.data?.claimed || 0 };
}

function recordDecision(fingerprint, decision) {
  const storage = getRawBrowserStorage();
  const accountId = requireActiveAccountId();
  const registry = getRegistry(storage).filter((entry) => !(
    entry.fingerprint === fingerprint && String(entry.accountId) === accountId
  ));
  registry.push({
    fingerprint,
    accountId,
    decision,
    decidedAt: new Date().toISOString(),
  });
  saveRegistry(storage, registry);
}

export async function importLegacyDataIntoAccount(snapshot) {
  const accountId = requireActiveAccountId();
  if (!snapshot?.fingerprint || !snapshot?.values) throw new Error('Legacy import details are unavailable.');
  const copied = await copyLegacySnapshot(snapshot.values);

  const profileMutation = createProfileMutation();
  if (profileMutation) await enqueueSyncMutation(profileMutation);

  writeAccountStorage(LEGACY_IMPORT_PENDING_KEY, JSON.stringify({
    accountId,
    fingerprint: snapshot.fingerprint,
    entityTypes: ['devotion', 'notebook-image', 'conversation', 'attachment', 'preference'],
    createdAt: new Date().toISOString(),
    serverConfirmed: false,
  }));
  recordDecision(snapshot.fingerprint, 'imported');
  return { ok: true, decision: 'imported', copied };
}

export async function keepLegacyDataOnDevice(snapshot) {
  if (!snapshot?.fingerprint || !snapshot?.values) throw new Error('Legacy data details are unavailable.');
  const copied = await copyLegacySnapshot(snapshot.values);
  recordDecision(snapshot.fingerprint, 'device-only');
  return { ok: true, decision: 'device-only', copied };
}

export function reviewLegacyDataLater(snapshot) {
  return { ok: true, decision: 'review-later', fingerprint: snapshot?.fingerprint || '' };
}

export { LEGACY_IMPORT_PENDING_KEY };
