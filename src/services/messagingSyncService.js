import { getBackendAccountId, hasBackendSession } from './backendSessionService.js';
import {
  addRemoteReaction,
  createRemoteDirectConversation,
  createRemoteRoomConversation,
  deleteRemoteMessage,
  editRemoteMessage,
  listRemoteConversations,
  listRemoteMessages,
  markRemoteConversationRead,
  removeRemoteReaction,
  sendRemoteMessage,
} from './messagingRemoteRepository.js';
import {
  enqueueMessagingOperation,
  failMessagingOperation,
  normalizeMessagingMessage,
  normalizeMessagingThread,
  readMessagingOutbox,
  readMessagingState,
  removeMessagingOperation,
  writeMessagingState,
} from './messagingLocalRepository.js';
import { getBrowserStorage, STORAGE_KEYS } from './storageRegistry.js';

let activeSyncPromise = null;
let triggersInstalled = false;

function isNetworkError(error) {
  return Boolean(error?.isNetworkError || error?.code === 'API_UNREACHABLE' || error?.code === 'API_TIMEOUT');
}

function writeSyncStatus(status, error = '') {
  const storage = getBrowserStorage();
  if (!storage) return;
  storage.setItem(STORAGE_KEYS.messagingSyncState, JSON.stringify({
    status,
    lastError: String(error?.message || error || ''),
    updatedAt: new Date().toISOString(),
  }));
}

function findThread(state, threadId) {
  return state.threads.find((thread) => thread.id === threadId);
}

function findMessage(thread, messageId) {
  return thread?.messages.find((message) => message.id === messageId);
}

function remoteConversationMatch(thread, conversation) {
  if (thread.backendConversationId && thread.backendConversationId === String(conversation.id)) return true;
  if (thread.clientConversationId && thread.clientConversationId === conversation.clientConversationId) return true;
  if (thread.type === 'direct' && conversation.type === 'direct') {
    return String(thread.callTargetId || '') === String(conversation.targetUserId || '');
  }
  return thread.type === 'room'
    && conversation.type !== 'direct'
    && thread.roomType === conversation.type
    && thread.roomKey === conversation.roomKey;
}

function applyRemoteConversation(state, conversation) {
  let thread = state.threads.find((item) => remoteConversationMatch(item, conversation));
  const isDirect = conversation.type === 'direct';
  if (!thread) {
    const targetId = isDirect
      ? `backend-member-${conversation.targetUserId || conversation.id}`
      : conversation.roomKey || `remote-room-${conversation.id}`;
    thread = normalizeMessagingThread({
      id: `${isDirect ? 'direct' : 'room'}:${targetId}`,
      type: isDirect ? 'direct' : 'room',
      targetId,
      callTargetId: isDirect ? String(conversation.targetUserId || '') : '',
      roomType: isDirect ? '' : conversation.type,
      roomKey: isDirect ? '' : String(conversation.roomKey || targetId),
      participantUserIds: (conversation.participants || []).map((participant) => String(participant.userId)),
      title: conversation.title,
      subtitle: isDirect ? 'Private conversation' : 'Church room',
      clientConversationId: conversation.clientConversationId,
      backendConversationId: String(conversation.id),
      unreadCount: conversation.unreadCount,
      updatedAt: conversation.updatedAt,
      syncStatus: 'synced',
      messages: [],
    });
    state.threads.push(thread);
  } else {
    thread.clientConversationId = conversation.clientConversationId || thread.clientConversationId;
    thread.backendConversationId = String(conversation.id);
    thread.callTargetId = isDirect ? String(conversation.targetUserId || thread.callTargetId || '') : '';
    thread.roomType = isDirect ? '' : conversation.type;
    thread.roomKey = isDirect ? '' : String(conversation.roomKey || thread.roomKey || '');
    thread.participantUserIds = isDirect
      ? []
      : (conversation.participants || []).map((participant) => String(participant.userId));
    thread.title = conversation.title || thread.title;
    thread.unreadCount = Math.max(0, Number(conversation.unreadCount) || 0);
    thread.updatedAt = conversation.updatedAt || thread.updatedAt;
    thread.lastSyncedAt = new Date().toISOString();
    thread.syncStatus = 'synced';
    thread.lastError = '';
  }
  return thread;
}

function aggregateRemoteReactions(reactions = []) {
  const grouped = new Map();
  reactions.forEach((reaction) => {
    const emoji = String(reaction.reaction || '');
    if (!emoji) return;
    const current = grouped.get(emoji) || { emoji, count: 0, reactedByMe: false };
    current.count += 1;
    current.reactedByMe = current.reactedByMe || Boolean(reaction.mine);
    grouped.set(emoji, current);
  });
  return [...grouped.values()];
}

function applyRemoteMessage(thread, remoteMessage) {
  let message = thread.messages.find((item) => (
    (item.backendMessageId && item.backendMessageId === String(remoteMessage.id))
    || (item.clientMessageId && item.clientMessageId === remoteMessage.clientMessageId)
  ));
  const existingAttachments = message?.attachments || [];
  const localId = message?.id || `remote-message-${remoteMessage.id}`;
  const replyLocal = remoteMessage.replyToMessageId
    ? thread.messages.find((item) => item.backendMessageId === String(remoteMessage.replyToMessageId))
    : null;
  const normalized = normalizeMessagingMessage({
    ...message,
    id: localId,
    clientMessageId: remoteMessage.clientMessageId,
    backendMessageId: String(remoteMessage.id),
    senderType: remoteMessage.mine ? 'me' : 'other',
    senderName: remoteMessage.senderName,
    text: remoteMessage.body,
    attachments: existingAttachments,
    reactions: aggregateRemoteReactions(remoteMessage.reactions),
    replyTo: remoteMessage.replyToMessageId ? {
      id: replyLocal?.id || `remote-message-${remoteMessage.replyToMessageId}`,
      backendMessageId: String(remoteMessage.replyToMessageId),
      senderName: remoteMessage.replyPreview?.senderUserId === getBackendAccountId() ? 'You' : '',
      text: remoteMessage.replyPreview?.body || '',
    } : null,
    deletedAt: remoteMessage.deletedAt,
    createdAt: remoteMessage.sentAt,
    editedAt: remoteMessage.editedAt,
    version: Number(remoteMessage.version) || 1,
    deliveryStatus: remoteMessage.deliveryStatus,
    readBy: remoteMessage.readBy || [],
    syncStatus: 'synced',
    lastError: '',
  });
  if (message) Object.assign(message, normalized);
  else {
    thread.messages.push(normalized);
    message = normalized;
  }
  thread.messages.sort((first, second) => new Date(first.createdAt) - new Date(second.createdAt));
  thread.updatedAt = remoteMessage.updatedAt || remoteMessage.sentAt || thread.updatedAt;
  return message;
}

function canSyncThread(thread) {
  if (thread.type === 'direct') return /^\d+$/.test(String(thread.callTargetId || ''));
  return Boolean(
    ['ministry', 'dgroup'].includes(thread.roomType)
    && thread.roomKey
    && thread.participantUserIds.length
    && thread.participantUserIds.every((id) => /^\d+$/.test(String(id)))
  );
}

async function ensureRemoteThread(state, thread) {
  if (thread.backendConversationId) return thread;
  if (!canSyncThread(thread)) {
    thread.syncStatus = 'local-only';
    thread.lastError = thread.type === 'direct'
      ? 'This contact does not have a connected Ekklesia account yet.'
      : 'This room needs connected member IDs before it can synchronize.';
    return thread;
  }
  thread.syncStatus = 'syncing';
  writeMessagingState(state);
  const result = thread.type === 'direct'
    ? await createRemoteDirectConversation({
      clientConversationId: thread.clientConversationId,
      participantUserId: thread.callTargetId,
    })
    : await createRemoteRoomConversation({
      clientConversationId: thread.clientConversationId,
      type: thread.roomType,
      roomKey: thread.roomKey,
      title: thread.title,
      participantUserIds: thread.participantUserIds,
    });
  const merged = applyRemoteConversation(state, result.conversation);
  merged.syncStatus = 'synced';
  merged.lastSyncedAt = new Date().toISOString();
  writeMessagingState(state);
  return merged;
}

function operationPriority(operation) {
  return ({
    'ensure-thread': 0,
    send: 1,
    edit: 2,
    delete: 2,
    'reaction-add': 2,
    'reaction-remove': 2,
    read: 3,
  })[operation] ?? 9;
}

async function processOperation(state, operation) {
  let thread = findThread(state, operation.threadId);
  if (!thread) return { remove: true };
  thread = await ensureRemoteThread(state, thread);
  if (!thread.backendConversationId) return { remove: true };

  if (operation.operation === 'ensure-thread') return { remove: true };

  const message = operation.messageId ? findMessage(thread, operation.messageId) : null;
  if (operation.operation === 'send') {
    if (!message || message.senderType !== 'me' || message.deletedAt) return { remove: true };
    if (!message.text.trim()) {
      message.syncStatus = 'local-only';
      message.lastError = 'Secure attachment transfer will be enabled in the file-sync phase.';
      writeMessagingState(state);
      return { remove: true };
    }
    message.syncStatus = 'syncing';
    message.lastError = '';
    writeMessagingState(state);
    const replyMessage = message.replyTo
      ? findMessage(thread, message.replyTo.id)
      : null;
    const result = await sendRemoteMessage(thread.backendConversationId, {
      clientMessageId: message.clientMessageId,
      body: message.text,
      replyToMessageId: replyMessage?.backendMessageId || message.replyTo?.backendMessageId || null,
      sentAt: message.createdAt,
    });
    applyRemoteMessage(thread, result.message);
    writeMessagingState(state);
    return { remove: true };
  }

  if (operation.operation === 'read') {
    const lastMessage = message?.backendMessageId
      ? message
      : [...thread.messages].reverse().find((item) => item.backendMessageId);
    await markRemoteConversationRead(
      thread.backendConversationId,
      lastMessage?.backendMessageId || null
    );
    return { remove: true };
  }

  if (!message?.backendMessageId) {
    return { remove: operation.operation === 'delete' };
  }

  if (operation.operation === 'edit') {
    if (message.deletedAt || !message.text.trim()) return { remove: true };
    message.syncStatus = 'syncing';
    message.lastError = '';
    writeMessagingState(state);
    const result = await editRemoteMessage(
      thread.backendConversationId,
      message.backendMessageId,
      { body: message.text, baseVersion: message.version }
    );
    applyRemoteMessage(thread, result.message);
    writeMessagingState(state);
    return { remove: true };
  }

  if (operation.operation === 'delete') {
    const result = await deleteRemoteMessage(
      thread.backendConversationId,
      message.backendMessageId,
      { baseVersion: message.version }
    );
    applyRemoteMessage(thread, result.message);
    writeMessagingState(state);
    return { remove: true };
  }

  if (operation.operation === 'reaction-add') {
    await addRemoteReaction(thread.backendConversationId, message.backendMessageId, operation.emoji);
    return { remove: true };
  }

  if (operation.operation === 'reaction-remove') {
    await removeRemoteReaction(thread.backendConversationId, message.backendMessageId, operation.emoji);
    return { remove: true };
  }

  return { remove: true };
}

async function flushMessagingOutbox() {
  const state = readMessagingState();
  const operations = readMessagingOutbox()
    .sort((first, second) => operationPriority(first.operation) - operationPriority(second.operation)
      || String(first.createdAt).localeCompare(String(second.createdAt)));

  for (const operation of operations) {
    try {
      const result = await processOperation(state, operation);
      if (result.remove) removeMessagingOperation(operation.id);
    } catch (error) {
      failMessagingOperation(operation.id, error);
      const thread = findThread(state, operation.threadId);
      const message = operation.messageId ? findMessage(thread, operation.messageId) : null;
      if (message) {
        message.syncStatus = 'failed';
        message.lastError = error.message || 'Message sync failed.';
      } else if (thread) {
        thread.syncStatus = 'failed';
        thread.lastError = error.message || 'Conversation sync failed.';
      }
      writeMessagingState(state);
      if (isNetworkError(error)) throw error;
    }
  }
}

async function hydrateRemoteMessages(state, thread) {
  if (!thread.backendConversationId) return;
  let after = '0';
  let hasMore = true;
  while (hasMore) {
    const result = await listRemoteMessages(thread.backendConversationId, after, 100);
    (result.messages || []).forEach((message) => applyRemoteMessage(thread, message));
    after = String(result.cursor || after);
    hasMore = Boolean(result.hasMore);
  }
}

async function hydrateRemoteState() {
  const state = readMessagingState();
  const result = await listRemoteConversations();
  const remoteThreads = [];
  for (const conversation of result.conversations || []) {
    const thread = applyRemoteConversation(state, conversation);
    remoteThreads.push(thread);
    await hydrateRemoteMessages(state, thread);
  }
  const now = new Date().toISOString();
  remoteThreads.forEach((thread) => {
    thread.lastSyncedAt = now;
    thread.syncStatus = 'synced';
    thread.lastError = '';
  });
  return writeMessagingState(state);
}

async function executeMessagingSync() {
  if (!hasBackendSession() || !getBackendAccountId()) {
    return { ok: false, reason: 'not-connected' };
  }
  writeSyncStatus('syncing');
  try {
    await flushMessagingOutbox();
    const state = await hydrateRemoteState();
    await flushMessagingOutbox();
    writeSyncStatus('synced');
    return { ok: true, state };
  } catch (error) {
    writeSyncStatus(isNetworkError(error) ? 'offline' : 'attention', error);
    return { ok: false, error };
  }
}

export function synchronizeMessaging() {
  if (activeSyncPromise) return activeSyncPromise;
  activeSyncPromise = executeMessagingSync().finally(() => {
    activeSyncPromise = null;
  });
  return activeSyncPromise;
}

export function queueMessagingSync(operation) {
  const record = enqueueMessagingOperation(operation);
  void synchronizeMessaging();
  return record;
}

export function installMessagingSyncTriggers() {
  if (triggersInstalled || typeof window === 'undefined') return;
  triggersInstalled = true;
  window.addEventListener('online', () => { void synchronizeMessaging(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void synchronizeMessaging();
  });
}
