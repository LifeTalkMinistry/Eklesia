export const EKKLESIA_DATABASE_NAME = 'ekklesia-pulse';
export const EKKLESIA_DATABASE_VERSION = 2;
export const NOTEBOOK_IMAGES_STORE = 'notebookImages';
export const SYNC_OUTBOX_STORE = 'syncOutbox';

let databasePromise = null;

function createIndexedDbError(code, message, cause) {
  const error = new Error(message);
  error.code = code;
  if (cause) error.cause = cause;
  return error;
}

export function isIndexedDbAvailable() {
  return typeof window !== 'undefined' && Boolean(window.indexedDB);
}

export function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || createIndexedDbError(
      'indexeddb-request-failed',
      'Browser storage could not complete the request.',
    ));
  });
}

export function openEkklesiaDatabase() {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(createIndexedDbError(
      'indexeddb-unavailable',
      'Ekklesia Pulse browser storage is unavailable in this browser.',
    ));
  }

  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    let settled = false;
    const request = window.indexedDB.open(EKKLESIA_DATABASE_NAME, EKKLESIA_DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(NOTEBOOK_IMAGES_STORE)) {
        database.createObjectStore(NOTEBOOK_IMAGES_STORE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(SYNC_OUTBOX_STORE)) {
        const outbox = database.createObjectStore(SYNC_OUTBOX_STORE, { keyPath: 'id' });
        outbox.createIndex('account-created', ['accountId', 'createdAt'], { unique: false });
      }
    };

    request.onblocked = () => {
      if (settled) return;
      settled = true;
      databasePromise = null;
      reject(createIndexedDbError(
        'indexeddb-blocked',
        'Ekklesia Pulse storage is busy in another tab. Close the other tab and try again.',
      ));
    };

    request.onerror = () => {
      if (settled) return;
      settled = true;
      databasePromise = null;
      reject(createIndexedDbError(
        'indexeddb-open-failed',
        'Ekklesia Pulse storage could not be opened on this device.',
        request.error,
      ));
    };

    request.onsuccess = () => {
      if (settled) {
        request.result?.close();
        return;
      }
      settled = true;
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };
  });

  return databasePromise;
}

export async function runStoreTransaction(storeName, mode, action) {
  const database = await openEkklesiaDatabase();

  return new Promise((resolve, reject) => {
    let actionResult;
    let actionError = null;
    let transaction;

    try {
      transaction = database.transaction(storeName, mode);
    } catch (error) {
      reject(createIndexedDbError(
        'indexeddb-transaction-failed',
        'Ekklesia Pulse storage could not start a browser transaction.',
        error,
      ));
      return;
    }

    transaction.oncomplete = () => {
      if (actionError) reject(actionError);
      else resolve(actionResult);
    };

    transaction.onerror = () => {
      reject(transaction.error || actionError || createIndexedDbError(
        'indexeddb-transaction-failed',
        'Ekklesia Pulse storage could not complete the browser transaction.',
      ));
    };

    transaction.onabort = () => {
      reject(transaction.error || actionError || createIndexedDbError(
        'indexeddb-transaction-aborted',
        'Ekklesia Pulse storage stopped before the request was complete.',
      ));
    };

    try {
      const store = transaction.objectStore(storeName);
      Promise.resolve(action(store, transaction))
        .then((result) => { actionResult = result; })
        .catch((error) => {
          actionError = error;
          try {
            transaction.abort();
          } catch {
            reject(error);
          }
        });
    } catch (error) {
      actionError = error;
      try {
        transaction.abort();
      } catch {
        reject(error);
      }
    }
  });
}

export async function runTransaction(mode, action) {
  return runStoreTransaction(NOTEBOOK_IMAGES_STORE, mode, action);
}

export async function closeDatabase() {
  if (!databasePromise) return;
  try {
    const database = await databasePromise;
    database.close();
  } finally {
    databasePromise = null;
  }
}
