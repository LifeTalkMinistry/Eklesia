import { getBrowserStorage, STORAGE_KEYS } from './storageRegistry.js';

let memorySeen = false;

export function hasSeenIntroduction() {
  const storage = getBrowserStorage();
  if (!storage) return memorySeen;

  try {
    const stored = storage.getItem(STORAGE_KEYS.introductionSeen);
    if (stored !== null) memorySeen = stored === 'true';
    return memorySeen;
  } catch (error) {
    console.warn('Ekklesia Pulse could not restore the introduction state.', error);
    return memorySeen;
  }
}

export function markIntroductionSeen() {
  memorySeen = true;
  const storage = getBrowserStorage();
  if (!storage) return { ok: true, persisted: false };

  try {
    storage.setItem(STORAGE_KEYS.introductionSeen, 'true');
    return {
      ok: true,
      persisted: storage.getItem(STORAGE_KEYS.introductionSeen) === 'true',
    };
  } catch (error) {
    console.warn('Ekklesia Pulse could not save the introduction state.', error);
    return { ok: true, persisted: false, error };
  }
}

export function resetIntroductionSeen() {
  memorySeen = false;
  const storage = getBrowserStorage();
  if (!storage) return { ok: true, removed: false, persisted: false };

  try {
    storage.removeItem(STORAGE_KEYS.introductionSeen);
    const removed = storage.getItem(STORAGE_KEYS.introductionSeen) === null;
    return { ok: removed, removed, persisted: removed };
  } catch (error) {
    console.warn('Ekklesia Pulse could not reset the introduction state.', error);
    return { ok: false, removed: false, persisted: false, error };
  }
}
