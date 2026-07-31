import { apiRequest } from './apiClient.js';

const COLLECTION_BY_TYPE = Object.freeze({
  announcement: 'announcements',
  acknowledgement: 'acknowledgements',
  event: 'events',
});

export function createEmptyChurchHome() {
  return {
    announcements: [],
    acknowledgements: [],
    events: [],
  };
}

function normalizeHome(home) {
  return {
    announcements: Array.isArray(home?.announcements) ? home.announcements : [],
    acknowledgements: Array.isArray(home?.acknowledgements) ? home.acknowledgements : [],
    events: Array.isArray(home?.events) ? home.events : [],
  };
}

function collectionForType(type) {
  const collection = COLLECTION_BY_TYPE[type];
  if (!collection) throw new Error('That Church Home content type is unavailable.');
  return collection;
}

export async function getChurchHome() {
  const payload = await apiRequest('/api/ekklesia/churches/current/home');
  return {
    home: normalizeHome(payload.home),
    permissions: {
      canManage: Boolean(payload.permissions?.canManage),
      role: String(payload.permissions?.role || 'member'),
    },
    source: payload.source || 'backend',
  };
}

export async function saveChurchHomeItem(type, itemId, values) {
  const collection = collectionForType(type);
  const path = itemId
    ? `/api/ekklesia/churches/current/home/${collection}/${encodeURIComponent(itemId)}`
    : `/api/ekklesia/churches/current/home/${collection}`;
  const payload = await apiRequest(path, {
    method: itemId ? 'PATCH' : 'POST',
    body: values,
  });
  return payload.item;
}

export async function deleteChurchHomeItem(type, itemId) {
  const collection = collectionForType(type);
  return apiRequest(
    `/api/ekklesia/churches/current/home/${collection}/${encodeURIComponent(itemId)}`,
    { method: 'DELETE' },
  );
}
