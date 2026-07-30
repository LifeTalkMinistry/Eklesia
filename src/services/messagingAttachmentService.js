import { requireActiveAccountId } from './sync/accountContext.js';

const DATABASE_NAME = 'ekklesiaPulseMessaging';
const DATABASE_VERSION = 2;
const ATTACHMENT_STORE = 'attachments';

export const MAX_MESSAGE_ATTACHMENT_BYTES = 8 * 1024 * 1024;
export const MAX_MESSAGE_ATTACHMENTS = 3;

const ALLOWED_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

function attachmentId() {
  return `attachment-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
}

function openDatabase() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('This browser does not support attachment storage.'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      let store;
      if (!database.objectStoreNames.contains(ATTACHMENT_STORE)) {
        store = database.createObjectStore(ATTACHMENT_STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      } else {
        store = request.transaction.objectStore(ATTACHMENT_STORE);
      }
      if (!store.indexNames.contains('account-created')) {
        store.createIndex('account-created', ['accountId', 'createdAt'], { unique: false });
      }
      if (!store.indexNames.contains('account-server')) {
        store.createIndex('account-server', ['accountId', 'serverAttachmentId'], { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Attachment storage could not be opened.'));
  });
}

function runTransaction(mode, operation) {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(ATTACHMENT_STORE, mode);
    const store = transaction.objectStore(ATTACHMENT_STORE);
    let result;

    try {
      result = operation(store, transaction);
    } catch (error) {
      database.close();
      reject(error);
      return;
    }

    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Attachment storage operation failed.'));
    };
    transaction.onabort = transaction.onerror;
  }));
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Attachment could not be read.'));
  });
}

export function getAttachmentKind(type = '') {
  if (String(type).startsWith('image/')) return 'image';
  if (type === 'application/pdf') return 'pdf';
  return 'file';
}

export function formatAttachmentSize(bytes) {
  const size = Math.max(0, Number(bytes) || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

export function validateMessagingFile(file) {
  if (!(file instanceof File) && !(file instanceof Blob)) return { ok: false, error: 'Choose a valid file.' };
  if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
    return { ok: false, error: `${file.name || 'This file'} is not a supported image, PDF, or office document.` };
  }
  if (file.size <= 0) return { ok: false, error: `${file.name || 'This file'} is empty.` };
  if (file.size > MAX_MESSAGE_ATTACHMENT_BYTES) {
    return { ok: false, error: `${file.name || 'This file'} is larger than the 8 MB Private Alpha limit.` };
  }
  return { ok: true };
}

function normalizeRecord(input, accountId) {
  const blob = input.blob;
  return {
    id: String(input.id || attachmentId()),
    accountId: String(accountId),
    name: String(input.name || 'Attachment').slice(0, 180),
    type: String(input.type || blob?.type || 'application/octet-stream'),
    size: Math.max(0, Number(input.size ?? blob?.size) || 0),
    kind: input.kind || getAttachmentKind(input.type || blob?.type),
    createdAt: String(input.createdAt || new Date().toISOString()),
    updatedAt: new Date().toISOString(),
    blob,
    serverAttachmentId: input.serverAttachmentId ? String(input.serverAttachmentId) : '',
    sha256: String(input.sha256 || ''),
    transferStatus: String(input.transferStatus || (input.serverAttachmentId ? 'ready' : 'local')),
    transferProgress: Math.max(0, Math.min(100, Number(input.transferProgress) || 0)),
    lastError: String(input.lastError || ''),
  };
}

export async function saveMessagingAttachment(file) {
  const validation = validateMessagingFile(file);
  if (!validation.ok) return validation;
  const accountId = requireActiveAccountId();
  const record = normalizeRecord({
    name: file.name || 'Attachment',
    type: file.type,
    size: file.size,
    kind: getAttachmentKind(file.type),
    blob: file,
  }, accountId);

  try {
    await runTransaction('readwrite', (store) => store.put(record));
    const { blob, ...metadata } = record;
    return { ok: true, attachment: metadata };
  } catch (error) {
    console.warn('Ekklesia Pulse could not save a messaging attachment.', error);
    return { ok: false, error: 'This browser could not save the attachment. Check available device storage and try again.' };
  }
}

export async function importMessagingAttachment(input) {
  const accountId = requireActiveAccountId();
  const blob = input?.blob;
  if (!(blob instanceof Blob)) return { ok: false, error: 'The downloaded attachment is invalid.' };
  const validation = validateMessagingFile(blob);
  if (!validation.ok) return validation;
  const record = normalizeRecord({ ...input, blob }, accountId);
  try {
    await runTransaction('readwrite', (store) => store.put(record));
    const { blob: storedBlob, ...metadata } = record;
    return { ok: true, attachment: metadata };
  } catch (error) {
    console.warn('Ekklesia Pulse could not import a messaging attachment.', error);
    return { ok: false, error: 'This browser could not store the downloaded attachment.' };
  }
}

export async function getMessagingAttachment(id) {
  const accountId = requireActiveAccountId();
  try {
    const database = await openDatabase();
    const transaction = database.transaction(ATTACHMENT_STORE, 'readwrite');
    const store = transaction.objectStore(ATTACHMENT_STORE);
    const result = await requestResult(store.get(String(id || '')));
    if (result && !result.accountId) {
      result.accountId = accountId;
      result.updatedAt = new Date().toISOString();
      store.put(result);
    }
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = transaction.onerror;
    });
    database.close();
    return result && String(result.accountId) === accountId ? result : null;
  } catch (error) {
    console.warn('Ekklesia Pulse could not read a messaging attachment.', error);
    return null;
  }
}

export async function updateMessagingAttachment(id, patch = {}) {
  const accountId = requireActiveAccountId();
  try {
    let updated = null;
    await runTransaction('readwrite', async (store) => {
      const current = await requestResult(store.get(String(id || '')));
      if (!current || (current.accountId && String(current.accountId) !== accountId)) return;
      updated = normalizeRecord({ ...current, ...patch, id: current.id, blob: current.blob }, accountId);
      store.put(updated);
    });
    if (!updated) return { ok: false, error: 'The attachment was not found on this account.' };
    const { blob, ...metadata } = updated;
    return { ok: true, attachment: metadata };
  } catch (error) {
    return { ok: false, error };
  }
}

export async function findMessagingAttachmentByServerId(serverAttachmentId) {
  const accountId = requireActiveAccountId();
  try {
    const database = await openDatabase();
    const transaction = database.transaction(ATTACHMENT_STORE, 'readonly');
    const index = transaction.objectStore(ATTACHMENT_STORE).index('account-server');
    const result = await requestResult(index.get([accountId, String(serverAttachmentId || '')]));
    database.close();
    return result;
  } catch {
    return null;
  }
}

export async function deleteMessagingAttachment(id) {
  const accountId = requireActiveAccountId();
  try {
    await runTransaction('readwrite', async (store) => {
      const current = await requestResult(store.get(String(id || '')));
      if (!current || (current.accountId && String(current.accountId) !== accountId)) return;
      store.delete(String(id || ''));
    });
    return { ok: true };
  } catch (error) {
    console.warn('Ekklesia Pulse could not delete a messaging attachment.', error);
    return { ok: false, error };
  }
}

export async function deleteAllMessagingAttachments() {
  const accountId = requireActiveAccountId();
  try {
    await runTransaction('readwrite', async (store) => {
      const all = await requestResult(store.getAll());
      (Array.isArray(all) ? all : []).forEach((record) => {
        if (!record.accountId || String(record.accountId) === accountId) store.delete(record.id);
      });
    });
    return { ok: true };
  } catch (error) {
    console.warn('Ekklesia Pulse could not clear messaging attachments.', error);
    return { ok: false, error };
  }
}
