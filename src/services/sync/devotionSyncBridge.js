import { createDevotionMutation } from './localSyncRepository.js';
import { enqueueSyncMutation } from './syncOutbox.js';
import { synchronizeNow } from './syncCoordinator.js';

export function queueDevotionForSync(entry, operation = 'upsert') {
  const mutation = createDevotionMutation(entry, operation);
  if (!mutation) return Promise.resolve({ ok: false, reason: 'invalid-devotion' });

  return enqueueSyncMutation(mutation)
    .then((result) => {
      if (result.ok) void synchronizeNow({ reason: 'devotion-mutation' });
      return result;
    })
    .catch((error) => {
      console.warn('Ekklesia Pulse could not queue the devotion for synchronization.', error);
      return { ok: false, error };
    });
}
