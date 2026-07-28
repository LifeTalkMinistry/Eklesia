import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const files = {
  main: path.join(root, 'src/main.jsx'),
  primitives: path.join(root, 'src/theme-primitives.css'),
  semantic: path.join(root, 'src/theme-semantic.css'),
  components: path.join(root, 'src/theme-component-tokens.css'),
  legacyComponents: path.join(root, 'src/theme-system.css'),
  service: path.join(root, 'src/services/themePreferencesService.js'),
};

function read(label) {
  const file = files[label];
  if (!fs.existsSync(file)) throw new Error(`Missing required theme file: ${path.relative(root, file)}`);
  return fs.readFileSync(file, 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const main = read('main');
const primitives = read('primitives');
const semantic = read('semantic');
const components = read('components');
const legacyComponents = read('legacyComponents');
const service = read('service');

const importOrder = [
  './theme-system.css',
  './theme-primitives.css',
  './theme-semantic.css',
  './theme-component-tokens.css',
  './theme-preferences.css',
].map((entry) => main.indexOf(entry));

assert(importOrder.every((index) => index >= 0), 'Theme stylesheets are not all imported from src/main.jsx.');
assert(importOrder.every((index, position) => position === 0 || index > importOrder[position - 1]), 'Theme stylesheet import order is invalid.');

assert(primitives.includes('--ep-primitive-canvas'), 'Primitive palette does not expose the required canvas token.');
assert(!primitives.includes('var(--ep-'), 'Primitive tokens must contain raw values and must not depend on higher token layers.');

assert(semantic.includes('var(--ep-primitive-'), 'Semantic roles must resolve from primitive tokens.');
assert(!semantic.includes('--ui-'), 'Semantic roles must not depend on the legacy compatibility namespace.');
assert(!/(^|[^-])#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(semantic), 'Semantic tokens must not contain raw color values.');

assert(components.includes('--ep-component-card-bg'), 'Component token contract is missing the card role.');
assert(components.includes('--ui-card: var(--ep-component-card-bg)'), 'Legacy component variables are not bridged through component tokens.');
assert(!/(^|[^-])#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(components), 'Component tokens must not contain raw color values.');

assert(!legacyComponents.includes('var(--ep-primitive-'), 'Application component CSS must never consume primitive tokens directly.');
assert(service.includes('dataset.uiTheme'), 'Theme service must expose data-ui-theme.');
assert(service.includes('dataset.colorMode'), 'Theme service must expose data-color-mode.');
assert(service.includes('dataset.lightTheme') && service.includes('dataset.darkTheme'), 'Theme service must expose light and dark theme identities.');

console.log('Theme contract validated: primitives -> semantic roles -> component tokens -> app components.');
