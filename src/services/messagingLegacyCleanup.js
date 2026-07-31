import { getBrowserStorage, STORAGE_KEYS } from './storageRegistry.js';

const LEGACY_JOSHUA_TITLE = 'joshua lim';
const LEGACY_JOSHUA_SUBTITLE = 'same d-group · mighty network d-group';

function isLegacyStaticJoshuaThread(thread) {
  if (!thread || thread.type === 'room') return false;

  const title = String(thread.title || '').trim().toLowerCase();
  const subtitle = String(thread.subtitle || '').trim().toLowerCase();
  const messages = Array.isArray(thread.messages) ? thread.messages : [];

  return title === LEGACY_JOSHUA_TITLE
    && subtitle === LEGACY_JOSHUA_SUBTITLE
    && !String(thread.backendConversationId || '').trim()
    && !String(thread.callTargetId || '').trim()
    && messages.length === 0;
}

export function removeLegacyStaticMessagingThreads() {
  const storage = getBrowserStorage();
  if (!storage) return { removed: 0 };

  try {
    const rawState = storage.getItem(STORAGE_KEYS.messagingPrototype);
    if (!rawState) return { removed: 0 };

    const state = JSON.parse(rawState);
    const threads = Array.isArray(state?.threads) ? state.threads : [];
    const removedThreadIds = new Set(
      threads
        .filter(isLegacyStaticJoshuaThread)
        .map((thread) => String(thread.id || '').trim())
        .filter(Boolean),
    );

    if (!removedThreadIds.size) return { removed: 0 };

    const nextState = {
      ...state,
      threads: threads.filter((thread) => !removedThreadIds.has(String(thread?.id || '').trim())),
    };
    storage.setItem(STORAGE_KEYS.messagingPrototype, JSON.stringify(nextState));

    const rawOutbox = storage.getItem(STORAGE_KEYS.messagingOutbox);
    if (rawOutbox) {
      const outbox = JSON.parse(rawOutbox);
      if (Array.isArray(outbox)) {
        const nextOutbox = outbox.filter((operation) => (
          !removedThreadIds.has(String(operation?.threadId || '').trim())
        ));
        storage.setItem(STORAGE_KEYS.messagingOutbox, JSON.stringify(nextOutbox));
      }
    }

    return { removed: removedThreadIds.size };
  } catch (error) {
    console.warn('Ekklesia Pulse could not remove a legacy messaging contact.', error);
    return { removed: 0 };
  }
}
