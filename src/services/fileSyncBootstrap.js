import {
  BACKEND_SESSION_UPDATED_EVENT,
  getBackendAccountId,
  hasBackendSession,
} from './backendSessionService.js';
import { synchronizeMessagingFiles } from './messagingFileSyncService.js';
import { synchronizeMessaging } from './messagingSyncService.js';
import { synchronizeNotebookFiles } from './notebookFileSyncService.js';

let activeFileSync = null;
let fileSyncTriggersInstalled = false;
let scheduledFileSync = null;

function canSynchronizeFiles() {
  if (!hasBackendSession() || !getBackendAccountId()) return false;
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

async function executeAccountFileSync() {
  if (!canSynchronizeFiles()) return { ok: false, reason: 'not-connected' };

  // Message records must be canonical before their attachment binaries can be
  // uploaded or restored on another device.
  const messaging = await synchronizeMessaging();
  if (!messaging?.ok) {
    return { ok: false, reason: 'messaging-sync-failed', error: messaging?.error };
  }

  const [messageFiles, notebookFiles] = await Promise.allSettled([
    synchronizeMessagingFiles(messaging.state),
    synchronizeNotebookFiles(),
  ]);

  const failures = [messageFiles, notebookFiles]
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason);

  if (failures.length) {
    failures.forEach((error) => {
      console.warn('Ekklesia Pulse could not complete a file synchronization pass.', error);
    });
    return { ok: false, reason: 'file-sync-failed', errors: failures };
  }

  return {
    ok: true,
    messaging: messageFiles.value,
    notebook: notebookFiles.value,
  };
}

export function synchronizeAccountFiles() {
  if (activeFileSync) return activeFileSync;
  activeFileSync = executeAccountFileSync().finally(() => {
    activeFileSync = null;
  });
  return activeFileSync;
}

function scheduleAccountFileSync(delay = 800) {
  if (scheduledFileSync || typeof window === 'undefined') return;
  scheduledFileSync = window.setTimeout(() => {
    scheduledFileSync = null;
    void synchronizeAccountFiles();
  }, delay);
}

export function installFileSyncBootstrap() {
  if (fileSyncTriggersInstalled || typeof window === 'undefined') return;
  fileSyncTriggersInstalled = true;

  window.addEventListener(BACKEND_SESSION_UPDATED_EVENT, () => scheduleAccountFileSync(500));
  window.addEventListener('online', () => scheduleAccountFileSync(1000));
  window.addEventListener('focus', () => scheduleAccountFileSync(1200));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleAccountFileSync(1200);
  });

  window.setInterval(() => {
    if (document.visibilityState === 'visible') scheduleAccountFileSync(0);
  }, 30_000);

  scheduleAccountFileSync(1800);
}
