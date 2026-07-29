import { getBrowserStorage, STORAGE_KEYS } from './storageRegistry.js';

const MESSAGING_VERSION = 2;
export const MESSAGING_UPDATED_EVENT = 'ekklesia-pulse:messaging-updated';
export const MESSAGE_REACTION_OPTIONS = ['👍', '❤️', '🙏', '😂', '😮', '😢'];

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createEmptyState() {
  return {
    version: MESSAGING_VERSION,
    threads: [],
  };
}

function normalizeAttachment(attachment, index) {
  return {
    id: String(attachment?.id || `attachment-${index}`),
    name: String(attachment?.name || 'Attachment'),
    type: String(attachment?.type || 'application/octet-stream'),
    size: Math.max(0, Number(attachment?.size) || 0),
    kind: ['image', 'pdf', 'file'].includes(attachment?.kind) ? attachment.kind : 'file',
    createdAt: String(attachment?.createdAt || new Date().toISOString()),
  };
}

function normalizeReaction(reaction) {
  const emoji = String(reaction?.emoji || '');
  return {
    emoji,
    count: Math.max(0, Number(reaction?.count) || 0),
    reactedByMe: Boolean(reaction?.reactedByMe),
  };
}

function normalizeReply(reply) {
  if (!reply?.id) return null;
  return {
    id: String(reply.id),
    senderName: String(reply.senderName || ''),
    text: String(reply.text || ''),
  };
}

function normalizeMessage(message, index) {
  return {
    id: String(message?.id || `message-${index}`),
    senderType: ['me', 'other', 'system'].includes(message?.senderType) ? message.senderType : 'system',
    senderName: String(message?.senderName || ''),
    text: String(message?.text || ''),
    attachments: (Array.isArray(message?.attachments) ? message.attachments : []).map(normalizeAttachment),
    reactions: (Array.isArray(message?.reactions) ? message.reactions : [])
      .map(normalizeReaction)
      .filter((reaction) => reaction.emoji && reaction.count > 0),
    replyTo: normalizeReply(message?.replyTo),
    deletedAt: message?.deletedAt ? String(message.deletedAt) : null,
    createdAt: String(message?.createdAt || new Date().toISOString()),
  };
}

function normalizeThread(thread, index) {
  const type = thread?.type === 'room' ? 'room' : 'direct';
  return {
    id: String(thread?.id || `${type}:thread-${index}`),
    type,
    targetId: String(thread?.targetId || ''),
    callTargetId: type === 'direct' ? String(thread?.callTargetId || '') : '',
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
    callTargetId: type === 'direct' ? String(target?.callTargetId || target?.backendUserId || '').trim() : '',
    title: String(target?.name || (type === 'room' ? 'Room chat' : 'Conversation')),
    subtitle: String(target?.subtitle || (type === 'room' ? 'Members of this room' : 'Private conversation')),
    unreadCount: 0,
    updatedAt: now,
    messages: type === 'room' ? [{
      id: `system-${targetId}`,
      senderType: 'system',
      senderName: 'Ekklesia Pulse',
      text: 'This room chat is a local prototype. Messages stay on this device and are not delivered to other members yet.',
      attachments: [],
      reactions: [],
      replyTo: null,
      deletedAt: null,
      createdAt: now,
    }] : [],
  };
}

function findThreadAndMessage(state, threadId, messageId) {
  const thread = state.threads.find((item) => item.id === threadId);
  const message = thread?.messages.find((item) => item.id === messageId);
  return { thread, message };
}

export function getMessagingState() {
  return clone(readState());
}

export function ensureMessagingThread(target) {
  const state = readState();
  const threadId = `${target?.type === 'room' ? 'room' : 'direct'}:${String(target?.id || '').trim()}`;
  let thread = state.threads.find((item) => item.id === threadId);
  let changed = false;

  if (!thread) {
    thread = createThread(target);
    if (!thread) return { ok: false, state: clone(state), thread: null };
    state.threads.push(thread);
    changed = true;
  } else {
    const nextTitle = String(target?.name || thread.title);
    const nextSubtitle = String(target?.subtitle || thread.subtitle);
    const nextCallTargetId = thread.type === 'direct'
      ? String(target?.callTargetId || target?.backendUserId || thread.callTargetId || '').trim()
      : '';

    if (thread.title !== nextTitle) {
      thread.title = nextTitle;
      changed = true;
    }
    if (thread.subtitle !== nextSubtitle) {
      thread.subtitle = nextSubtitle;
      changed = true;
    }
    if (thread.callTargetId !== nextCallTargetId) {
      thread.callTargetId = nextCallTargetId;
      changed = true;
    }
  }

  const savedState = changed ? writeState(state) : clone(state);
  const savedThread = savedState.threads.find((item) => item.id === threadId);
  return { ok: true, state: savedState, thread: clone(savedThread) };
}

export function sendPrototypeMessage(threadId, payload, senderName = 'You') {
  const content = typeof payload === 'string' ? { text: payload } : (payload || {});
  const normalizedText = String(content.text || '').trim();
  const attachments = (Array.isArray(content.attachments) ? content.attachments : []).map(normalizeAttachment);
  if (!normalizedText && !attachments.length) return { ok: false, error: 'Write a message or attach a file first.' };
  if (normalizedText.length > 4000) return { ok: false, error: 'Keep messages under 4,000 characters.' };
  if (attachments.length > 3) return { ok: false, error: 'You can send up to three attachments in one message.' };

  const state = readState();
  const thread = state.threads.find((item) => item.id === threadId);
  if (!thread) return { ok: false, error: 'This conversation is unavailable.' };

  const now = new Date().toISOString();
  const replyMessage = content.replyToId
    ? thread.messages.find((message) => message.id === content.replyToId)
    : null;
  thread.messages.push({
    id: `message-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    senderType: 'me',
    senderName: String(senderName || 'You'),
    text: normalizedText,
    attachments,
    reactions: [],
    replyTo: replyMessage ? {
      id: replyMessage.id,
      senderName: replyMessage.senderType === 'me' ? 'You' : replyMessage.senderName,
      text: replyMessage.deletedAt ? 'Message removed' : replyMessage.text.slice(0, 180),
    } : null,
    deletedAt: null,
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

export function togglePrototypeReaction(threadId, messageId, emoji) {
  if (!MESSAGE_REACTION_OPTIONS.includes(emoji)) return { ok: false, error: 'That reaction is unavailable.' };
  const state = readState();
  const { thread, message } = findThreadAndMessage(state, threadId, messageId);
  if (!thread || !message || message.deletedAt) return { ok: false, error: 'This message is unavailable.' };

  const existing = message.reactions.find((reaction) => reaction.emoji === emoji);
  if (existing?.reactedByMe) {
    existing.count -= 1;
    existing.reactedByMe = false;
    message.reactions = message.reactions.filter((reaction) => reaction.count > 0);
  } else if (existing) {
    existing.count += 1;
    existing.reactedByMe = true;
  } else {
    message.reactions.push({ emoji, count: 1, reactedByMe: true });
  }

  const saved = writeState(state);
  return { ok: true, state: saved, thread: clone(saved.threads.find((item) => item.id === threadId)) };
}

export function deletePrototypeMessage(threadId, messageId) {
  const state = readState();
  const { thread, message } = findThreadAndMessage(state, threadId, messageId);
  if (!thread || !message) return { ok: false, error: 'This message is unavailable.' };
  if (message.senderType !== 'me') return { ok: false, error: 'Only your own messages can be removed.' };

  message.text = '';
  message.attachments = [];
  message.reactions = [];
  message.deletedAt = new Date().toISOString();
  const saved = writeState(state);
  return { ok: true, state: saved, thread: clone(saved.threads.find((item) => item.id === threadId)) };
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
