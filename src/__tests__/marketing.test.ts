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

    // Core value proposition and single focused CTA button
    expect(marketingTsx).toContain('Approved gym records, instant check-in');
    expect(marketingTsx).toContain('Get Started for free');
    expect(marketingTsx).not.toContain('PlatformBadge');
    expect(marketingTsx).not.toContain('ZERO-LEAK GYM PLATFORM');
    expect(marketingTsx).not.toContain('Launch Member App');
    expect(marketingTsx).not.toContain('Activate Device (Desk Code)');
    expect(marketingTsx).not.toContain('Staff & Owner Portal');
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

    // Uses primary color and 4rem margin bottom
    expect(marketingCss).toContain('background: var(--color-primary, #0044e3);');
    expect(marketingCss).toContain('margin-bottom: 4rem;');
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

  it('hero display text uses display large typography tokens with 76px line-height', () => {
    expect(marketingCss).toMatch(/\.heroHeading\s*\{[^}]*font-family:\s*var\(--typography-display-large-font-family/);
    expect(marketingCss).toMatch(/\.heroHeading\s*\{[^}]*font-size:\s*var\(--typography-display-large-font-size/);
    expect(marketingCss).toMatch(/\.heroHeading\s*\{[^}]*line-height:\s*76px;/);
    expect(marketingCss).toMatch(/\.heroHeading\s*\{[^}]*font-weight:\s*var\(--typography-display-large-font-weight/);
    expect(marketingCss).toMatch(/\.heroHeading\s*\{[^}]*letter-spacing:\s*var\(--typography-display-large-letter-spacing/);
  });

  it('renders card section with all 4 feature cards and exact copy from design', () => {
    const marketingTsxPath = path.resolve(__dirname, '../components/marketing/MarketingPage.tsx');
    const marketingTsx = fs.readFileSync(marketingTsxPath, 'utf8');

    // Section title & subtitle
    expect(marketingTsx).toContain('Built For Member Independence');
    expect(marketingTsx).toContain('Zero clutter, zero ads, and instant confirmation.');

    // 01 Check In
    expect(marketingTsx).toContain('01');
    expect(marketingTsx).toContain('Check In');
    expect(marketingTsx).toContain('Generate a single-use six-digit code in the app and enter it at the door keypad for immediate arrival confirmation.');

    // 02 My Records
    expect(marketingTsx).toContain('02');
    expect(marketingTsx).toContain('My Records');
    expect(marketingTsx).toContain('Private attendance history and exact ledger balance read strictly by your authenticated member account.');

    // 03 Ask About The Gym
    expect(marketingTsx).toContain('03');
    expect(marketingTsx).toContain('Ask About The Gym');
    expect(marketingTsx).toContain('Direct answers grounded only in the gym&apos;s approved written records. Outdated or missing answers are never guessed.');

    // 04 Pay & Renew
    expect(marketingTsx).toContain('04');
    expect(marketingTsx).toContain('Pay &amp; Renew');
    expect(marketingTsx).toContain('Renew subscriptions or clear arrears via Flutterwave. Confirmed payments extend your membership instantly.');

    // Feature card styles
    expect(marketingCss).toContain('.cardSection');
    expect(marketingCss).toMatch(/\.cardSection\s*\{[^}]*margin-bottom:\s*4rem;/);
    expect(marketingCss).toContain('.cardsGrid');
    expect(marketingTsx).not.toContain('featureCardActive');
    expect(marketingCss).toMatch(/\.featureCard\s*,\s*\.pillarCard\s*\{[^}]*border-radius:\s*0rem;/);
    expect(marketingCss).toMatch(/\.featureCard\s*,\s*\.pillarCard\s*\{[^}]*margin-bottom:\s*1rem;/);
  });

  it('renders footer matching design with Spotter Gym Member System and triggers for privacy policy and terms views', () => {
    const marketingTsxPath = path.resolve(__dirname, '../components/marketing/MarketingPage.tsx');
    const marketingTsx = fs.readFileSync(marketingTsxPath, 'utf8');

    expect(marketingTsx).toContain('Spotter &bull; Gym Member System');
    expect(marketingTsx).toContain('id="link-footer-privacy"');
    expect(marketingTsx).toContain('Privacy Policy');
    expect(marketingTsx).toContain('id="link-footer-terms"');
    expect(marketingTsx).toContain('Terms of Service');

    expect(marketingCss).toContain('.footer');
    expect(marketingCss).toContain('.footerInner');
    expect(marketingCss).toContain('.footerBrand');
    expect(marketingCss).toContain('.footerLinks');
    expect(marketingCss).toContain('.footerLink');
  });

  it('home page client imports and supports switching between privacy, terms, and member views', () => {
    const homeClientPath = path.resolve(__dirname, '../components/marketing/HomePageClient.tsx');
    const homeClientTsx = fs.readFileSync(homeClientPath, 'utf8');

    expect(homeClientTsx).toContain("import PrivacyView from '../legal/PrivacyView'");
    expect(homeClientTsx).toContain("import TermsView from '../legal/TermsView'");
    expect(homeClientTsx).toContain('<PrivacyView');
    expect(homeClientTsx).toContain('<TermsView');
    expect(homeClientTsx).toContain('onViewPrivacy');
    expect(homeClientTsx).toContain('onViewTerms');
  });
});



