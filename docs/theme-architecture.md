# Ekklesia Pulse theme architecture

Ekklesia Pulse uses one application structure with multiple complete visual themes. The implementation follows the same separation used by mature design systems: raw primitives, semantic roles, and component contracts.

## Dependency direction

```text
Theme primitive values
        ↓
Semantic UI roles
        ↓
Component tokens
        ↓
Application components
```

A lower layer must never depend on a higher layer.

## Files

### `src/theme-primitives.css`

Contains the raw values for Pulse Dark, Light, Midnight, and Parchment. This is the only theme file where raw hex, RGB, gradient, radius, and shadow values should be introduced.

Primitive tokens use the prefix:

```css
--ep-primitive-*
```

Application components must never reference primitive tokens directly.

### `src/theme-semantic.css`

Maps raw primitives to stable functional roles such as:

```css
--ep-bg-canvas-default
--ep-fg-default
--ep-border-default
--ep-accent-emphasis
--ep-success-muted
--ep-layer-01
--ep-layer-02
--ep-layer-03
```

The role name remains stable across themes; only its primitive value changes.

The `layer-01`, `layer-02`, and `layer-03` model is used for contextual depth. In dark themes, elevated layers may become lighter. In light themes, elevation may be communicated with white surfaces, borders, or shadows.

### `src/theme-component-tokens.css`

Defines component-specific roles such as:

```css
--ep-component-card-bg
--ep-component-navigation-bg
--ep-component-control-primary-bg
--ep-component-dialog-bg
```

The file also contains a temporary compatibility bridge for components that still use the previous `--ui-*` variables. New components must use the `--ep-component-*` namespace.

### `src/theme-system.css`

Maps named Ekklesia Pulse components to component behavior. It contains layout and selector integration, not the canonical theme palettes.

## Theme attributes

The theme service places these attributes on `html`, `body`, and `#root`:

```html
<html
  data-ui-theme="midnight"
  data-color-mode="dark"
  data-light-theme="light"
  data-dark-theme="midnight"
>
```

The older `data-ekklesia-theme` and `data-ekklesia-ui-skin` attributes remain during migration.

## Adding a component

Use component tokens rather than a fixed appearance:

```css
.member-card {
  color: var(--ep-component-body-fg);
  background: var(--ep-component-card-bg);
  border: 1px solid var(--ep-component-card-border);
  border-radius: var(--ep-component-card-radius);
  box-shadow: var(--ep-component-card-shadow);
}
```

Do not use a theme-specific color in the component:

```css
/* Incorrect */
.member-card {
  background: #102019;
}
```

## Adding a theme

1. Add the theme metadata to `THEME_OPTIONS`.
2. Add one primitive token block in `theme-primitives.css`.
3. Do not add component overrides unless the theme requires a genuinely different interaction or geometry.
4. Run `npm run validate:theme`.
5. Test every status state, dialog, navigation state, and contextual layer.

## Validation

The production build runs:

```bash
npm run validate:theme
```

The validator checks import order, token dependency direction, required theme attributes, and the compatibility bridge. This prevents future components from bypassing the theme contract accidentally.
