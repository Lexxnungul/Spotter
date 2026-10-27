import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Member Onboarding Flow - Educational Orientation System', () => {
  const onboardingTsxPath = path.resolve(__dirname, '../components/onboarding/OnboardingFlow.tsx');
  const onboardingTsx = fs.readFileSync(onboardingTsxPath, 'utf8');

  const onboardingCssPath = path.resolve(__dirname, '../components/onboarding/OnboardingFlow.module.css');
  const onboardingCss = fs.readFileSync(onboardingCssPath, 'utf8');

  const authPageTsxPath = path.resolve(__dirname, '../app/auth/page.tsx');
  const authPageTsx = fs.readFileSync(authPageTsxPath, 'utf8');

  const authModalTsxPath = path.resolve(__dirname, '../components/auth/AuthModal.tsx');
  const authModalTsx = fs.readFileSync(authModalTsxPath, 'utf8');

  const memberAppTsxPath = path.resolve(__dirname, '../components/member/MemberApp.tsx');
  const memberAppTsx = fs.readFileSync(memberAppTsxPath, 'utf8');

  it('routes newly created accounts to /onboarding instead of directly bypassing to dashboard', () => {
    // Both AuthPage and AuthModal should route successful account creations to /onboarding
    expect(authPageTsx).toContain("router.push('/onboarding')");
    expect(authModalTsx).toContain("router.push('/onboarding')");

    // Returning logins should still go straight to /member
    expect(authPageTsx).toContain("router.push('/member')");
  });

  it('educational onboarding flow focuses on member education across 4 steps', () => {
    // Step 1: Identity & Records
    expect(onboardingTsx).toContain('1. Identity & Records');
    expect(onboardingTsx).toContain('SPOTTER GYM PASS');
    expect(onboardingTsx).toContain('Zero Disputes:');

    // Step 2: 1-Tap Check-In Access
    expect(onboardingTsx).toContain('2. Gym Access');
    expect(onboardingTsx).toContain('Instant 1-Tap Check-In');

    // Step 3: Zero-Data Offline Answers
    expect(onboardingTsx).toContain('3. Zero-Data Speed');
    expect(onboardingTsx).toContain('Instant Offline Answers');
    expect(onboardingTsx).toContain('Zero Data');

    // Step 4: Transparent Ledger & Desk Support
    expect(onboardingTsx).toContain('4. Billing & Support');
    expect(onboardingTsx).toContain('Clear Ledger & Desk Help');
    expect(onboardingTsx).toContain('Ask the Desk:');
    expect(onboardingTsx).toContain('Enter Dashboard');
  });

  it('streamlines onboarding steps to fit screen without scrolling', () => {
    // Confirms bulky middle cards are removed from the onboarding slides
    expect(onboardingTsx).not.toContain('styles.memberPassCard');
    expect(onboardingTsx).not.toContain('styles.simulatorBox');
    expect(onboardingTsx).not.toContain('styles.cardPreviewBox');
    expect(onboardingTsx).not.toContain('styles.ledgerSummaryGrid');
  });

  it('persists onboarding completion in localStorage and redirects to /member', () => {
    expect(onboardingTsx).toContain('spotter_onboarding_completed_');
    expect(onboardingTsx).toContain("router.push('/member')");
    expect(onboardingTsx).toContain('handleSkip');
    expect(onboardingTsx).toContain('handleFinish');
    expect(onboardingTsx).toContain('currentStep < totalSteps &&');
  });

  it('allows members to revisit orientation guide from dashboard header', () => {
    expect(memberAppTsx).toContain('member-orientation-btn');
    expect(memberAppTsx).toContain("router.push('/onboarding')");
  });

  it('styles enforce mobile-first design system styling and zero image dependencies', () => {
    expect(onboardingCss).toContain('max-width:');
    expect(onboardingCss).toContain('backdrop-filter: blur');
    expect(onboardingCss).toContain('progressBarTrack');
    expect(onboardingCss).toContain('progressBarFill');
    // Ensure no external bitmap image references that consume data bundles
    expect(onboardingCss).not.toContain('.jpg');
    expect(onboardingCss).not.toContain('.png');
  });

  it('renders GSAP motion outline illustrations for all 4 educational steps', () => {
    const illustrationTsxPath = path.resolve(__dirname, '../components/onboarding/OnboardingIllustration.tsx');
    expect(fs.existsSync(illustrationTsxPath)).toBe(true);
    const illustrationTsx = fs.readFileSync(illustrationTsxPath, 'utf8');

    // Uses GSAP context for clean lifecycle management
    expect(illustrationTsx).toContain("import gsap from 'gsap'");
    expect(illustrationTsx).toContain('gsap.context');
    expect(illustrationTsx).toContain('ctx.revert()');

    // Enforces outline-only illustration rule (vector SVG, fill="none")
    expect(illustrationTsx).toContain('fill="none"');
    expect(illustrationTsx).not.toContain('.jpg');
    expect(illustrationTsx).not.toContain('.png');

    // Verifies all 4 step illustrations are implemented
    expect(illustrationTsx).toContain('step === 1');
    expect(illustrationTsx).toContain('step === 2');
    expect(illustrationTsx).toContain('step === 3');
    expect(illustrationTsx).toContain('step === 4');

    // Verifies OnboardingFlow embeds the illustration component across steps
    expect(onboardingTsx).toContain('OnboardingIllustration');
    expect(onboardingTsx).toContain('<OnboardingIllustration step={1} />');
    expect(onboardingTsx).toContain('<OnboardingIllustration step={2} />');
    expect(onboardingTsx).toContain('<OnboardingIllustration step={3} />');
    expect(onboardingTsx).toContain('<OnboardingIllustration step={4} />');
  });
});
