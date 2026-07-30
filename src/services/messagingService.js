import {
  cloneMessagingValue,
  createMessagingClientId,
  MESSAGE_REACTION_OPTIONS,
  MESSAGING_UPDATED_EVENT,
  normalizeMessagingAttachment,
  normalizeMessagingMessage,
  normalizeMessagingThread,
  readMessagingState,
  writeMessagingState,
} from './messagingLocalRepository.js';
import {
  installMessagingSyncTriggers,
  queueMessagingSync,
  synchronizeMessaging,
} from './messagingSyncService.js';

export { MESSAGE_REACTION_OPTIONS, MESSAGING_UPDATED_EVENT };
export { installMessagingSyncTriggers, synchronizeMessaging };

function createThread(target) {
  const type = target?.type === 'room' ? 'room' : 'direct';
  const targetId = String(target?.id || '').trim();
  if (!targetId) return null;
  const now = new Date().toISOString();
  return normalizeMessagingThread({
    id: `${type}:${targetId}`,
    clientConversationId: createMessagingClientId('conversation'),
    type,
    targetId,
    callTargetId: type === 'direct'
      ? String(target?.callTargetId || target?.backendUserId || '').trim()
      : '',
    roomType: type === 'room' && target?.roomType === 'dgroup' ? 'dgroup' : 'ministry',
    roomKey: type === 'room' ? String(target?.roomKey || targetId).trim() : '',
    participantUserIds: type === 'room'
      ? (Array.isArray(target?.participantUserIds) ? target.participantUserIds : []).map(String)
      : [],
    title: String(target?.name || (type === 'room' ? 'Room chat' : 'Conversation')),
    subtitle: String(target?.subtitle || (type === 'room' ? 'Members of this room' : 'Private conversation')),
    unreadCount: 0,
    updatedAt: now,
    syncStatus: 'pending',
    messages: type === 'room' ? [{
      id: `system-${targetId}`,
      clientMessageId: createMessagingClientId('system'),
      senderType: 'system',
      senderName: 'Ekklesia Pulse',
      text: 'Messages synchronize for connected room members. Secure attachment transfer will be enabled in the file-sync phase.',
      attachments: [],
      reactions: [],
      replyTo: null,
      deletedAt: null,
      createdAt: now,
      syncStatus: 'local-only',
    }] : [],
  });
}

function findThreadAndMessage(state, threadId, messageId) {
  const thread = state.threads.find((item) => item.id === threadId);
  const message = thread?.messages.find((item) => item.id === messageId);
  return { thread, message };
}

function queueThreadSync(thread) {
  queueMessagingSync({
    operation: 'ensure-thread',
    threadId: thread.id,
  });
}

export function getMessagingState() {
  return cloneMessagingValue(readMessagingState());
}

export function ensureMessagingThread(target) {
  const state = readMessagingState();
  const threadId = `${target?.type === 'room' ? 'room' : 'direct'}:${String(target?.id || '').trim()}`;
  let thread = state.threads.find((item) => item.id === threadId);
  let changed = false;

  if (!thread) {
    thread = createThread(target);
    if (!thread) return { ok: false, state: cloneMessagingValue(state), thread: null };
    state.threads.push(thread);
    changed = true;
  } else {
    const nextTitle = String(target?.name || thread.title);
    const nextSubtitle = String(target?.subtitle || thread.subtitle);
    const nextCallTargetId = thread.type === 'direct'
      ? String(target?.callTargetId || target?.backendUserId || thread.callTargetId || '').trim()
      : '';
    const nextRoomType = thread.type === 'room'
      ? target?.roomType === 'dgroup' ? 'dgroup' : target?.roomType || thread.roomType || 'ministry'
      : '';
    const nextRoomKey = thread.type === 'room'
      ? String(target?.roomKey || thread.roomKey || target?.id || '').trim()
      : '';
    const nextParticipants = thread.type === 'room' && Array.isArray(target?.participantUserIds)
      ? [...new Set(target.participantUserIds.map(String).filter(Boolean))]
      : thread.participantUserIds;

    if (thread.title !== nextTitle) { thread.title = nextTitle; changed = true; }
    if (thread.subtitle !== nextSubtitle) { thread.subtitle = nextSubtitle; changed = true; }
    if (thread.callTargetId !== nextCallTargetId) { thread.callTargetId = nextCallTargetId; changed = true; }
    if (thread.roomType !== nextRoomType) { thread.roomType = nextRoomType; changed = true; }
    if (thread.roomKey !== nextRoomKey) { thread.roomKey = nextRoomKey; changed = true; }
    if (JSON.stringify(thread.participantUserIds) !== JSON.stringify(nextParticipants)) {
      thread.participantUserIds = nextParticipants;
      changed = true;
    }
  }

  const savedState = changed ? writeMessagingState(state) : cloneMessagingValue(state);
  const savedThread = savedState.threads.find((item) => item.id === threadId);
  if (savedThread && !savedThread.backendConversationId) queueThreadSync(savedThread);
  return { ok: true, state: savedState, thread: cloneMessagingValue(savedThread) };
}

export function sendPrototypeMessage(threadId, payload, senderName = 'You') {
  const content = typeof payload === 'string' ? { text: payload } : (payload || {});
  const normalizedText = String(content.text || '').trim();
  const attachments = (Array.isArray(content.attachments) ? content.attachments : [])
    .map(normalizeMessagingAttachment);
  if (!normalizedText && !attachments.length) {
    return { ok: false, error: 'Write a message or attach a file first.' };
  }
  if (normalizedText.length > 4000) return { ok: false, error: 'Keep messages under 4,000 characters.' };
  if (attachments.length > 3) return { ok: false, error: 'You can send up to three attachments in one message.' };

  const state = readMessagingState();
  const thread = state.threads.find((item) => item.id === threadId);
  if (!thread) return { ok: false, error: 'This conversation is unavailable.' };

  const now = new Date().toISOString();
  const replyMessage = content.replyToId
    ? thread.messages.find((message) => message.id === content.replyToId)
    : null;
  const clientMessageId = createMessagingClientId('message');
  const message = normalizeMessagingMessage({
    id: clientMessageId,
    clientMessageId,
    senderType: 'me',
    senderName: String(senderName || 'You'),
    text: normalizedText,
    attachments,
    reactions: [],
    replyTo: replyMessage ? {
      id: replyMessage.id,
      backendMessageId: replyMessage.backendMessageId || '',
      senderName: replyMessage.senderType === 'me' ? 'You' : replyMessage.senderName,
      text: replyMessage.deletedAt ? 'Message removed' : replyMessage.text.slice(0, 180),
    } : null,
    deletedAt: null,
    createdAt: now,
    version: 1,
    deliveryStatus: 'accepted',
    readBy: [],
    syncStatus: normalizedText ? 'pending' : 'local-only',
    lastError: normalizedText ? '' : 'Secure attachment transfer will be enabled in the file-sync phase.',
  });
  thread.messages.push(message);
  thread.updatedAt = now;
  thread.unreadCount = 0;

  const saved = writeMessagingState(state);
  const savedThread = saved.threads.find((item) => item.id === threadId);
  if (!savedThread.backendConversationId) queueThreadSync(savedThread);
  if (normalizedText) {
    queueMessagingSync({ operation: 'send', threadId: savedThread.id, messageId: message.id });
  }

  return {
    ok: true,
    state: saved,
    thread: cloneMessagingValue(savedThread),
  };
}

export function togglePrototypeReaction(threadId, messageId, emoji) {
  if (!MESSAGE_REACTION_OPTIONS.includes(emoji)) {
    return { ok: false, error: 'That reaction is unavailable.' };
  }
  const state = readMessagingState();
  const { thread, message } = findThreadAndMessage(state, threadId, messageId);
  if (!thread || !message || message.deletedAt) {
    return { ok: false, error: 'This message is unavailable.' };
  }

  const existing = message.reactions.find((reaction) => reaction.emoji === emoji);
  let operation = 'reaction-add';
  if (existing?.reactedByMe) {
    existing.count -= 1;
    existing.reactedByMe = false;
    message.reactions = message.reactions.filter((reaction) => reaction.count > 0);
    operation = 'reaction-remove';
  } else if (existing) {
    existing.count += 1;
    existing.reactedByMe = true;
  } else {
    message.reactions.push({ emoji, count: 1, reactedByMe: true });
  }

  const saved = writeMessagingState(state);
  if (message.backendMessageId || message.syncStatus === 'pending' || message.syncStatus === 'syncing') {
    queueMessagingSync({ operation, threadId, messageId, emoji });
  }
  return {
    ok: true,
    state: saved,
    thread: cloneMessagingValue(saved.threads.find((item) => item.id === threadId)),
  };
}

export function deletePrototypeMessage(threadId, messageId) {
  const state = readMessagingState();
  const { thread, message } = findThreadAndMessage(state, threadId, messageId);
  if (!thread || !message) return { ok: false, error: 'This message is unavailable.' };
  if (message.senderType !== 'me') return { ok: false, error: 'Only your own messages can be removed.' };

  message.text = '';
  message.attachments = [];
  message.reactions = [];
  message.deletedAt = new Date().toISOString();
  message.syncStatus = message.backendMessageId ? 'pending' : 'synced';
  message.lastError = '';
  const saved = writeMessagingState(state);
  if (message.backendMessageId) {
    queueMessagingSync({ operation: 'delete', threadId, messageId });
  }
  return {
    ok: true,
    state: saved,
    thread: cloneMessagingValue(saved.threads.find((item) => item.id === threadId)),
  };
}

export function markPrototypeThreadRead(threadId) {
  const state = readMessagingState();
  const thread = state.threads.find((item) => item.id === threadId);
  if (!thread) return cloneMessagingValue(state);
  thread.unreadCount = 0;
  const latestRemoteMessage = [...thread.messages]
    .reverse()
    .find((message) => message.backendMessageId);
  const saved = writeMessagingState(state);
  if (thread.backendConversationId && latestRemoteMessage) {
    queueMessagingSync({
      operation: 'read',
      threadId,
      messageId: latestRemoteMessage.id,
    });
  }
  return saved;
}

export function retryPrototypeMessage(threadId, messageId) {
  const state = readMessagingState();
  const { thread, message } = findThreadAndMessage(state, threadId, messageId);
  if (!thread || !message || message.senderType !== 'me' || message.deletedAt) {
    return { ok: false, error: 'This message cannot be retried.' };
  }
  if (!message.text.trim()) {
    return { ok: false, error: 'Secure attachment transfer will be enabled in the file-sync phase.' };
  }
  message.syncStatus = 'pending';
  message.lastError = '';
  const saved = writeMessagingState(state);
  queueMessagingSync({ operation: 'send', threadId, messageId });
  return {
    ok: true,
    state: saved,
    thread: cloneMessagingValue(saved.threads.find((item) => item.id === threadId)),
  };
}

export function getPrototypeUnreadCount() {
  return readMessagingState().threads.reduce((total, thread) => total + thread.unreadCount, 0);
}

installMessagingSyncTriggers();
