/**
 * Design Token Converter Script
 * Converts design-tokens.tokens.json into CSS Custom Properties (Variables).
 * 
 * Standard Color System Architecture:
 * - Primitive Colors: Base raw palette definitions (stored as --primitives-* variables).
 * - Color Roles: Semantic UI tokens (e.g. --color-primary, --color-surface) that reference 
 *   primitives using var(--primitives-*).
 * - Component UI: Always consumes color role variables, preserving the design system 
 *   as the single source of truth.
 */

const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, '..', 'design-tokens.tokens.json');
const OUTPUT_CSS_FILE = path.join(__dirname, 'tokens.css');
const OUTPUT_VARIABLES_CSS_FILE = path.join(__dirname, 'variables.css');

/**
 * Normalizes camelCase, spaces, and dots into clean kebab-case CSS variable slugs.
 * Example: "fontSize" -> "font-size", "color palettes" -> "color-palettes"
 */
function toSlug(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-');
}

/**
 * Format color values (handling #RRGGBBAA 8-digit hex codes from Figma).
 */
function formatColorValue(hex) {
  if (typeof hex !== 'string') return hex;
  const trimmed = hex.trim();

  // Handle #RRGGBBAA format exported by Figma design tokens plugin
  if (/^#[0-9a-fA-F]{8}$/.test(trimmed)) {
    const r = parseInt(trimmed.slice(1, 3), 16);
    const g = parseInt(trimmed.slice(3, 5), 16);
    const b = parseInt(trimmed.slice(5, 7), 16);
    const a = parseInt(trimmed.slice(7, 9), 16) / 255;

    if (a === 1) {
      return `#${trimmed.slice(1, 7).toLowerCase()}`;
    } else {
      const alphaFixed = Math.round(a * 100) / 100;
      return `rgba(${r}, ${g}, ${b}, ${alphaFixed})`;
    }
  }

  return trimmed;
}

/**
 * Convert token path array to CSS variable name.
 * e.g., ["primitives", "color palettes", "primary", "primary40"]
 * -> "--primitives-color-palettes-primary-primary40"
 */
function pathToVarName(pathArray) {
  return '--' + pathArray.map(toSlug).join('-');
}

/**
 * Parses reference strings like "{primitives.color palettes.primary.primary40}"
 * and converts them into CSS var() calls like "var(--primitives-color-palettes-primary-primary40)".
 */
function resolveTokenValue(val) {
  if (typeof val !== 'string') return val;

  const match = val.match(/^\{([^}]+)\}$/);
  if (match) {
    const rawPath = match[1];
    const pathParts = rawPath.split('.');
    const varName = pathToVarName(pathParts);
    return `var(${varName})`;
  }

  return formatColorValue(val);
}

/**
 * Recursively extracts leaf tokens from token tree.
 */
function extractTokens(obj, currentPath = []) {
  let tokens = [];

  for (const [key, value] of Object.entries(obj)) {
    const tokenPath = [...currentPath, key];

    if (value && typeof value === 'object') {
      if ('value' in value) {
        tokens.push({
          path: tokenPath,
          token: value
        });
      } else {
        tokens.push(...extractTokens(value, tokenPath));
      }
    }
  }

  return tokens;
}

/**
 * Main conversion process
 */
function convertTokensToCSS() {
  console.log(`Reading design tokens from: ${INPUT_FILE}`);
  const rawData = fs.readFileSync(INPUT_FILE, 'utf8');
  const tokenData = JSON.parse(rawData);

  const cssLines = [];
  cssLines.push('/* ========================================================================== */');
  cssLines.push('/*  AUTO-GENERATED CSS VARIABLES FROM DESIGN TOKENS                           */');
  cssLines.push('/*  SOURCE OF TRUTH: design-tokens.tokens.json                                */');
  cssLines.push('/* ========================================================================== */\n');

  cssLines.push(':root {');

  // 1. Primitive Colors
  if (tokenData.primitives) {
    cssLines.push('\n  /* ------------------------------------------------------------------------ */');
    cssLines.push('  /* Primitive Colors (Internal System Palette - DO NOT USE DIRECTLY ON UI)   */');
    cssLines.push('  /* ------------------------------------------------------------------------ */');

    const primitives = extractTokens(tokenData.primitives, ['primitives']);
    for (const { path: tokenPath, token } of primitives) {
      const varName = pathToVarName(tokenPath);
      const formattedValue = resolveTokenValue(token.value);
      cssLines.push(`  ${varName}: ${formattedValue};`);
    }
  }

  // 2. Color Roles (Semantic UI Colors)
  if (tokenData['color roles']) {
    cssLines.push('\n  /* ------------------------------------------------------------------------ */');
    cssLines.push('  /* Color Roles (Semantic UI Tokens - USE THESE DIRECTLY FOR UI COMPONENTS)  */');
    cssLines.push('  /* ------------------------------------------------------------------------ */');

    const colorRoles = extractTokens(tokenData['color roles'], ['color roles']);
    for (const { path: tokenPath, token } of colorRoles) {
      const varName = pathToVarName(tokenPath);
      const roleName = tokenPath[tokenPath.length - 1];
      const friendlyRoleVar = `--color-${toSlug(roleName)}`;
      const resolvedVal = resolveTokenValue(token.value);

      // Main role variable e.g. --color-roles-primary: var(--primitives-color-palettes-primary-primary40);
      cssLines.push(`  ${varName}: ${resolvedVal};`);
      // Direct UI variable shortcut e.g. --color-primary: var(--color-roles-primary);
      cssLines.push(`  ${friendlyRoleVar}: var(${varName});`);
    }
  }

  // 3. Effects / Shadows
  if (tokenData.effect) {
    cssLines.push('\n  /* ------------------------------------------------------------------------ */');
    cssLines.push('  /* Shadow Effects                                                           */');
    cssLines.push('  /* ------------------------------------------------------------------------ */');

    const effects = extractTokens(tokenData.effect, ['effect']);
    for (const { path: tokenPath, token } of effects) {
      const varName = pathToVarName(tokenPath);
      if (token.type === 'custom-shadow' && typeof token.value === 'object') {
        const { offsetX, offsetY, radius, spread, color } = token.value;
        const formattedColor = formatColorValue(color);
        const shadowStr = `${offsetX || 0}px ${offsetY || 0}px ${radius || 0}px ${spread || 0}px ${formattedColor}`;
        cssLines.push(`  ${varName}: ${shadowStr};`);
      } else {
        cssLines.push(`  ${varName}: ${resolveTokenValue(token.value)};`);
      }
    }
  }

  // 4. Typography
  if (tokenData.typography) {
    cssLines.push('\n  /* ------------------------------------------------------------------------ */');
    cssLines.push('  /* Typography Tokens                                                        */');
    cssLines.push('  /* ------------------------------------------------------------------------ */');

    const typographies = extractTokens(tokenData.typography, ['typography']);
    for (const { path: tokenPath, token } of typographies) {
      const varName = pathToVarName(tokenPath);
      let val = token.value;
      const lastKey = tokenPath[tokenPath.length - 1];
      if (typeof val === 'number' && ['fontSize', 'lineHeight', 'letterSpacing', 'paragraphSpacing', 'paragraphIndent'].includes(lastKey)) {
        val = `${val}px`;
      }
      cssLines.push(`  ${varName}: ${val};`);
    }
  }

  // 5. Spacing
  if (tokenData.spacing) {
    cssLines.push('\n  /* ------------------------------------------------------------------------ */');
    cssLines.push('  /* Spacing Tokens                                                           */');
    cssLines.push('  /* ------------------------------------------------------------------------ */');

    const spacings = extractTokens(tokenData.spacing, ['spacing']);
    for (const { path: tokenPath, token } of spacings) {
      const varName = pathToVarName(tokenPath);
      let val = token.value;
      if (typeof val === 'number') {
        val = `${val}px`;
      }
      cssLines.push(`  ${varName}: ${val};`);
    }
  }

  // 6. Border Radius
  if (tokenData.radius) {
    cssLines.push('\n  /* ------------------------------------------------------------------------ */');
    cssLines.push('  /* Border Radius Tokens                                                     */');
    cssLines.push('  /* ------------------------------------------------------------------------ */');

    const radii = extractTokens(tokenData.radius, ['radius']);
    for (const { path: tokenPath, token } of radii) {
      const varName = pathToVarName(tokenPath);
      let val = token.value;
      if (typeof val === 'number') {
        val = `${val}px`;
      }
      cssLines.push(`  ${varName}: ${val};`);
    }
  }

  // 7. Layout & Sizing
  if (tokenData.layout) {
    cssLines.push('\n  /* ------------------------------------------------------------------------ */');
    cssLines.push('  /* Layout & Sizing Tokens                                                   */');
    cssLines.push('  /* ------------------------------------------------------------------------ */');

    const layouts = extractTokens(tokenData.layout, ['layout']);
    for (const { path: tokenPath, token } of layouts) {
      const varName = pathToVarName(tokenPath);
      let val = token.value;
      if (typeof val === 'number') {
        val = `${val}px`;
      }
      cssLines.push(`  ${varName}: ${val};`);
    }
  }

  // 8. Z-Index Scale
  if (tokenData['z index'] || tokenData['z-index']) {
    cssLines.push('\n  /* ------------------------------------------------------------------------ */');
    cssLines.push('  /* Z-Index Scale Tokens                                                     */');
    cssLines.push('  /* ------------------------------------------------------------------------ */');

    const zData = tokenData['z index'] || tokenData['z-index'];
    const zIndexes = extractTokens(zData, ['z']);
    for (const { path: tokenPath, token } of zIndexes) {
      const varName = pathToVarName(tokenPath);
      cssLines.push(`  ${varName}: ${token.value};`);
    }
  }

  cssLines.push('}\n');

  const cssOutput = cssLines.join('\n');

  // Write files
  fs.mkdirSync(path.dirname(OUTPUT_CSS_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_CSS_FILE, cssOutput, 'utf8');
  fs.writeFileSync(OUTPUT_VARIABLES_CSS_FILE, cssOutput, 'utf8');

  console.log(`✅ Design Tokens successfully converted to CSS variables!`);
  console.log(`   Output file: ${OUTPUT_CSS_FILE}`);
  console.log(`   Output file: ${OUTPUT_VARIABLES_CSS_FILE}`);
}

convertTokensToCSS();
