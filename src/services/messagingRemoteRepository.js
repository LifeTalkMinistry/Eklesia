import { apiRequest } from './apiClient.js';

export function listRemoteConversations() {
  return apiRequest('/api/ekklesia/messaging/conversations');
}

export function createRemoteDirectConversation(payload) {
  return apiRequest('/api/ekklesia/messaging/conversations/direct', {
    method: 'POST',
    body: payload,
  });
}

export function createRemoteRoomConversation(payload) {
  return apiRequest('/api/ekklesia/messaging/conversations/room', {
    method: 'POST',
    body: payload,
  });
}

export function listRemoteMessages(conversationId, after = '0', limit = 100) {
  const params = new URLSearchParams({ after: String(after), limit: String(limit) });
  return apiRequest(`/api/ekklesia/messaging/conversations/${conversationId}/messages?${params.toString()}`);
}

export function sendRemoteMessage(conversationId, payload) {
  return apiRequest(`/api/ekklesia/messaging/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: payload,
  });
}

export function editRemoteMessage(conversationId, messageId, payload) {
  return apiRequest(`/api/ekklesia/messaging/conversations/${conversationId}/messages/${messageId}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function deleteRemoteMessage(conversationId, messageId, payload) {
  return apiRequest(`/api/ekklesia/messaging/conversations/${conversationId}/messages/${messageId}`, {
    method: 'DELETE',
    body: payload,
  });
}

export function addRemoteReaction(conversationId, messageId, reaction) {
  return apiRequest(`/api/ekklesia/messaging/conversations/${conversationId}/messages/${messageId}/reactions`, {
    method: 'POST',
    body: { reaction },
  });
}

export function removeRemoteReaction(conversationId, messageId, reaction) {
  return apiRequest(`/api/ekklesia/messaging/conversations/${conversationId}/messages/${messageId}/reactions`, {
    method: 'DELETE',
    body: { reaction },
  });
}

export function markRemoteConversationRead(conversationId, messageId = null) {
  return apiRequest(`/api/ekklesia/messaging/conversations/${conversationId}/read`, {
    method: 'POST',
    body: { messageId },
  });
}
