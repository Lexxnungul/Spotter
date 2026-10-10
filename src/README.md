# Spotter Design System Tokens Converter

This directory contains the JavaScript script to convert `design-tokens.tokens.json` into CSS Custom Properties (CSS variables).

## Architecture & Standard Color Practice

In standard design token systems:
- **Primitives (`--primitives-*`)**: Base raw color palette definitions (e.g. key colors, tonal palettes).
  - *Rule*: Primitive variables are internal system values and **must NOT be used directly in component UI styles**.
- **Color Roles (`--color-*` / `--color-roles-*`)**: Semantic tokens representing UI intention (e.g., `--color-primary`, `--color-surface`, `--color-background`, `--color-outline`).
  - *Rule*: Color roles resolve to primitives via `var(--primitives-*)` and **are the ONLY color variables used directly on the UI**.

## Single Source of Truth

The root `design-tokens.tokens.json` file is the single source of truth for all design tokens (colors, shadows, typography). Whenever tokens are updated, re-running the converter script regenerates `src/tokens.css` and `src/variables.css`.

## Usage

### Run conversion script
```bash
npm run build:tokens
```
or
```bash
node src/convert-tokens.js
```

### Import into your CSS
```css
@import './src/tokens.css';

/* Example UI Usage */
.button-primary {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  box-shadow: var(--effect-soft-shadow);
  font-family: var(--typography-label-large-font-family);
  font-size: var(--typography-label-large-font-size);
}
```
