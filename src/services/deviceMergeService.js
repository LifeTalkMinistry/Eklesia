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

  try {
    const records = await mergeCurrentDeviceRecords();
    if (!records?.ok) {
      return {
        ok: false,
        phase: 'records',
        records,
        error: records?.error || new Error('Account records could not be merged.'),
      };
    }

    // The first call may join a file pass that was already running before the
    // record merge completed. A second pass guarantees that newly canonical
    // message and devotion IDs are available to attachment synchronization.
    await synchronizeAccountFiles();
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
  } catch (error) {
    return {
      ok: false,
      phase: 'unexpected',
      error,
    };
  }
}

export function mergeThisDeviceWithAccount() {
  if (activeMergePromise) return activeMergePromise;
  activeMergePromise = executeDeviceMerge().finally(() => {
    activeMergePromise = null;
  });
  return activeMergePromise;
}
