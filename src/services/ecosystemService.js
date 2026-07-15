import { mockEcosystems } from '../data/mockEcosystems.js';

// Replace this local prototype adapter with a real API client when Ekklesia Pulse adds
// accounts, memberships, rotating codes, plan limits, permissions, and synchronization.
const JOINED_ECOSYSTEM_STORAGE_KEY = 'ekklesiaPulse.joinedEcosystemId';
const VALIDATION_DELAY_MS = 550;
const JOIN_DELAY_MS = 650;
const LEAVE_DELAY_MS = 250;

function wait(milliseconds) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

function copyEcosystem(ecosystem) {
  return ecosystem ? JSON.parse(JSON.stringify(ecosystem)) : null;
}

function resultError(code, message) {
  return { ok: false, error: { code, message } };
}

export function normalizeEcosystemCode(code) {
  return String(code ?? '').trim().toUpperCase();
}

export async function findEcosystemByCode(code) {
  await wait(VALIDATION_DELAY_MS);

  try {
    const normalizedCode = normalizeEcosystemCode(code);
    if (!normalizedCode) {
      return resultError('EMPTY_CODE', 'Enter a church organization code to continue.');
    }

    const ecosystem = mockEcosystems.find(
      (item) => normalizeEcosystemCode(item.code) === normalizedCode,
    );

    if (!ecosystem) {
      return resultError(
        'INVALID_CODE',
        'We could not find a church organization using that code.',
      );
    }

    if (ecosystem.memberCount >= ecosystem.memberLimit) {
      return resultError(
        'MEMBER_LIMIT_REACHED',
        'This church organization has reached its member limit.',
      );
    }

    return { ok: true, data: copyEcosystem(ecosystem) };
  } catch (error) {
    console.error('Organization code validation failed', error);
    return resultError(
      'GENERAL_ERROR',
      'Something went wrong while checking this church organization.',
    );
  }
}

export async function getJoinedEcosystem() {
  try {
    const joinedEcosystemId = window.localStorage.getItem(JOINED_ECOSYSTEM_STORAGE_KEY);
    if (!joinedEcosystemId) return { ok: true, data: null };

    const ecosystem = mockEcosystems.find((item) => item.id === joinedEcosystemId);
    if (!ecosystem) {
      window.localStorage.removeItem(JOINED_ECOSYSTEM_STORAGE_KEY);
      return { ok: true, data: null };
    }

    return { ok: true, data: copyEcosystem(ecosystem) };
  } catch (error) {
    console.error('Joined organization could not be restored', error);
    return resultError(
      'GENERAL_ERROR',
      'Something went wrong while checking this church organization.',
    );
  }
}

export async function joinEcosystem(ecosystemId) {
  await wait(JOIN_DELAY_MS);

  try {
    const ecosystem = mockEcosystems.find((item) => item.id === ecosystemId);
    if (!ecosystem) {
      return resultError('INVALID_ECOSYSTEM', 'This church organization is unavailable.');
    }

    if (ecosystem.memberCount >= ecosystem.memberLimit) {
      return resultError(
        'MEMBER_LIMIT_REACHED',
        'This church organization has reached its member limit.',
      );
    }

    window.localStorage.setItem(JOINED_ECOSYSTEM_STORAGE_KEY, ecosystem.id);
    return { ok: true, data: copyEcosystem(ecosystem) };
  } catch (error) {
    console.error('Organization join failed', error);
    return resultError(
      'GENERAL_ERROR',
      'Something went wrong while checking this church organization.',
    );
  }
}

export async function leaveEcosystem() {
  await wait(LEAVE_DELAY_MS);

  try {
    window.localStorage.removeItem(JOINED_ECOSYSTEM_STORAGE_KEY);
    return { ok: true, data: null };
  } catch (error) {
    console.error('Organization leave failed', error);
    return resultError(
      'GENERAL_ERROR',
      'The church organization could not be removed from this device.',
    );
  }
}

export async function getEcosystemMembers(ecosystemId) {
  try {
    const ecosystem = mockEcosystems.find((item) => item.id === ecosystemId);
    if (!ecosystem) {
      return resultError('INVALID_ECOSYSTEM', 'This church organization is unavailable.');
    }

    return { ok: true, data: JSON.parse(JSON.stringify(ecosystem.members)) };
  } catch (error) {
    console.error('Organization members could not be loaded', error);
    return resultError('GENERAL_ERROR', 'Organization members could not be loaded.');
  }
}

export { JOINED_ECOSYSTEM_STORAGE_KEY };
