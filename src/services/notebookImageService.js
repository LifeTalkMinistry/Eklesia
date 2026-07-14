import {
  NOTEBOOK_IMAGES_STORE,
  isIndexedDbAvailable,
  openEkklesiaDatabase,
  requestToPromise,
  runTransaction,
} from '../lib/indexedDb.js';

function createImageId() {
  const randomPart = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `notebook-image-${randomPart}`;
}

function normalizeError(error, fallbackCode = 'notebook-storage-failed') {
  const name = error?.name || error?.cause?.name || '';
  const code = error?.code
    || (name === 'QuotaExceededError' ? 'storage-quota-exceeded' : fallbackCode);

  const messages = {
    'indexeddb-unavailable': 'Notebook-photo storage is unavailable in this browser. You can still use typed devotions and the Bible reader.',
    'storage-quota-exceeded': 'This device does not have enough available browser storage for the notebook photo. Try replacing it with a smaller image or remove older notebook photos.',
    'notebook-image-missing': 'The saved notebook photo could not be found on this device.',
  };

  return {
    code,
    message: messages[code] || error?.message || 'The notebook photo could not be saved on this device.',
  };
}

function fail(error, fallbackCode) {
  return { ok: false, error: normalizeError(error, fallbackCode) };
}

function normalizeMetadata(blob, metadata = {}) {
  return {
    mimeType: metadata.mimeType || blob.type || 'image/jpeg',
    width: Number(metadata.width) || 0,
    height: Number(metadata.height) || 0,
    sizeBytes: Number(metadata.sizeBytes) || blob.size || 0,
  };
}

export function isNotebookImageStorageAvailable() {
  return isIndexedDbAvailable();
}

export async function checkNotebookImageStorage() {
  try {
    await openEkklesiaDatabase();
    return { ok: true, data: { accessible: true, store: NOTEBOOK_IMAGES_STORE } };
  } catch (error) {
    return fail(error, 'indexeddb-unavailable');
  }
}

export async function saveNotebookImage(blob, metadata = {}) {
  if (!(blob instanceof Blob)) {
    return fail(new Error('A processed image Blob is required.'), 'invalid-notebook-image');
  }

  const now = new Date().toISOString();
  const id = createImageId();
  const record = {
    id,
    blob,
    ...normalizeMetadata(blob, metadata),
    createdAt: now,
    updatedAt: now,
  };

  try {
    await runTransaction('readwrite', (store) => requestToPromise(store.add(record)));
    return { ok: true, data: record };
  } catch (error) {
    return fail(error);
  }
}

export async function getNotebookImage(imageId) {
  if (!imageId) return fail(new Error('Notebook image ID is missing.'), 'notebook-image-missing');

  try {
    const record = await runTransaction('readonly', (store) => requestToPromise(store.get(imageId)));
    if (!record?.blob) return fail(new Error('Notebook image record was not found.'), 'notebook-image-missing');
    return { ok: true, data: record };
  } catch (error) {
    return fail(error);
  }
}

export async function replaceNotebookImage(imageId, blob, metadata = {}) {
  if (!imageId || !(blob instanceof Blob)) {
    return fail(new Error('A notebook image ID and processed image Blob are required.'), 'invalid-notebook-image');
  }

  try {
    const record = await runTransaction('readwrite', async (store) => {
      const existing = await requestToPromise(store.get(imageId));
      const now = new Date().toISOString();
      const replacement = {
        id: imageId,
        blob,
        ...normalizeMetadata(blob, metadata),
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      await requestToPromise(store.put(replacement));
      return replacement;
    });
    return { ok: true, data: record };
  } catch (error) {
    return fail(error);
  }
}

export async function restoreNotebookImageRecord(record) {
  if (!record?.id || !(record.blob instanceof Blob)) {
    return fail(new Error('A valid notebook image record is required.'), 'invalid-notebook-image');
  }

  try {
    await runTransaction('readwrite', (store) => requestToPromise(store.put(record)));
    return { ok: true, data: record };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteNotebookImage(imageId) {
  if (!imageId) return { ok: true, data: { deleted: false } };

  try {
    await runTransaction('readwrite', (store) => requestToPromise(store.delete(imageId)));
    return { ok: true, data: { deleted: true, imageId } };
  } catch (error) {
    return fail(error);
  }
}

export async function imageExists(imageId) {
  if (!imageId) return { ok: true, data: false };

  try {
    const count = await runTransaction('readonly', (store) => requestToPromise(store.count(imageId)));
    return { ok: true, data: count > 0 };
  } catch (error) {
    return fail(error);
  }
}

export async function getNotebookStorageSummary() {
  try {
    const records = await runTransaction('readonly', (store) => requestToPromise(store.getAll()));
    const safeRecords = Array.isArray(records) ? records : [];
    return {
      ok: true,
      data: {
        imageCount: safeRecords.length,
        sizeBytes: safeRecords.reduce((sum, item) => sum + (Number(item?.sizeBytes) || item?.blob?.size || 0), 0),
        approximate: true,
      },
    };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteAllNotebookImages() {
  if (!isIndexedDbAvailable()) {
    return fail(new Error('IndexedDB is unavailable.'), 'indexeddb-unavailable');
  }

  try {
    await runTransaction('readwrite', (store) => requestToPromise(store.clear()));
    return { ok: true, data: { deletedAll: true } };
  } catch (error) {
    return fail(error);
  }
}
