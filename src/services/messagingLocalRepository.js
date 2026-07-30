import { getBrowserStorage, STORAGE_KEYS } from './storageRegistry.js';

const MESSAGING_VERSION = 3;
const MAX_OUTBOX_RECORDS = 1000;

export const MESSAGING_UPDATED_EVENT = 'ekklesia-pulse:messaging-updated';
export const MESSAGE_REACTION_OPTIONS = ['👍', '❤️', '🙏', '😂', '😮', '😢'];

export function cloneMessagingValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function createMessagingClientId(prefix = 'record') {
  const random = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${random}`;
}

function createEmptyState() {
  return { version: MESSAGING_VERSION, threads: [] };
}

export function normalizeMessagingAttachment(attachment, index = 0) {
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
  const emoji = String(reaction?.emoji || reaction?.reaction || '');
  return {
    emoji,
    count: Math.max(0, Number(reaction?.count) || 0),
    reactedByMe: Boolean(reaction?.reactedByMe || reaction?.mine),
  };
}

function normalizeReply(reply) {
  if (!reply?.id) return null;
  return {
    id: String(reply.id),
    backendMessageId: reply.backendMessageId ? String(reply.backendMessageId) : '',
    senderName: String(reply.senderName || ''),
    text: String(reply.text || ''),
  };
}

export function normalizeMessagingMessage(message, index = 0) {
  const id = String(message?.id || `message-${index}`);
  return {
    id,
    clientMessageId: String(message?.clientMessageId || (id.startsWith('message-') ? id : createMessagingClientId('message'))),
    backendMessageId: message?.backendMessageId ? String(message.backendMessageId) : '',
    senderType: ['me', 'other', 'system'].includes(message?.senderType) ? message.senderType : 'system',
    senderName: String(message?.senderName || ''),
    text: String(message?.text || ''),
    attachments: (Array.isArray(message?.attachments) ? message.attachments : []).map(normalizeMessagingAttachment),
    reactions: (Array.isArray(message?.reactions) ? message.reactions : [])
      .map(normalizeReaction)
      .filter((reaction) => reaction.emoji && reaction.count > 0),
    replyTo: normalizeReply(message?.replyTo),
    deletedAt: message?.deletedAt ? String(message.deletedAt) : null,
    createdAt: String(message?.createdAt || new Date().toISOString()),
    editedAt: message?.editedAt ? String(message.editedAt) : null,
    version: Math.max(1, Number(message?.version) || 1),
    deliveryStatus: ['accepted', 'delivered'].includes(message?.deliveryStatus)
      ? message.deliveryStatus
      : message?.senderType === 'me' ? 'accepted' : 'delivered',
    readBy: Array.isArray(message?.readBy) ? message.readBy.map((receipt) => ({
      userId: String(receipt?.userId || ''),
      readAt: String(receipt?.readAt || ''),
    })).filter((receipt) => receipt.userId) : [],
    syncStatus: ['pending', 'syncing', 'synced', 'failed', 'local-only'].includes(message?.syncStatus)
      ? message.syncStatus
      : message?.backendMessageId ? 'synced' : message?.senderType === 'me' ? 'pending' : 'synced',
    lastError: String(message?.lastError || ''),
  };
}

export function normalizeMessagingThread(thread, index = 0) {
  const type = thread?.type === 'room' ? 'room' : 'direct';
  const id = String(thread?.id || `${type}:thread-${index}`);
  return {
    id,
    clientConversationId: String(thread?.clientConversationId || createMessagingClientId('conversation')),
    backendConversationId: thread?.backendConversationId ? String(thread.backendConversationId) : '',
    type,
    targetId: String(thread?.targetId || ''),
    callTargetId: type === 'direct' ? String(thread?.callTargetId || '') : '',
    roomType: type === 'room' && ['ministry', 'dgroup'].includes(thread?.roomType)
      ? thread.roomType
      : type === 'room' ? 'ministry' : '',
    roomKey: type === 'room' ? String(thread?.roomKey || thread?.targetId || '') : '',
    participantUserIds: type === 'room'
      ? [...new Set((Array.isArray(thread?.participantUserIds) ? thread.participantUserIds : []).map(String).filter(Boolean))]
      : [],
    title: String(thread?.title || (type === 'room' ? 'Room chat' : 'Conversation')),
    subtitle: String(thread?.subtitle || ''),
    unreadCount: Math.max(0, Number(thread?.unreadCount) || 0),
    updatedAt: String(thread?.updatedAt || new Date(0).toISOString()),
    lastSyncedAt: thread?.lastSyncedAt ? String(thread.lastSyncedAt) : null,
    syncStatus: ['pending', 'syncing', 'synced', 'failed', 'local-only'].includes(thread?.syncStatus)
      ? thread.syncStatus
      : thread?.backendConversationId ? 'synced' : 'pending',
    lastError: String(thread?.lastError || ''),
    messages: (Array.isArray(thread?.messages) ? thread.messages : []).map(normalizeMessagingMessage),
  };
}

function normalizeState(value) {
  return {
    version: MESSAGING_VERSION,
    threads: (Array.isArray(value?.threads) ? value.threads : []).map(normalizeMessagingThread),
  };
}

export function readMessagingState() {
  const storage = getBrowserStorage();
  if (!storage) return createEmptyState();
  try {
    const raw = storage.getItem(STORAGE_KEYS.messagingPrototype);
    return raw ? normalizeState(JSON.parse(raw)) : createEmptyState();
  } catch (error) {
    console.warn('Ekklesia Pulse could not restore messages.', error);
    return createEmptyState();
  }
}

export function writeMessagingState(state) {
  const normalized = normalizeState(state);
  const storage = getBrowserStorage();
  if (storage) {
    try {
      storage.setItem(STORAGE_KEYS.messagingPrototype, JSON.stringify(normalized));
    } catch (error) {
      console.warn('Ekklesia Pulse could not save messages.', error);
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MESSAGING_UPDATED_EVENT, {
      detail: { state: cloneMessagingValue(normalized) },
    }));
  }
  return cloneMessagingValue(normalized);
}

function normalizeOutboxRecord(record) {
  return {
    id: String(record?.id || createMessagingClientId('message-operation')),
    operation: String(record?.operation || ''),
    threadId: String(record?.threadId || ''),
    messageId: String(record?.messageId || ''),
    emoji: String(record?.emoji || ''),
    createdAt: String(record?.createdAt || new Date().toISOString()),
    updatedAt: new Date().toISOString(),
    attempts: Math.max(0, Number(record?.attempts) || 0),
    lastError: String(record?.lastError || ''),
  };
}

export function readMessagingOutbox() {
  const storage = getBrowserStorage();
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEYS.messagingOutbox) || '[]');
    return Array.isArray(parsed) ? parsed.map(normalizeOutboxRecord).filter((record) => record.operation && record.threadId) : [];
  } catch {
    return [];
  }
}

export function writeMessagingOutbox(records) {
  const storage = getBrowserStorage();
  const normalized = (Array.isArray(records) ? records : [])
    .map(normalizeOutboxRecord)
    .slice(-MAX_OUTBOX_RECORDS);
  if (storage) storage.setItem(STORAGE_KEYS.messagingOutbox, JSON.stringify(normalized));
  return normalized;
}

export function enqueueMessagingOperation(operation) {
  const record = normalizeOutboxRecord(operation);
  const records = readMessagingOutbox();
  const duplicateIndex = records.findIndex((item) => (
    item.operation === record.operation
    && item.threadId === record.threadId
    && item.messageId === record.messageId
    && item.emoji === record.emoji
  ));
  if (duplicateIndex >= 0) {
    record.id = records[duplicateIndex].id;
    record.createdAt = records[duplicateIndex].createdAt;
    record.attempts = records[duplicateIndex].attempts;
    records[duplicateIndex] = record;
  } else {
    records.push(record);
  }
  writeMessagingOutbox(records);
  return record;
}

export function removeMessagingOperation(operationId) {
  const records = readMessagingOutbox();
  const remaining = records.filter((record) => record.id !== operationId);
  writeMessagingOutbox(remaining);
  return records.length !== remaining.length;
}

export function failMessagingOperation(operationId, error) {
  const message = String(error?.message || error || 'Messaging sync failed.').slice(0, 300);
  const records = readMessagingOutbox().map((record) => (
    record.id === operationId
      ? { ...record, attempts: record.attempts + 1, lastError: message, updatedAt: new Date().toISOString() }
      : record
  ));
  writeMessagingOutbox(records);
}
