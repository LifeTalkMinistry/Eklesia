import {
  apiRequest,
  getAccessToken,
  getApiBaseUrl,
} from './apiClient.js';

export const FILE_TRANSFER_CHUNK_SIZE = 512 * 1024;

function createTransferError(message, code, details) {
  const error = new Error(message);
  error.code = code;
  if (details) error.details = details;
  return error;
}

function bytesToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256Blob(blob) {
  if (!(blob instanceof Blob)) throw createTransferError('A file blob is required.', 'INVALID_FILE_BLOB');
  if (!globalThis.crypto?.subtle) {
    throw createTransferError('This browser cannot verify secure file checksums.', 'WEB_CRYPTO_UNAVAILABLE');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return bytesToHex(digest);
}

async function parseErrorResponse(response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const error = createTransferError(
    payload?.error || payload?.message || `File transfer failed with status ${response.status}.`,
    payload?.code || `FILE_HTTP_${response.status}`,
    payload?.details,
  );
  error.status = response.status;
  return error;
}

async function authenticatedBinaryRequest(path, options = {}) {
  const token = getAccessToken();
  if (!token) throw createTransferError('Sign in before transferring files.', 'FILE_AUTH_REQUIRED');
  const controller = new AbortController();
  const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 30_000);
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Ngrok-Skip-Browser-Warning': 'true',
        ...(options.headers || {}),
      },
      body: options.body,
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw await parseErrorResponse(response);
    return response;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw createTransferError('The file transfer timed out.', 'FILE_TRANSFER_TIMEOUT');
    }
    if (error?.status) throw error;
    const networkError = createTransferError(
      'The file server could not be reached. Your file remains saved on this device.',
      'FILE_SERVER_UNREACHABLE',
    );
    networkError.isNetworkError = true;
    networkError.cause = error;
    throw networkError;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export function initiateRemoteFileUpload(metadata) {
  return apiRequest('/api/ekklesia/files/uploads', {
    method: 'POST',
    body: {
      ...metadata,
      chunkSize: metadata.chunkSize || FILE_TRANSFER_CHUNK_SIZE,
    },
    timeoutMs: 20_000,
  });
}

export function getRemoteUploadStatus(uploadId) {
  return apiRequest(`/api/ekklesia/files/uploads/${encodeURIComponent(uploadId)}`, {
    timeoutMs: 15_000,
  });
}

export async function uploadRemoteFileChunk(uploadId, chunkIndex, chunk) {
  const checksum = await sha256Blob(chunk);
  const response = await authenticatedBinaryRequest(
    `/api/ekklesia/files/uploads/${encodeURIComponent(uploadId)}/chunks/${chunkIndex}`,
    {
      method: 'PUT',
      body: chunk,
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Chunk-Sha256': checksum,
      },
      timeoutMs: 45_000,
    },
  );
  return response.json();
}

export function completeRemoteFileUpload(uploadId) {
  return apiRequest(`/api/ekklesia/files/uploads/${encodeURIComponent(uploadId)}/complete`, {
    method: 'POST',
    body: {},
    timeoutMs: 45_000,
  });
}

export function listRemoteMessageAttachments(conversationId, messageId) {
  return apiRequest(`/api/ekklesia/files/messages/${conversationId}/${messageId}`, {
    timeoutMs: 15_000,
  });
}

export function listRemoteNotebookAttachments(devotionClientRecordId) {
  return apiRequest(`/api/ekklesia/files/notebook/${encodeURIComponent(devotionClientRecordId)}`, {
    timeoutMs: 15_000,
  });
}

export function deleteRemoteAttachment(attachmentId) {
  return apiRequest(`/api/ekklesia/files/${attachmentId}`, {
    method: 'DELETE',
    body: {},
    timeoutMs: 15_000,
  });
}

export async function downloadRemoteAttachment(attachment) {
  const path = attachment?.downloadPath || `/api/ekklesia/files/${attachment?.id}/content`;
  const response = await authenticatedBinaryRequest(path, { timeoutMs: 45_000 });
  const blob = await response.blob();
  if (Number(attachment?.size) !== blob.size) {
    throw createTransferError('The downloaded file size did not match the server metadata.', 'DOWNLOADED_FILE_SIZE_MISMATCH');
  }
  const checksum = await sha256Blob(blob);
  if (checksum !== String(attachment?.sha256 || '').toLowerCase()) {
    throw createTransferError('The downloaded file checksum did not match.', 'DOWNLOADED_FILE_CHECKSUM_MISMATCH');
  }
  return blob;
}

export async function uploadBlobResumably({ blob, metadata, onProgress }) {
  if (!(blob instanceof Blob)) throw createTransferError('The local file is unavailable.', 'LOCAL_FILE_MISSING');
  const checksum = metadata.sha256 || await sha256Blob(blob);
  const initiated = await initiateRemoteFileUpload({
    ...metadata,
    byteSize: blob.size,
    mimeType: metadata.mimeType || blob.type,
    sha256: checksum,
  });

  if (initiated.attachment?.status === 'ready') {
    onProgress?.(100, initiated.attachment);
    return initiated.attachment;
  }

  let upload = initiated.upload;
  if (!upload?.uploadId) {
    throw createTransferError('The server did not return an upload session.', 'UPLOAD_SESSION_MISSING');
  }
  if (upload.status !== 'active') {
    const status = await getRemoteUploadStatus(upload.uploadId);
    upload = status.upload;
  }

  const missing = Array.isArray(upload.missingChunks)
    ? upload.missingChunks
    : Array.from({ length: upload.totalChunks }, (_, index) => index);
  const completedBefore = Math.max(0, Number(upload.totalChunks) - missing.length);
  onProgress?.(Math.round((completedBefore / Math.max(1, upload.totalChunks)) * 95), upload.attachment);

  for (let position = 0; position < missing.length; position += 1) {
    const chunkIndex = Number(missing[position]);
    const start = chunkIndex * Number(upload.chunkSize);
    const end = Math.min(blob.size, start + Number(upload.chunkSize));
    const chunk = blob.slice(start, end, blob.type || 'application/octet-stream');
    await uploadRemoteFileChunk(upload.uploadId, chunkIndex, chunk);
    const completed = completedBefore + position + 1;
    onProgress?.(Math.min(95, Math.round((completed / Math.max(1, upload.totalChunks)) * 95)), upload.attachment);
  }

  const completed = await completeRemoteFileUpload(upload.uploadId);
  onProgress?.(100, completed.attachment);
  return completed.attachment;
}
