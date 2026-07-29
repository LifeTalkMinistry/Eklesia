import { getBrowserStorage, STORAGE_KEYS } from './storageRegistry.js';

const MESSAGING_VERSION = 1;
export const MESSAGING_UPDATED_EVENT = 'ekklesia-pulse:messaging-updated';

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createEmptyState() {
  return {
    version: MESSAGING_VERSION,
    threads: [],
  };
}

function normalizeMessage(message, index) {
  return {
    id: String(message?.id || `message-${index}`),
    senderType: ['me', 'other', 'system'].includes(message?.senderType) ? message.senderType : 'system',
    senderName: String(message?.senderName || ''),
    text: String(message?.text || ''),
    createdAt: String(message?.createdAt || new Date().toISOString()),
  };
}

function normalizeThread(thread, index) {
  const type = thread?.type === 'room' ? 'room' : 'direct';
  return {
    id: String(thread?.id || `${type}:thread-${index}`),
    type,
    targetId: String(thread?.targetId || ''),
    title: String(thread?.title || (type === 'room' ? 'Room chat' : 'Conversation')),
    subtitle: String(thread?.subtitle || ''),
    unreadCount: Math.max(0, Number(thread?.unreadCount) || 0),
    updatedAt: String(thread?.updatedAt || new Date(0).toISOString()),
    messages: (Array.isArray(thread?.messages) ? thread.messages : []).map(normalizeMessage),
  };
}

function normalizeState(value) {
  return {
    version: MESSAGING_VERSION,
    threads: (Array.isArray(value?.threads) ? value.threads : []).map(normalizeThread),
  };
}

function readState() {
  const storage = getBrowserStorage();
  if (!storage) return createEmptyState();

  try {
    const raw = storage.getItem(STORAGE_KEYS.messagingPrototype);
    return raw ? normalizeState(JSON.parse(raw)) : createEmptyState();
  } catch (error) {
    console.warn('Ekklesia Pulse could not restore prototype messages.', error);
    return createEmptyState();
  }
}

function dispatchMessagingUpdated(state) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(MESSAGING_UPDATED_EVENT, {
    detail: { state: clone(state) },
  }));
}

function writeState(state) {
  const normalized = normalizeState(state);
  const storage = getBrowserStorage();

  if (storage) {
    try {
      storage.setItem(STORAGE_KEYS.messagingPrototype, JSON.stringify(normalized));
    } catch (error) {
      console.warn('Ekklesia Pulse could not save prototype messages.', error);
    }
  }

  dispatchMessagingUpdated(normalized);
  return clone(normalized);
}

function createThread(target) {
  const type = target?.type === 'room' ? 'room' : 'direct';
  const targetId = String(target?.id || '').trim();
  if (!targetId) return null;

  const now = new Date().toISOString();
  return {
    id: `${type}:${targetId}`,
    type,
    targetId,
    title: String(target?.name || (type === 'room' ? 'Room chat' : 'Conversation')),
    subtitle: String(target?.subtitle || (type === 'room' ? 'Members of this room' : 'Private conversation')),
    unreadCount: 0,
    updatedAt: now,
    messages: type === 'room' ? [{
      id: `system-${targetId}`,
      senderType: 'system',
      senderName: 'Ekklesia Pulse',
      text: 'This room chat is a local prototype. Messages stay on this device and are not delivered to other members yet.',
      createdAt: now,
    }] : [],
  };
}

export function getMessagingState() {
  return clone(readState());
}

export function ensureMessagingThread(target) {
  const state = readState();
  const threadId = `${target?.type === 'room' ? 'room' : 'direct'}:${String(target?.id || '').trim()}`;
  let thread = state.threads.find((item) => item.id === threadId);

  if (!thread) {
    thread = createThread(target);
    if (!thread) return { ok: false, state: clone(state), thread: null };
    state.threads.push(thread);
    writeState(state);
  } else {
    thread.title = String(target?.name || thread.title);
    thread.subtitle = String(target?.subtitle || thread.subtitle);
  }

  return { ok: true, state: clone(state), thread: clone(thread) };
}

export function sendPrototypeMessage(threadId, text, senderName = 'You') {
  const normalizedText = String(text || '').trim();
  if (!normalizedText) return { ok: false, error: 'Write a message first.' };
  if (normalizedText.length > 2000) return { ok: false, error: 'Keep prototype messages under 2,000 characters.' };

  const state = readState();
  const thread = state.threads.find((item) => item.id === threadId);
  if (!thread) return { ok: false, error: 'This conversation is unavailable.' };

  const now = new Date().toISOString();
  thread.messages.push({
    id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    senderType: 'me',
    senderName: String(senderName || 'You'),
    text: normalizedText,
    createdAt: now,
  });
  thread.updatedAt = now;
  thread.unreadCount = 0;

  const saved = writeState(state);
  return {
    ok: true,
    state: saved,
    thread: clone(saved.threads.find((item) => item.id === threadId)),
  };
}

export function markPrototypeThreadRead(threadId) {
  const state = readState();
  const thread = state.threads.find((item) => item.id === threadId);
  if (!thread || thread.unreadCount === 0) return clone(state);
  thread.unreadCount = 0;
  return writeState(state);
}

export function getPrototypeUnreadCount() {
  return readState().threads.reduce((total, thread) => total + thread.unreadCount, 0);
}
