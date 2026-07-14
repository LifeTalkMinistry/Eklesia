import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CHECK_ONLY = process.argv.includes('--check');
const TEMP_FILES = new Set([
  'scripts/apply-brand-migration.mjs',
  '.github/workflows/brand-migration.yml',
]);
const EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'dist']);
const TEXT_EXTENSIONS = new Set([
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.css', '.html', '.md', '.txt',
  '.json', '.yml', '.yaml', '.svg', '.webmanifest',
]);
const CODE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);
const DOCUMENT_EXTENSIONS = new Set(['.md', '.txt', '.html', '.yml', '.yaml']);
const RASTER_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico']);

const OFFICIAL_NAME = 'Ekklesia Pulse';
const OFFICIAL_TAGLINE = 'Build your rhythm. Strengthen the church.';
const APP_DESCRIPTION = 'Ekklesia Pulse is a devotional accountability ecosystem that helps church members build a consistent rhythm through Scripture, private reflection, and healthy community care.';
const META_DESCRIPTION = 'Ekklesia Pulse helps church members build a consistent devotional rhythm through Scripture, private reflection, and healthy accountability.';
const PACKAGE_DESCRIPTION = 'A devotional accountability ecosystem that helps members build their rhythm and strengthen the church.';

const STORAGE_KEY_REPLACEMENTS = new Map([
  ['eklesia.devotions', 'ekklesiaPulse.devotions'],
  ['eklesia.joinedEcosystemId', 'ekklesiaPulse.joinedEcosystemId'],
  ['eklesia.lastBibleLocation', 'ekklesiaPulse.lastBibleLocation'],
  ['eklesia.devotionDataVersion', 'ekklesiaPulse.devotionDataVersion'],
  ['eklesia-wgap-history-v1', 'ekklesiaPulse-wgap-history-v1'],
]);

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(absolute(relativePath), 'utf8');
}

function write(relativePath, content) {
  const target = absolute(relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
  if (current !== content) fs.writeFileSync(target, content);
}

function walk(directory = ROOT) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    const relativePath = toPosix(path.relative(ROOT, fullPath));
    if (relativePath === 'src/data/bible' || relativePath.startsWith('src/data/bible/')) continue;
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else files.push(relativePath);
  }
  return files;
}

function isTextFile(relativePath) {
  const basename = path.basename(relativePath);
  if (basename === 'LICENSE' || basename === '.gitignore') return true;
  return TEXT_EXTENSIONS.has(path.extname(relativePath).toLowerCase());
}

function protectTechnicalReferences(content) {
  const protectedValues = [];
  const patterns = [
    /\/Eklesia\//g,
    /LifeTalkMinistry\/Eklesia/g,
    /lifetalkministry\.github\.io\/Eklesia/g,
  ];

  let next = content;
  for (const pattern of patterns) {
    next = next.replace(pattern, (match) => {
      const token = `__BRAND_TECHNICAL_${protectedValues.length}__`;
      protectedValues.push(match);
      return token;
    });
  }

  return {
    content: next,
    restore(value) {
      return protectedValues.reduce(
        (result, original, index) => result.replaceAll(`__BRAND_TECHNICAL_${index}__`, original),
        value,
      );
    },
  };
}

function replaceBrandText(content, { protectIdentifiers = false } = {}) {
  const technical = protectTechnicalReferences(content);
  let next = technical.content;
  const protectedIdentifiers = [];

  if (protectIdentifiers) {
    next = next.replace(/\b[A-Za-z_$][A-Za-z0-9_$]*Eklesia[A-Za-z0-9_$]*\b/g, (match) => {
      if (match === 'Eklesia') return match;
      const token = `__BRAND_IDENTIFIER_${protectedIdentifiers.length}__`;
      protectedIdentifiers.push(match);
      return token;
    });
    next = next.replace(/\b[A-Za-z_$][A-Za-z0-9_$]*EKLESIA[A-Za-z0-9_$]*\b/g, (match) => {
      if (match === 'EKLESIA') return match;
      const token = `__BRAND_IDENTIFIER_${protectedIdentifiers.length}__`;
      protectedIdentifiers.push(match);
      return token;
    });
  }

  const replacements = [
    [/Track the habit\. Protect the heart\./g, OFFICIAL_TAGLINE],
    [/Eklesia Rhythm/g, OFFICIAL_NAME],
    [/Ekklesia Rhythm/g, OFFICIAL_NAME],
    [/Eklesia Pulse/g, OFFICIAL_NAME],
    [/EkklesiaPulse/g, OFFICIAL_NAME],
    [/Ekklesia pulse/g, OFFICIAL_NAME],
    [/Ekklesia App/g, OFFICIAL_NAME],
    [/\bEKLESIA\b/g, OFFICIAL_NAME],
    [/\bEklesia\b/g, OFFICIAL_NAME],
  ];

  for (const [pattern, replacement] of replacements) next = next.replace(pattern, replacement);
  next = protectedIdentifiers.reduce(
    (result, original, index) => result.replaceAll(`__BRAND_IDENTIFIER_${index}__`, original),
    next,
  );
  return technical.restore(next);
}

function replaceStorageKeys(content) {
  let next = content;
  for (const [oldKey, newKey] of STORAGE_KEY_REPLACEMENTS) next = next.replaceAll(oldKey, newKey);
  next = next.replace(/\beklesia-cache-v(\d+)\b/g, (_match, version) => `ekklesia-pulse-cache-v${Number(version) + 1}`);
  next = next.replace(/\beklesia-cache\b/g, 'ekklesia-pulse-cache-v2');
  return next;
}

function updateCodeAndDocumentation() {
  for (const relativePath of walk()) {
    if (!isTextFile(relativePath) || TEMP_FILES.has(relativePath)) continue;
    const extension = path.extname(relativePath).toLowerCase();
    if (!CODE_EXTENSIONS.has(extension) && !DOCUMENT_EXTENSIONS.has(extension)) continue;

    let content = read(relativePath);
    if (CODE_EXTENSIONS.has(extension)) content = replaceStorageKeys(content);
    content = replaceBrandText(content, { protectIdentifiers: CODE_EXTENSIONS.has(extension) });
    write(relativePath, content);
  }
}

function updatePackageMetadata() {
  const packageJson = JSON.parse(read('package.json'));
  packageJson.name = 'ekklesia-pulse';
  packageJson.description = PACKAGE_DESCRIPTION;
  write('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);

  if (fs.existsSync(absolute('package-lock.json'))) {
    const lock = JSON.parse(read('package-lock.json'));
    lock.name = 'ekklesia-pulse';
    if (lock.packages?.['']) lock.packages[''].name = 'ekklesia-pulse';
    write('package-lock.json', `${JSON.stringify(lock, null, 2)}\n`);
  }
}

function updateIndexHtml() {
  write('index.html', `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${META_DESCRIPTION}" />
    <meta name="application-name" content="${OFFICIAL_NAME}" />
    <meta name="apple-mobile-web-app-title" content="${OFFICIAL_NAME}" />
    <meta property="og:title" content="${OFFICIAL_NAME} | ${OFFICIAL_TAGLINE}" />
    <meta property="og:description" content="${META_DESCRIPTION}" />
    <meta name="twitter:title" content="${OFFICIAL_NAME} | ${OFFICIAL_TAGLINE}" />
    <meta name="twitter:description" content="${META_DESCRIPTION}" />
    <title>${OFFICIAL_NAME} | ${OFFICIAL_TAGLINE}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`);
}

function updateReadme() {
  write('README.md', `# Ekklesia Pulse

**Build your rhythm. Strengthen the church.**

${APP_DESCRIPTION}

## Core Experience

- **Daily devotional rhythm:** One completed devotion per \`Asia/Manila\` calendar day completes the member’s official daily rhythm.
- **Built-in Bible:** The complete Berean Standard Bible (BSB) is available with Old and New Testament filters, chapter navigation, and highlighted passages.
- **Private reflections:** WGAP reflections, prayers, and journal content stay on the member’s current device unless the member chooses to share them elsewhere.
- **Journey history:** Daily and additional devotions remain available in a private date-grouped archive.
- **Accountability circles:** Members can use a prototype circle code to preview healthy accountability and encouragement flows.
- **Church pulse overview:** The Together experience demonstrates privacy-safe activity signals that can help a church notice when encouragement may be useful.
- **Privacy-first monitoring:** Circle views show healthy consistency signals without exposing Scripture selections, reflection text, personal prayers, or journal contents.

## Daily Rhythm and Additional Devotions

The first completed devotion on a Manila calendar date is saved as that date’s **Daily devotion**. It marks one completed day in the weekly rhythm and can increase the rhythm streak only once for that date.

After the daily rhythm is complete, members may complete unlimited **Additional devotions** through another curated suggestion, a passage selected from the built-in Bible, or the most recently opened Bible chapter. Additional devotions are saved privately in Journey and do not create another daily check mark, streak day, or accountability completion for the same date.

## Accountability Circle Prototype

Members can enter an ecosystem code, review the accountability circle and its privacy boundaries, and confirm joining before the circle overview appears. The current implementation uses local prototype data rather than live church records.

Joined-circle state is stored only on the current device. The interface displays healthy progress signals while keeping private reflections, personal prayers, journal entries, devotion passages, and additional-devotion totals out of the circle view.

Prototype code: \`LIFETALK30\`

## Prototype Limitations

Ekklesia Pulse is currently a frontend prototype. A production-connected release still requires:

- Real member and ecosystem-owner accounts
- Secure server persistence and code validation
- Rotating circle codes and subscription enforcement
- Role-based permissions and member-capacity controls
- Cross-device synchronization
- Live multi-user activity and Church Pulse data

Backend functionality and cross-device synchronization are **not yet implemented**.

## GitHub Pages Deployment

The repository has not been renamed because repository-renaming support is unavailable in the current integration. To preserve the existing deployment, the technical Vite and GitHub Pages base path remains \`/Eklesia/\`.

- Repository: \`LifeTalkMinistry/Eklesia\`
- Current site: \`https://lifetalkministry.github.io/Eklesia/\`

The visible application identity is Ekklesia Pulse even while this temporary technical path remains unchanged.

## Bible Source

The Bible text comes only from the official Berean Bible download. The BSB text has been dedicated to the public domain. Full source and conversion documentation is available in [\`docs/BIBLE_SOURCE.md\`](docs/BIBLE_SOURCE.md).

No Scripture text is generated, paraphrased, or rewritten by the application.

## Local Development

\`\`\`bash
npm install
npm run dev
\`\`\`

## Bible Validation

\`\`\`bash
npm run validate:bible
\`\`\`

Validation confirms canonical order, 66 books, chapter and verse integrity, complete curated-book coverage, and that daily verse metadata does not duplicate Bible text.

## Production Build

\`\`\`bash
npm run build
\`\`\`

The production command validates the Bible data before Vite builds the GitHub Pages bundle.

## Privacy

Personal reflections remain private on the current device unless the member chooses to share them. Ekklesia Pulse tracks devotional consistency without exposing the contents of a member’s journal.
`);
}

function updateMainEntry() {
  let content = read('src/main.jsx');
  if (!content.includes("./services/brandMigration.js")) {
    content = content.replace(
      "import App from './App.jsx';\n",
      "import App from './App.jsx';\nimport { runBrandMigration } from './services/brandMigration.js';\n",
    );
  }
  if (!content.includes('runBrandMigration();')) {
    content = content.replace(
      "\nReactDOM.createRoot(document.getElementById('root')).render(",
      "\nrunBrandMigration();\n\nReactDOM.createRoot(document.getElementById('root')).render(",
    );
  }
  write('src/main.jsx', content);
}

function updateResponsiveHeading() {
  let content = read('src/index.css');
  const rule = '.welcome-card h1 { font-size: clamp(2.8rem, 9vw, 5.2rem); }';
  if (!content.includes(rule)) {
    content = content.replace(
      /h1 \{[^\n]+\}\n/,
      (match) => `${match}${rule}\n`,
    );
  }
  write('src/index.css', content);
}

function updateManifests() {
  const manifestFiles = walk().filter((relativePath) => {
    const basename = path.basename(relativePath).toLowerCase();
    return basename.endsWith('.webmanifest') || (basename.includes('manifest') && basename.endsWith('.json'));
  });

  for (const relativePath of manifestFiles) {
    try {
      const manifest = JSON.parse(read(relativePath));
      if ('name' in manifest) manifest.name = OFFICIAL_NAME;
      if ('short_name' in manifest) manifest.short_name = OFFICIAL_NAME;
      if ('description' in manifest) manifest.description = OFFICIAL_TAGLINE;
      write(relativePath, `${JSON.stringify(manifest, null, 2)}\n`);
    } catch (error) {
      throw new Error(`Could not safely update manifest ${relativePath}: ${error.message}`);
    }
  }
}

function createBrandMigrationUtility() {
  write('src/services/brandMigration.js', `const BRAND_MIGRATION_VERSION = 1;
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
          console.warn(\`Ekklesia Pulse could not verify migrated local data for \${legacyKey}.\`);
          continue;
        }
        copiedCount += 1;
      } catch (error) {
        migrationSafe = false;
        console.warn(\`Ekklesia Pulse could not safely migrate local data for \${legacyKey}.\`, error);
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
`);
}

function assertContains(relativePath, expected) {
  const content = read(relativePath);
  if (!content.includes(expected)) throw new Error(`${relativePath} is missing required text: ${expected}`);
}

function allowedOldBrand(relativePath, line) {
  if (/\/Eklesia\/|LifeTalkMinistry\/Eklesia|lifetalkministry\.github\.io\/Eklesia/.test(line)) return 'preserved GitHub Pages or repository path';
  if (relativePath === 'src/services/brandMigration.js' && /eklesia(?:\.|-)/i.test(line)) return 'legacy storage-key migration mapping';
  if (/why-eklesia|WhyEklesia|whyEklesia/.test(line)) return 'retained internal component or CSS namespace';
  return null;
}

function scanForOldBrand() {
  const findings = [];
  const allowed = [];
  const patterns = [
    /Track the habit/i,
    /Protect the heart/i,
    /A devotional monitoring app/i,
    /Why Eklesia/i,
    /Creator of Eklesia/i,
    /Deploy Eklesia/i,
    /Eklesia Rhythm/i,
    /Ekklesia Rhythm/i,
    /Eklesia Pulse/i,
    /EkklesiaPulse/,
    /Ekklesia pulse/,
    /\bEKLESIA\b/,
    /\bEklesia\b/,
    /\beklesia(?:\.|-)/,
  ];

  for (const relativePath of walk()) {
    if (!isTextFile(relativePath) || TEMP_FILES.has(relativePath)) continue;
    const content = read(relativePath);
    content.split(/\r?\n/).forEach((line, index) => {
      if (!patterns.some((pattern) => pattern.test(line))) return;
      const reason = allowedOldBrand(relativePath, line);
      const finding = `${relativePath}:${index + 1}: ${line.trim()}`;
      if (reason) allowed.push(`${finding} [${reason}]`);
      else findings.push(finding);
    });
  }

  console.log('\nBrand scan — intentionally retained technical references:');
  if (allowed.length) allowed.forEach((item) => console.log(`  ALLOWED ${item}`));
  else console.log('  None');

  if (findings.length) {
    console.error('\nBrand scan — unintended old branding:');
    findings.forEach((item) => console.error(`  ERROR ${item}`));
    throw new Error(`Found ${findings.length} unintended old-brand occurrence(s).`);
  }

  console.log('\nBrand scan passed: no unintended old user-facing branding remains.');
}

function reportStaticAssets() {
  const rasterAssets = walk().filter((relativePath) => RASTER_EXTENSIONS.has(path.extname(relativePath).toLowerCase()));
  console.log('\nRaster assets requiring visual awareness:');
  if (rasterAssets.length) rasterAssets.forEach((item) => console.log(`  ${item}`));
  else console.log('  None');
}

function validateRequiredIdentity() {
  assertContains('src/App.jsx', '<h1>Ekklesia Pulse</h1>');
  assertContains('src/App.jsx', OFFICIAL_TAGLINE);
  assertContains('src/components/Dashboard.jsx', '<span>Ekklesia Pulse</span>');
  assertContains('src/components/Dashboard.jsx', 'Why Ekklesia Pulse?');
  assertContains('src/components/WhyEklesia.jsx', 'Why Ekklesia Pulse?');
  assertContains('src/components/WhyEklesia.jsx', 'Creator of Ekklesia Pulse');
  assertContains('index.html', `<title>${OFFICIAL_NAME} | ${OFFICIAL_TAGLINE}</title>`);
  assertContains('package.json', '"name": "ekklesia-pulse"');
  assertContains('README.md', '# Ekklesia Pulse');
  assertContains('.github/workflows/deploy.yml', 'Deploy Ekklesia Pulse to GitHub Pages');
  assertContains('src/main.jsx', 'runBrandMigration();');
  assertContains('src/services/devotionService.js', "'ekklesiaPulse.devotions'");
  assertContains('src/services/ecosystemService.js', "'ekklesiaPulse.joinedEcosystemId'");
  assertContains('src/services/brandMigration.js', "'eklesia.devotions', 'ekklesiaPulse.devotions'");
}

function applyMigration() {
  updateCodeAndDocumentation();
  updatePackageMetadata();
  updateIndexHtml();
  updateReadme();
  updateMainEntry();
  updateResponsiveHeading();
  updateManifests();
  createBrandMigrationUtility();
}

if (!CHECK_ONLY) applyMigration();
validateRequiredIdentity();
scanForOldBrand();
reportStaticAssets();
console.log(`\n${CHECK_ONLY ? 'Validation' : 'Migration'} completed for ${OFFICIAL_NAME}.`);
