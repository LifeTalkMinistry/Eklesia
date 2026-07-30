import { apiRequest } from '../apiClient.js';

export function bootstrapRemoteSync(device) {
  return apiRequest('/api/ekklesia/sync/bootstrap', {
    method: 'POST',
    body: { device },
  });
}

export function pushRemoteChanges({ device, batchId, changes }) {
  return apiRequest('/api/ekklesia/sync/push', {
    method: 'POST',
    body: { device, batchId, changes },
  });
}

export function pullRemoteChanges(cursor = '0', limit = 100) {
  const params = new URLSearchParams({ cursor: String(cursor), limit: String(limit) });
  return apiRequest(`/api/ekklesia/sync/pull?${params.toString()}`);
}
