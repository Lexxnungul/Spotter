import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Design Tokens & CSS Variables Integration', () => {
  const tokensCssPath = path.resolve(__dirname, '../tokens.css');
  const tokensCssContent = fs.readFileSync(tokensCssPath, 'utf8');

  it('includes viewport height layout token 100dvh', () => {
    expect(tokensCssContent).toContain('--layout-viewport-height: 100dvh;');
  });

  it('includes container max-width layout token 480px', () => {
    expect(tokensCssContent).toContain('--layout-max-width: 480px;');
  });

  it('includes spacing tokens scale', () => {
    expect(tokensCssContent).toContain('--spacing-xs: 4px;');
    expect(tokensCssContent).toContain('--spacing-sm: 8px;');
    expect(tokensCssContent).toContain('--spacing-md: 12px;');
    expect(tokensCssContent).toContain('--spacing-lg: 16px;');
  });

  it('includes semantic color roles with primary 100 background and complimentary palette', () => {
    expect(tokensCssContent).toContain('--color-primary:');
    expect(tokensCssContent).toContain('--color-surface:');
    expect(tokensCssContent).toContain('--color-background:');
    expect(tokensCssContent).toContain('--color-roles-background: var(--primitives-color-palettes-primary-primary100);');
    expect(tokensCssContent).toContain('--color-roles-on-background: var(--primitives-color-palettes-primary-primary10);');
    expect(tokensCssContent).toContain('--color-roles-surface: var(--primitives-color-palettes-primary-primary100);');
  });

  it('includes z-index scale tokens', () => {
    expect(tokensCssContent).toContain('--z-base: 0;');
    expect(tokensCssContent).toContain('--z-card: 10;');
    expect(tokensCssContent).toContain('--z-modal: 1000;');
  });

  it('defines label large typography tokens', () => {
    expect(tokensCssContent).toContain('--typography-label-large-font-size: 14px;');
    expect(tokensCssContent).toContain('--typography-label-large-font-family: DM Sans;');
    expect(tokensCssContent).toContain('--typography-label-large-font-weight: 500;');
    expect(tokensCssContent).toContain('--typography-label-large-line-height: 21px;');
    expect(tokensCssContent).toContain('--typography-label-large-letter-spacing: -0.119px;');
  });

  it('sets label large as the default text style on all buttons in globals.css', () => {
    const globalsCssPath = path.resolve(__dirname, '../app/globals.css');
    const globalsCssContent = fs.readFileSync(globalsCssPath, 'utf8');

    expect(globalsCssContent).toMatch(/button\s*\{[^}]*font-family:\s*var\(--typography-label-large-font-family/);
    expect(globalsCssContent).toMatch(/button\s*\{[^}]*font-size:\s*var\(--typography-label-large-font-size,\s*14px\);/);
    expect(globalsCssContent).toMatch(/button\s*\{[^}]*font-weight:\s*var\(--typography-label-large-font-weight,\s*500\);/);
    expect(globalsCssContent).toMatch(/button\s*\{[^}]*line-height:\s*var\(--typography-label-large-line-height,\s*21px\);/);
    expect(globalsCssContent).toMatch(/button\s*\{[^}]*letter-spacing:\s*var\(--typography-label-large-letter-spacing,\s*-0.119px\);/);
  });
});
