const DATABASE_NAME = 'ekklesiaPulseMessaging';
const DATABASE_VERSION = 1;
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
  return `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function openDatabase() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('This browser does not support attachment storage.'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(ATTACHMENT_STORE)) {
        const store = database.createObjectStore(ATTACHMENT_STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
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
      result = operation(store);
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
  if (!(file instanceof File)) return { ok: false, error: 'Choose a valid file.' };
  if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
    return { ok: false, error: `${file.name || 'This file'} is not a supported image, PDF, or office document.` };
  }
  if (file.size <= 0) return { ok: false, error: `${file.name || 'This file'} is empty.` };
  if (file.size > MAX_MESSAGE_ATTACHMENT_BYTES) {
    return { ok: false, error: `${file.name || 'This file'} is larger than the 8 MB Private Alpha limit.` };
  }
  return { ok: true };
}

export async function saveMessagingAttachment(file) {
  const validation = validateMessagingFile(file);
  if (!validation.ok) return validation;

  const record = {
    id: attachmentId(),
    name: String(file.name || 'Attachment').slice(0, 180),
    type: String(file.type || 'application/octet-stream'),
    size: file.size,
    kind: getAttachmentKind(file.type),
    createdAt: new Date().toISOString(),
    blob: file,
  };

  try {
    await runTransaction('readwrite', (store) => store.put(record));
    const { blob, ...metadata } = record;
    return { ok: true, attachment: metadata };
  } catch (error) {
    console.warn('Ekklesia Pulse could not save a messaging attachment.', error);
    return { ok: false, error: 'This browser could not save the attachment. Check available device storage and try again.' };
  }
}

export async function getMessagingAttachment(id) {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(ATTACHMENT_STORE, 'readonly');
    const result = await requestResult(transaction.objectStore(ATTACHMENT_STORE).get(String(id || '')));
    database.close();
    return result;
  } catch (error) {
    console.warn('Ekklesia Pulse could not read a messaging attachment.', error);
    return null;
  }
}

export async function deleteMessagingAttachment(id) {
  try {
    await runTransaction('readwrite', (store) => store.delete(String(id || '')));
    return { ok: true };
  } catch (error) {
    console.warn('Ekklesia Pulse could not delete a messaging attachment.', error);
    return { ok: false, error };
  }
}

export async function deleteAllMessagingAttachments() {
  try {
    await runTransaction('readwrite', (store) => store.clear());
    return { ok: true };
  } catch (error) {
    console.warn('Ekklesia Pulse could not clear messaging attachments.', error);
    return { ok: false, error };
  }
}
