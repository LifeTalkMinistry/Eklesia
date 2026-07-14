const BRAND_MIGRATION_VERSION = 1;
const BRAND_MIGRATION_VERSION_KEY = 'ekklesiaPulse.brandMigrationVersion';

const LEGACY_KEY_MAPPINGS = [
  ['eklesia.devotions', 'ekklesiaPulse.devotions'],
  ['eklesia.joinedEcosystemId', 'ekklesiaPulse.joinedEcosystemId'],
  ['eklesia.lastBibleLocation', 'ekklesiaPulse.lastBibleLocation'],
  ['eklesia.devotionDataVersion', 'ekklesiaPulse.devotionDataVersion'],
  ['eklesia-wgap-history-v1', 'ekklesiaPulse-wgap-history-v1'],
];

function getStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch (error) {
    console.warn('Ekklesia Pulse could not access local data for brand migration.', error);
    return null;
  }
}

export function runBrandMigration() {
  const storage = getStorage();
  if (!storage) return { migrated: false, version: 0 };

  try {
    const currentVersion = Number(storage.getItem(BRAND_MIGRATION_VERSION_KEY) || 0);
    if (currentVersion >= BRAND_MIGRATION_VERSION) {
      return { migrated: false, version: currentVersion };
    }

    let migrationSafe = true;
    let copiedCount = 0;

    for (const [legacyKey, currentKey] of LEGACY_KEY_MAPPINGS) {
      const legacyValue = storage.getItem(legacyKey);
      if (legacyValue === null) continue;

      const currentValue = storage.getItem(currentKey);
      if (currentValue !== null) continue;

      try {
        storage.setItem(currentKey, legacyValue);
        if (storage.getItem(currentKey) !== legacyValue) {
          migrationSafe = false;
          console.warn(`Ekklesia Pulse could not verify migrated local data for ${legacyKey}.`);
          continue;
        }
        copiedCount += 1;
      } catch (error) {
        migrationSafe = false;
        console.warn(`Ekklesia Pulse could not safely migrate local data for ${legacyKey}.`, error);
      }
    }

    if (!migrationSafe) {
      return { migrated: copiedCount > 0, version: currentVersion, copiedCount };
    }

    storage.setItem(BRAND_MIGRATION_VERSION_KEY, String(BRAND_MIGRATION_VERSION));
    if (storage.getItem(BRAND_MIGRATION_VERSION_KEY) !== String(BRAND_MIGRATION_VERSION)) {
      console.warn('Ekklesia Pulse could not confirm brand migration completion.');
      return { migrated: copiedCount > 0, version: currentVersion, copiedCount };
    }

    return { migrated: copiedCount > 0, version: BRAND_MIGRATION_VERSION, copiedCount };
  } catch (error) {
    console.warn('Ekklesia Pulse brand migration could not be completed safely.', error);
    return { migrated: false, version: 0 };
  }
}

export { BRAND_MIGRATION_VERSION, BRAND_MIGRATION_VERSION_KEY, LEGACY_KEY_MAPPINGS };
