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

  it('includes semantic color roles', () => {
    expect(tokensCssContent).toContain('--color-primary:');
    expect(tokensCssContent).toContain('--color-surface:');
    expect(tokensCssContent).toContain('--color-background:');
  });

  it('includes z-index scale tokens', () => {
    expect(tokensCssContent).toContain('--z-base: 0;');
    expect(tokensCssContent).toContain('--z-card: 10;');
    expect(tokensCssContent).toContain('--z-modal: 1000;');
  });
});
