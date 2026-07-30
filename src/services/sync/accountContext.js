let activeAccountId = '';

export const ACTIVE_ACCOUNT_CHANGED_EVENT = 'ekklesia-pulse:active-account-changed';

function normalizeAccountId(value) {
  const normalized = String(value ?? '').trim();
  return /^[1-9]\d*$/.test(normalized) ? normalized : '';
}

function dispatchAccountChanged(accountId) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ACTIVE_ACCOUNT_CHANGED_EVENT, {
    detail: { accountId: accountId || null },
  }));
}

export function setActiveAccountId(value) {
  const normalized = normalizeAccountId(value);
  if (!normalized) throw new Error('A valid backend account ID is required.');
  if (activeAccountId === normalized) return normalized;
  activeAccountId = normalized;
  dispatchAccountChanged(activeAccountId);
  return activeAccountId;
}

export function clearActiveAccountId() {
  if (!activeAccountId) return;
  activeAccountId = '';
  dispatchAccountChanged('');
}

export function getActiveAccountId() {
  return activeAccountId;
}

export function requireActiveAccountId() {
  const accountId = getActiveAccountId();
  if (!accountId) throw new Error('Sign in before accessing account-owned Ekklesia data.');
  return accountId;
}
