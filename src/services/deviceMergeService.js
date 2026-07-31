import { hasBackendSession } from './backendSessionService.js';
import { synchronizeAccountFiles } from './fileSyncBootstrap.js';
import { mergeCurrentDeviceRecords } from './sync/syncCoordinator.js';

let activeMergePromise = null;

async function executeDeviceMerge() {
  if (!hasBackendSession()) {
    return {
      ok: false,
      reason: 'not-connected',
      error: new Error('Log in to your Ekklesia account before merging this device.'),
    };
  }

  const records = await mergeCurrentDeviceRecords();
  if (!records?.ok) {
    return {
      ok: false,
      phase: 'records',
      records,
      error: records?.error || new Error('Account records could not be merged.'),
    };
  }

  const files = await synchronizeAccountFiles();
  if (!files?.ok) {
    return {
      ok: false,
      phase: 'files',
      records,
      files,
      error: files?.error || files?.errors?.[0] || new Error('Files could not be merged.'),
    };
  }

  return {
    ok: true,
    records,
    files,
  };
}

export function mergeThisDeviceWithAccount() {
  if (activeMergePromise) return activeMergePromise;
  activeMergePromise = executeDeviceMerge().finally(() => {
    activeMergePromise = null;
  });
  return activeMergePromise;
}
