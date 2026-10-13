import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Marketing Page & Design System 100vh Integration', () => {
  const marketingCssPath = path.resolve(__dirname, '../components/marketing/MarketingPage.module.css');
  const marketingCss = fs.readFileSync(marketingCssPath, 'utf8');

  const globalsCssPath = path.resolve(__dirname, '../app/globals.css');
  const globalsCss = fs.readFileSync(globalsCssPath, 'utf8');

  it('marketing container enforces 100vh / 100dvh layout', () => {
    expect(marketingCss).toContain('min-height: 100vh;');
    expect(marketingCss).toContain('height: 100dvh;');
  });

  it('globals.css imports tokens.css and sets 100dvh without global 480px restriction on main', () => {
    expect(globalsCss).toContain("@import '../tokens.css';");
    expect(globalsCss).toContain('height: 100dvh;');
    // main must span full width, not be constricted to 480px
    expect(globalsCss).not.toContain('max-width: var(--layout-max-width);');
  });

  it('marketing styles consume design system color roles and effects', () => {
    expect(marketingCss).toContain('var(--color-primary');
    expect(marketingCss).toContain('radial-gradient');
    expect(marketingCss).toContain('backdrop-filter: blur');
  });

  it('hero section has clean focused layout with right-side modal/simulator removed', () => {
    const marketingTsxPath = path.resolve(__dirname, '../components/marketing/MarketingPage.tsx');
    const marketingTsx = fs.readFileSync(marketingTsxPath, 'utf8');

    // Right-side modal/mockup is removed
    expect(marketingTsx).not.toContain('deviceMockupFrame');
    expect(marketingTsx).not.toContain('interactiveShowcaseWrapper');

    // Core value proposition and action buttons remain intact
    expect(marketingTsx).toContain('Approved gym records, instant check-in');
    expect(marketingTsx).toContain('Launch Member App');
    expect(marketingTsx).toContain('Activate Device (Desk Code)');
    expect(marketingTsx).toContain('Staff & Owner Portal');
  });

  it('header navbar has simplified layout with primary Get Started button', () => {
    const marketingTsxPath = path.resolve(__dirname, '../components/marketing/MarketingPage.tsx');
    const marketingTsx = fs.readFileSync(marketingTsxPath, 'utf8');

    // Header badge and middle nav links are removed
    expect(marketingTsx).not.toContain('Gym Verification System');
    expect(marketingTsx).not.toContain('Security & RLS');
    expect(marketingTsx).not.toContain('Pricing & Tiers');

    // Collapsed into single Get Started button
    expect(marketingTsx).toContain('Get Started');
    expect(marketingTsx).toContain('id="btn-nav-get-started"');

    // Uses primary color
    expect(marketingCss).toContain('background: var(--color-primary, #0044e3);');
  });

  it('header navbar has no bottom border and uses the blue square S logo in the brand', () => {
    const marketingTsxPath = path.resolve(__dirname, '../components/marketing/MarketingPage.tsx');
    const marketingTsx = fs.readFileSync(marketingTsxPath, 'utf8');

    // Header navbar bottom border is removed
    expect(marketingCss).not.toContain('border-bottom: 1px solid');

    // Brand uses the blue square with letter S
    expect(marketingTsx).toContain('id="brand-header-logo"');
    expect(marketingTsx).toContain('<rect width="32" height="32"');
    expect(marketingTsx).toContain('>S</text>');
    expect(marketingCss).toContain('.brandLogo {');
    expect(marketingCss).toContain('.brandLogoSvg {');

    // Previous text rectangle and legacy lightning icon are removed
    expect(marketingTsx).not.toContain('id="brand-spotter-badge"');
    expect(marketingTsx).not.toContain('brandIcon');
    expect(marketingTsx).not.toContain('>⚡<');
  });

  it('all buttons and cards on the marketing and hero screen have 0rem border-radius', () => {
    // Buttons in navbar
    expect(marketingCss).toMatch(/\.navButtonPrimary\s*\{[^}]*border-radius:\s*0rem;/);
    expect(marketingCss).toMatch(/\.navButtonGhost\s*\{[^}]*border-radius:\s*0rem;/);

    // Hero CTA buttons
    expect(marketingCss).toMatch(/\.ctaButtonMain\s*\{[^}]*border-radius:\s*0rem;/);
    expect(marketingCss).toMatch(/\.ctaButtonSecondary\s*\{[^}]*border-radius:\s*0rem;/);

    // Badges and cards
    expect(marketingCss).toMatch(/\.eyebrowPill\s*\{[^}]*border-radius:\s*0rem;/);
    expect(marketingCss).toMatch(/\.pillarCard\s*\{[^}]*border-radius:\s*0rem;/);
    expect(marketingCss).toMatch(/\.brandLogoSvg\s*\{[^}]*border-radius:\s*0rem;/);
  });

  it('all buttons on marketing and hero screen use label large typography tokens', () => {
    // Nav buttons
    expect(marketingCss).toMatch(/\.navButtonPrimary\s*\{[^}]*font-family:\s*var\(--typography-label-large-font-family/);
    expect(marketingCss).toMatch(/\.navButtonPrimary\s*\{[^}]*font-size:\s*var\(--typography-label-large-font-size,\s*14px\);/);
    expect(marketingCss).toMatch(/\.navButtonGhost\s*\{[^}]*font-family:\s*var\(--typography-label-large-font-family/);
    expect(marketingCss).toMatch(/\.navButtonGhost\s*\{[^}]*font-size:\s*var\(--typography-label-large-font-size,\s*14px\);/);

    // Hero CTA buttons
    expect(marketingCss).toMatch(/\.ctaButtonMain\s*\{[^}]*font-family:\s*var\(--typography-label-large-font-family/);
    expect(marketingCss).toMatch(/\.ctaButtonMain\s*\{[^}]*font-size:\s*var\(--typography-label-large-font-size,\s*14px\);/);
    expect(marketingCss).toMatch(/\.ctaButtonSecondary\s*\{[^}]*font-family:\s*var\(--typography-label-large-font-family/);
    expect(marketingCss).toMatch(/\.ctaButtonSecondary\s*\{[^}]*font-size:\s*var\(--typography-label-large-font-size,\s*14px\);/);
  });
});
