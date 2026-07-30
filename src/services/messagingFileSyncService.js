import {
  downloadRemoteAttachment,
  listRemoteMessageAttachments,
  uploadBlobResumably,
} from './fileTransferService.js';
import {
  findMessagingAttachmentByServerId,
  getMessagingAttachment,
  importMessagingAttachment,
  updateMessagingAttachment,
} from './messagingAttachmentService.js';
import {
  normalizeMessagingAttachment,
  readMessagingState,
  writeMessagingState,
} from './messagingLocalRepository.js';

function getAttachmentKind(type = '') {
  if (String(type).startsWith('image/')) return 'image';
  if (type === 'application/pdf') return 'pdf';
  return 'file';
}

function findThread(state, threadId) {
  return state.threads.find((thread) => thread.id === threadId);
}

function findMessage(thread, messageId) {
  return thread?.messages.find((message) => message.id === messageId);
}

function findAttachment(message, attachmentId) {
  return message?.attachments.find((attachment) => attachment.id === attachmentId);
}

function updateAttachmentState(state, thread, message, attachment, patch) {
  Object.assign(attachment, normalizeMessagingAttachment({ ...attachment, ...patch }));
  if (patch.transferStatus === 'uploading') {
    message.syncStatus = 'syncing';
    message.lastError = '';
  }
  if (patch.transferStatus === 'failed') {
    message.syncStatus = 'failed';
    message.lastError = patch.lastError || 'An attachment could not be synchronized.';
  }
  if (message.attachments.length && message.attachments.every((item) => item.transferStatus === 'ready')) {
    message.syncStatus = 'synced';
    message.lastError = '';
  }
  thread.updatedAt = message.updatedAt || message.createdAt || thread.updatedAt;
  writeMessagingState(state);
}

async function uploadLocalAttachment(state, thread, message, attachment) {
  if (attachment.serverAttachmentId && attachment.transferStatus === 'ready') return;
  const stored = await getMessagingAttachment(attachment.id);
  if (!stored?.blob) {
    updateAttachmentState(state, thread, message, attachment, {
      transferStatus: 'failed',
      lastError: 'The local attachment file is missing from this device.',
    });
    return;
  }

  updateAttachmentState(state, thread, message, attachment, {
    transferStatus: 'uploading',
    transferProgress: Math.max(1, Number(attachment.transferProgress) || 0),
    lastError: '',
  });
  await updateMessagingAttachment(attachment.id, {
    transferStatus: 'uploading',
    transferProgress: attachment.transferProgress,
    lastError: '',
  });

  try {
    const remote = await uploadBlobResumably({
      blob: stored.blob,
      metadata: {
        purpose: 'message',
        conversationId: thread.backendConversationId,
        messageId: message.backendMessageId || undefined,
        messageClientId: message.clientMessageId,
        messageSentAt: message.createdAt,
        clientAttachmentId: attachment.id,
        fileName: attachment.name,
        mimeType: attachment.type,
        sha256: stored.sha256 || attachment.sha256 || undefined,
      },
      onProgress(progress) {
        updateAttachmentState(state, thread, message, attachment, {
          transferStatus: 'uploading',
          transferProgress: progress,
          lastError: '',
        });
        void updateMessagingAttachment(attachment.id, {
          transferStatus: 'uploading',
          transferProgress: progress,
          lastError: '',
        });
      },
    });

    if (!message.backendMessageId && remote.messageId) {
      message.backendMessageId = String(remote.messageId);
      message.version = Math.max(1, Number(message.version) || 1);
      message.deliveryStatus = 'accepted';
    }
    updateAttachmentState(state, thread, message, attachment, {
      serverAttachmentId: String(remote.id),
      sha256: remote.sha256,
      downloadPath: remote.downloadPath,
      transferStatus: 'ready',
      transferProgress: 100,
      lastError: '',
    });
    await updateMessagingAttachment(attachment.id, {
      serverAttachmentId: String(remote.id),
      sha256: remote.sha256,
      transferStatus: 'ready',
      transferProgress: 100,
      lastError: '',
    });
  } catch (error) {
    const messageText = error.message || 'The attachment could not be uploaded.';
    updateAttachmentState(state, thread, message, attachment, {
      transferStatus: 'failed',
      lastError: messageText,
    });
    await updateMessagingAttachment(attachment.id, {
      transferStatus: 'failed',
      lastError: messageText,
    });
    if (error.isNetworkError || error.code === 'FILE_SERVER_UNREACHABLE') throw error;
  }
}

async function uploadPendingMessageFiles(state) {
  for (const thread of state.threads) {
    if (!thread.backendConversationId) continue;
    for (const message of thread.messages) {
      if (message.senderType !== 'me' || message.deletedAt || !message.attachments.length) continue;
      for (const attachment of message.attachments) {
        if (attachment.transferStatus === 'ready' && attachment.serverAttachmentId) continue;
        await uploadLocalAttachment(state, thread, message, attachment);
      }
    }
  }
}

async function importRemoteAttachment(state, thread, message, remoteAttachment) {
  let attachment = message.attachments.find((item) => (
    (item.serverAttachmentId && item.serverAttachmentId === String(remoteAttachment.id))
    || item.id === remoteAttachment.clientAttachmentId
  ));
  if (!attachment) {
    attachment = normalizeMessagingAttachment({
      id: remoteAttachment.clientAttachmentId || `server-attachment-${remoteAttachment.id}`,
      serverAttachmentId: String(remoteAttachment.id),
      name: remoteAttachment.name,
      type: remoteAttachment.type,
      size: remoteAttachment.size,
      kind: getAttachmentKind(remoteAttachment.type),
      sha256: remoteAttachment.sha256,
      downloadPath: remoteAttachment.downloadPath,
      transferStatus: 'downloading',
      transferProgress: 0,
      createdAt: remoteAttachment.createdAt,
    });
    message.attachments.push(attachment);
  } else {
    Object.assign(attachment, normalizeMessagingAttachment({
      ...attachment,
      serverAttachmentId: String(remoteAttachment.id),
      name: remoteAttachment.name,
      type: remoteAttachment.type,
      size: remoteAttachment.size,
      kind: getAttachmentKind(remoteAttachment.type),
      sha256: remoteAttachment.sha256,
      downloadPath: remoteAttachment.downloadPath,
      transferStatus: attachment.transferStatus === 'ready' ? 'ready' : 'downloading',
      createdAt: remoteAttachment.createdAt,
    }));
  }

  const stored = await getMessagingAttachment(attachment.id)
    || await findMessagingAttachmentByServerId(remoteAttachment.id);
  if (stored?.blob && stored.sha256 === remoteAttachment.sha256) {
    updateAttachmentState(state, thread, message, attachment, {
      serverAttachmentId: String(remoteAttachment.id),
      transferStatus: 'ready',
      transferProgress: 100,
      lastError: '',
    });
    return;
  }

  updateAttachmentState(state, thread, message, attachment, {
    transferStatus: 'downloading',
    transferProgress: 10,
    lastError: '',
  });
  try {
    const blob = await downloadRemoteAttachment(remoteAttachment);
    const imported = await importMessagingAttachment({
      id: attachment.id,
      serverAttachmentId: String(remoteAttachment.id),
      name: remoteAttachment.name,
      type: remoteAttachment.type,
      size: remoteAttachment.size,
      kind: getAttachmentKind(remoteAttachment.type),
      sha256: remoteAttachment.sha256,
      transferStatus: 'ready',
      transferProgress: 100,
      createdAt: remoteAttachment.createdAt,
      blob,
    });
    if (!imported.ok) throw new Error(imported.error || 'The attachment could not be stored locally.');
    updateAttachmentState(state, thread, message, attachment, {
      serverAttachmentId: String(remoteAttachment.id),
      transferStatus: 'ready',
      transferProgress: 100,
      lastError: '',
    });
  } catch (error) {
    updateAttachmentState(state, thread, message, attachment, {
      transferStatus: 'failed',
      lastError: error.message || 'The attachment could not be downloaded.',
    });
  }
}

async function hydrateRemoteMessageFiles(state) {
  for (const thread of state.threads) {
    if (!thread.backendConversationId) continue;
    for (const message of thread.messages) {
      if (!message.backendMessageId || message.deletedAt) continue;
      let response;
      try {
        response = await listRemoteMessageAttachments(
          thread.backendConversationId,
          message.backendMessageId,
        );
      } catch (error) {
        if (error.isNetworkError || error.code === 'API_UNREACHABLE') throw error;
        continue;
      }
      for (const remoteAttachment of response.attachments || []) {
        await importRemoteAttachment(state, thread, message, remoteAttachment);
      }
    }
  }
}

export async function synchronizeMessagingFiles(stateValue = null) {
  const state = stateValue || readMessagingState();
  await uploadPendingMessageFiles(state);
  await hydrateRemoteMessageFiles(state);
  return writeMessagingState(state);
}

export function retryMessagingAttachment(threadId, messageId, attachmentId) {
  const state = readMessagingState();
  const thread = findThread(state, threadId);
  const message = findMessage(thread, messageId);
  const attachment = findAttachment(message, attachmentId);
  if (!thread || !message || !attachment) {
    return { ok: false, error: 'The attachment could not be found.' };
  }
  updateAttachmentState(state, thread, message, attachment, {
    transferStatus: 'queued',
    transferProgress: 0,
    lastError: '',
  });
  return { ok: true, state: writeMessagingState(state) };
}
