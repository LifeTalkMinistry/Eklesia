import {
  NOTEBOOK_IMAGE_STORE,
  requestToPromise,
  runStoreTransaction,
} from '../lib/indexedDb.js';
import { getBackendAccountId, hasBackendSession } from './backendSessionService.js';
import {
  getAllDevotions,
  updateNotebookImageReference,
} from './devotionService.js';
import {
  downloadRemoteAttachment,
  listRemoteNotebookAttachments,
  uploadBlobResumably,
} from './fileTransferService.js';
import { getNotebookImage } from './notebookImageService.js';
import { requireActiveAccountId } from './sync/accountContext.js';

let activeNotebookFileSync = null;
let triggersInstalled = false;
let scheduledTimer = null;

function notebookMetadata(entry) {
  return entry?.notebookMetadata
    || entry?.notebook?.metadata
    || entry?.notebook
    || {};
}

function isNotebookEntry(entry) {
  const format = entry?.format || entry?.devotionFormat || entry?.notebook?.format;
  return format === 'notebook'
    || Boolean(entry?.notebookImageId || entry?.imageId || notebookMetadata(entry).imageId);
}

function localImageId(entry) {
  const metadata = notebookMetadata(entry);
  return String(
    entry?.notebookImageId
    || entry?.imageId
    || metadata.imageId
    || metadata.clientAttachmentId
    || '',
  );
}

function remoteAttachmentId(entry) {
  const metadata = notebookMetadata(entry);
  return String(metadata.serverAttachmentId || metadata.attachmentId || '');
}

function devotionClientRecordId(entry) {
  return String(entry?.id || entry?.clientRecordId || '');
}

async function updateNotebookRecord(imageId, patch = {}) {
  const accountId = requireActiveAccountId();
  let updated = null;
  await runStoreTransaction(NOTEBOOK_IMAGE_STORE, 'readwrite', async (store) => {
    const current = await requestToPromise(store.get(imageId));
    if (!current || String(current.accountId || accountId) !== accountId) return;
    updated = {
      ...current,
      ...patch,
      id: current.id,
      accountId,
      updatedAt: new Date().toISOString(),
    };
    await requestToPromise(store.put(updated));
  });
  return updated;
}

async function importNotebookBlob(attachment, blob) {
  const accountId = requireActiveAccountId();
  const imageId = String(attachment.clientAttachmentId || `notebook-server-${attachment.id}`);
  const existing = await getNotebookImage(imageId);
  const record = {
    ...(existing || {}),
    id: imageId,
    accountId,
    blob,
    fileName: attachment.name,
    mimeType: attachment.type,
    originalSize: Number(attachment.size) || blob.size,
    storedSize: blob.size,
    createdAt: existing?.createdAt || attachment.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    serverAttachmentId: String(attachment.id),
    sha256: attachment.sha256,
    transferStatus: 'ready',
    transferProgress: 100,
    lastError: '',
  };
  await runStoreTransaction(NOTEBOOK_IMAGE_STORE, 'readwrite', (store) => requestToPromise(store.put(record)));
  return record;
}

async function uploadNotebookEntry(entry) {
  const devotionId = devotionClientRecordId(entry);
  const imageId = localImageId(entry);
  if (!devotionId || !imageId) return;
  const local = await getNotebookImage(imageId);
  if (!local?.blob) return;
  if (local.serverAttachmentId && local.transferStatus === 'ready') return;

  await updateNotebookRecord(imageId, {
    transferStatus: 'uploading',
    transferProgress: Math.max(1, Number(local.transferProgress) || 0),
    lastError: '',
  });

  try {
    const remote = await uploadBlobResumably({
      blob: local.blob,
      metadata: {
        purpose: 'notebook',
        devotionClientRecordId: devotionId,
        clientAttachmentId: imageId,
        fileName: local.fileName || `${devotionId}.jpg`,
        mimeType: local.mimeType || local.blob.type || 'image/jpeg',
        sha256: local.sha256 || undefined,
      },
      onProgress(progress) {
        void updateNotebookRecord(imageId, {
          transferStatus: 'uploading',
          transferProgress: progress,
          lastError: '',
        });
      },
    });
    await updateNotebookRecord(imageId, {
      serverAttachmentId: String(remote.id),
      sha256: remote.sha256,
      transferStatus: 'ready',
      transferProgress: 100,
      lastError: '',
    });
  } catch (error) {
    await updateNotebookRecord(imageId, {
      transferStatus: 'failed',
      lastError: error.message || 'The notebook image could not be uploaded.',
    });
    if (error.isNetworkError || error.code === 'FILE_SERVER_UNREACHABLE') throw error;
  }
}

async function restoreNotebookEntry(entry) {
  const devotionId = devotionClientRecordId(entry);
  if (!devotionId) return;
  let response;
  try {
    response = await listRemoteNotebookAttachments(devotionId);
  } catch (error) {
    if (error.status === 404) return;
    throw error;
  }

  for (const attachment of response.attachments || []) {
    const imageId = String(attachment.clientAttachmentId || `notebook-server-${attachment.id}`);
    const existing = await getNotebookImage(imageId);
    if (!existing?.blob || existing.sha256 !== attachment.sha256) {
      try {
        const blob = await downloadRemoteAttachment(attachment);
        await importNotebookBlob(attachment, blob);
      } catch (error) {
        if (existing) {
          await updateNotebookRecord(imageId, {
            transferStatus: 'failed',
            lastError: error.message || 'The notebook image could not be restored.',
          });
        }
        continue;
      }
    } else if (!existing.serverAttachmentId || existing.transferStatus !== 'ready') {
      await updateNotebookRecord(imageId, {
        serverAttachmentId: String(attachment.id),
        sha256: attachment.sha256,
        transferStatus: 'ready',
        transferProgress: 100,
        lastError: '',
      });
    }

    if (localImageId(entry) !== imageId) {
      updateNotebookImageReference(devotionId, imageId);
    }
  }
}

async function executeNotebookFileSync() {
  if (!hasBackendSession() || !getBackendAccountId()) {
    return { ok: false, reason: 'not-connected' };
  }
  const entries = getAllDevotions().filter(isNotebookEntry);
  for (const entry of entries) await uploadNotebookEntry(entry);
  for (const entry of entries) await restoreNotebookEntry(entry);
  return { ok: true, count: entries.length };
}

export function synchronizeNotebookFiles() {
  if (activeNotebookFileSync) return activeNotebookFileSync;
  activeNotebookFileSync = executeNotebookFileSync().finally(() => {
    activeNotebookFileSync = null;
  });
  return activeNotebookFileSync;
}

function scheduleNotebookFileSync(delay = 1200) {
  if (scheduledTimer || typeof window === 'undefined') return;
  scheduledTimer = window.setTimeout(() => {
    scheduledTimer = null;
    void synchronizeNotebookFiles();
  }, delay);
}

export function installNotebookFileSyncTriggers() {
  if (triggersInstalled || typeof window === 'undefined') return;
  triggersInstalled = true;
  window.addEventListener('online', () => scheduleNotebookFileSync(1500));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleNotebookFileSync(1500);
  });
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void synchronizeNotebookFiles();
  }, 10_000);
  scheduleNotebookFileSync(2200);
}

export function retryNotebookImageSync(imageId) {
  void updateNotebookRecord(String(imageId || ''), {
    transferStatus: 'queued',
    transferProgress: 0,
    lastError: '',
  }).then(() => scheduleNotebookFileSync(0));
}

installNotebookFileSyncTriggers();
