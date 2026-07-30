import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(relativePath) {
  return fs.readFile(path.join(projectRoot, relativePath), 'utf8');
}

const storage = await read('src/services/storageRegistry.js');
const accountStorage = await read('src/services/sync/accountScopedStorage.js');
const session = await read('src/services/backendSessionService.js');
const claim = await read('src/services/sync/legacyDataClaimService.js');
const coordinator = await read('src/services/sync/syncCoordinator.js');
const notebook = await read('src/services/notebookImageService.js');
const accountAccess = await read('src/components/AccountAccess.jsx');

assert.match(storage, /ACCOUNT_OWNED_STORAGE_KEYS/);
assert.match(storage, /ekklesiaPulse\.account/);
assert.match(accountStorage, /getAccountStorageKey/);
assert.match(session, /legacy-claim-required/);
assert.match(session, /backendAccountId/);
assert.match(claim, /ImportLegacyData|importLegacyDataIntoAccount/i);
assert.match(claim, /device-only/);
assert.match(claim, /review-later/);
assert.match(coordinator, /bootstrapRemoteSync/);
assert.match(coordinator, /pushRemoteChanges/);
assert.match(coordinator, /pullRemoteChanges/);
assert.match(coordinator, /activeSyncPromise/);
assert.match(notebook, /accountId/);
assert.match(accountAccess, /Import into this account|LegacyDataClaim/);
assert.doesNotMatch(coordinator, /trycloudflare\.com/);

console.log('Ekklesia account-scoped sync contract validated.');
