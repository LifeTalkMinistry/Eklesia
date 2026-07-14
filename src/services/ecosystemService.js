import { mockEcosystems } from '../data/mockEcosystems.js';
import { getLocalProfile } from './profileService.js';

// Replace this local prototype adapter with a real API client when Ekklesia Pulse adds
// accounts, memberships, rotating codes, plan limits, permissions, and synchronization.
const JOINED_ECOSYSTEM_STORAGE_KEY = 'ekklesiaPulse.joinedEcosystemId';
const VALIDATION_DELAY_MS = 550;
const JOIN_DELAY_MS = 650;
const LEAVE_DELAY_MS = 250;

function wait(milliseconds) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

function getDeclaredOwnerName() {
  const result = getLocalProfile();
  return result.ok && result.data?.displayName
    ? result.data.displayName
    : 'Ekklesia Pulse member';
}

function copyEcosystem(ecosystem) {
  if (!ecosystem) return null;
  return {
    ...JSON.parse(JSON.stringify(ecosystem)),
    ownerName: getDeclaredOwnerName(),
  };
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
      return resultError('EMPTY_CODE', 'Enter an ecosystem code to continue.');
    }

    const ecosystem = mockEcosystems.find(
      (item) => normalizeEcosystemCode(item.code) === normalizedCode,
    );

    if (!ecosystem) {
      return resultError(
        'INVALID_CODE',
        'We could not find an accountability circle using that code.',
      );
    }

    if (ecosystem.memberCount >= ecosystem.memberLimit) {
      return resultError(
        'MEMBER_LIMIT_REACHED',
        'This accountability circle has reached its member limit.',
      );
    }

    return { ok: true, data: copyEcosystem(ecosystem) };
  } catch (error) {
    console.error('Ecosystem code validation failed', error);
    return resultError(
      'GENERAL_ERROR',
      'Something went wrong while checking this ecosystem.',
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
    console.error('Joined ecosystem could not be restored', error);
    return resultError(
      'GENERAL_ERROR',
      'Something went wrong while checking this ecosystem.',
    );
  }
}

export async function joinEcosystem(ecosystemId) {
  await wait(JOIN_DELAY_MS);

  try {
    const ecosystem = mockEcosystems.find((item) => item.id === ecosystemId);
    if (!ecosystem) {
      return resultError('INVALID_ECOSYSTEM', 'This accountability circle is unavailable.');
    }

    if (ecosystem.memberCount >= ecosystem.memberLimit) {
      return resultError(
        'MEMBER_LIMIT_REACHED',
        'This accountability circle has reached its member limit.',
      );
    }

    window.localStorage.setItem(JOINED_ECOSYSTEM_STORAGE_KEY, ecosystem.id);
    return { ok: true, data: copyEcosystem(ecosystem) };
  } catch (error) {
    console.error('Ecosystem join failed', error);
    return resultError(
      'GENERAL_ERROR',
      'Something went wrong while checking this ecosystem.',
    );
  }
}

export async function leaveEcosystem() {
  await wait(LEAVE_DELAY_MS);

  try {
    window.localStorage.removeItem(JOINED_ECOSYSTEM_STORAGE_KEY);
    return { ok: true, data: null };
  } catch (error) {
    console.error('Ecosystem leave failed', error);
    return resultError(
      'GENERAL_ERROR',
      'The circle could not be removed from this device.',
    );
  }
}

export async function getEcosystemMembers(ecosystemId) {
  try {
    const ecosystem = mockEcosystems.find((item) => item.id === ecosystemId);
    if (!ecosystem) {
      return resultError('INVALID_ECOSYSTEM', 'This accountability circle is unavailable.');
    }

    return { ok: true, data: JSON.parse(JSON.stringify(ecosystem.members)) };
  } catch (error) {
    console.error('Ecosystem members could not be loaded', error);
    return resultError('GENERAL_ERROR', 'Circle members could not be loaded.');
  }
}

export { JOINED_ECOSYSTEM_STORAGE_KEY };
