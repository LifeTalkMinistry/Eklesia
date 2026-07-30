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
const devotion = await read('src/services/devotionService.js');
const localRepository = await read('src/services/sync/localSyncRepository.js');
const devotionBridge = await read('src/services/sync/devotionSyncBridge.js');

assert.match(storage, /ACCOUNT_OWNED_STORAGE_KEYS/);
assert.match(storage, /ekklesiaPulse\.account/);
assert.match(accountStorage, /getAccountStorageKey/);
assert.match(session, /legacy-claim-required/);
assert.match(session, /backendAccountId/);
assert.match(session, /await startRestoredSessionSync\(\)/);
assert.match(claim, /ImportLegacyData|importLegacyDataIntoAccount/i);
assert.match(claim, /device-only/);
assert.match(claim, /review-later/);
assert.match(coordinator, /bootstrapRemoteSync/);
assert.match(coordinator, /pushRemoteChanges/);
assert.match(coordinator, /pullRemoteChanges/);
assert.match(coordinator, /activeSyncPromise/);
assert.match(coordinator, /getSyncableLocalSnapshot\(\{ unsyncedOnly: true \}\)/);
assert.match(coordinator, /conflict\.entityType !== 'devotion-entry'/);
assert.match(notebook, /accountId/);
assert.match(accountAccess, /Import into this account|LegacyDataClaim/);
assert.match(accountAccess, /await bootstrapAccountSync\(\)/);
assert.match(devotion, /getBrowserStorage/);
assert.doesNotMatch(devotion, /window\.localStorage/);
assert.match(devotion, /queueDevotionForSync\(entry\)/);
assert.match(devotion, /deleteDevotionEntry/);
assert.match(localRepository, /entityType: 'devotion-entry'/);
assert.match(localRepository, /personalReflection/);
assert.match(localRepository, /wgapPrayer/);
assert.match(devotionBridge, /enqueueSyncMutation/);
assert.match(devotion, /getCurrentRhythmStreak/);
assert.doesNotMatch(localRepository, /currentStreak|weeklyRhythm|journeyTotal/);
assert.doesNotMatch(coordinator, /trycloudflare\.com/);

console.log('Ekklesia account-scoped devotion sync contract validated.');
