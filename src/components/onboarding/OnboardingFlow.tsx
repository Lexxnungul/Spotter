'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, DEMO_MEMBER } from '../../context/AuthContext';
import styles from './OnboardingFlow.module.css';
import OnboardingIllustration from './OnboardingIllustration';

interface OnboardingFlowProps {
  onComplete?: () => void;
}

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const router = useRouter();
  const { user } = useAuth();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = 4;

  // Derive member details with demo fallback
  const member = user?.type === 'member' ? user.member : DEMO_MEMBER;
  const memberName = member.fullName || 'Gym Member';
  const memberNumber = member.memberNumber || '849201';
  const tier = member.tier || 'BASIC';
  const memberId = member.id || 'demo_member';

  const handleFinish = () => {
    try {
      localStorage.setItem(`spotter_onboarding_completed_${memberId}`, 'true');
      localStorage.setItem('spotter_onboarding_completed', 'true');
    } catch {}

    if (onComplete) {
      onComplete();
    } else {
      router.push('/member');
    }
  };

  const handleSkip = () => {
    handleFinish();
  };

  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <div className={styles.onboardingRoot}>
      <div className={styles.ambientGlowTop} aria-hidden="true" />
      <div className={styles.ambientGlowBottom} aria-hidden="true" />

      <section className={styles.container} id="onboarding-modal-container" aria-label="Spotter orientation">
        {/* Top Header */}
        <header className={styles.header}>
          <div className={styles.topRow}>
            <div className={styles.brandBadge}>
              <svg
                className={styles.logoIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 18h12M6 6h12M4 12h16" />
              </svg>
              <span>Spotter Orientation</span>
            </div>
            {currentStep < totalSteps && (
              <button
                type="button"
                id="onboarding-skip-btn"
                className={styles.skipButton}
                onClick={handleSkip}
              >
                Skip to Dashboard
              </button>
            )}
          </div>

          {/* Step Progress Tracker */}
          <div className={styles.progressWrapper}>
            <div className={styles.progressInfo}>
              <span>Step {currentStep} of {totalSteps}</span>
              <span>{Math.round(progressPercentage)}% completed</span>
            </div>
            <div className={styles.progressBarTrack} role="progressbar" aria-valuenow={progressPercentage} aria-valuemin={0} aria-valuemax={100}>
              <div
                className={styles.progressBarFill}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </header>

        {/* Dynamic Step Content - Compact fit without scrolling */}
        <div className={styles.contentArea}>
          {/* STEP 1: WELCOME & VERIFIED PASS */}
          {currentStep === 1 && (
            <div className={styles.stepSlide} id="onboarding-step-1">
              <span className={styles.categoryPill}>1. Identity & Records</span>
              <OnboardingIllustration step={1} />
              <h1 className={styles.title}>Welcome, {memberName.split(' ')[0]}!</h1>
              <p className={styles.description}>
                Your official <strong>SPOTTER GYM PASS</strong> ({tier} Tier • Card #{memberNumber}) is permanently connected to your verified member profile.
              </p>

              <div className={styles.featureList}>
                <div className={styles.featureItem}>
                  <svg className={styles.featureIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span><strong>Zero Disputes:</strong> Every workout check-in and membership renewal is permanently recorded to prevent billing or attendance conflicts.</span>
                </div>
                <div className={styles.featureItem}>
                  <svg className={styles.featureIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                    <line x1="12" y1="18" x2="12.01" y2="18" />
                  </svg>
                  <span><strong>Your Phone is Your Pass:</strong> No need to carry a physical plastic badge. Your active status lives right on your phone.</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: 1-TAP CHECK-IN */}
          {currentStep === 2 && (
            <div className={styles.stepSlide} id="onboarding-step-2">
              <span className={styles.categoryPill}>2. Gym Access</span>
              <OnboardingIllustration step={2} />
              <h2 className={styles.title}>Instant 1-Tap Check-In</h2>
              <p className={styles.description}>
                Entering the gym is frictionless and takes just one tap from your phone home screen:
              </p>

              <div className={styles.featureList}>
                <div className={styles.featureItem}>
                  <svg className={styles.featureIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span><strong>Rolling 6-Digit Access Code:</strong> Tap <em>Check in</em> at the entrance to display your rotating access code for the front-desk scanner.</span>
                </div>
                <div className={styles.featureItem}>
                  <svg className={styles.featureIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span><strong>Real-Time Verification:</strong> Front-desk check-in logs directly to your monthly workout attendance ledger with zero manual wait.</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: OFFLINE ZERO-DATA LOOKUP */}
          {currentStep === 3 && (
            <div className={styles.stepSlide} id="onboarding-step-3">
              <span className={styles.categoryPill}>3. Zero-Data Speed</span>
              <OnboardingIllustration step={3} />
              <h2 className={styles.title}>Instant Offline Answers</h2>
              <p className={styles.description}>
                Spotter saves your mobile data bundle. Essential gym information operates with <strong>Zero Data</strong>:
              </p>

              <div className={styles.featureList}>
                <div className={styles.featureItem}>
                  <svg className={styles.featureIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  <span><strong>Zero Data Usage:</strong> Tap question cards (timetable, prices, rules) to read cached answers locally without spending cellular data.</span>
                </div>
                <div className={styles.featureItem}>
                  <svg className={styles.featureIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
                  </svg>
                  <span><strong>Works Without Signal:</strong> Even during power drops or network blackouts, your timetable and verified rules open instantly.</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: LEDGER, RENEWALS & DESK HELP */}
          {currentStep === 4 && (
            <div className={styles.stepSlide} id="onboarding-step-4">
              <span className={styles.categoryPill}>4. Billing & Support</span>
              <OnboardingIllustration step={4} />
              <h2 className={styles.title}>Clear Ledger & Desk Help</h2>
              <p className={styles.description}>
                Enjoy total clarity over your membership status, dues, and front-desk communication:
              </p>

              <div className={styles.featureList}>
                <div className={styles.featureItem}>
                  <svg className={styles.featureIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                  <span><strong>Transparent Ledger:</strong> View your active tier, due dates, and official Flutterwave payment receipts anytime.</span>
                </div>
                <div className={styles.featureItem}>
                  <svg className={styles.featureIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span><strong>Ask the Desk:</strong> Have questions not covered by standard cards? Tap <em>Ask the desk</em> for direct front-desk resolution.</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <footer className={styles.footer}>
          <button
            type="button"
            id="onboarding-prev-btn"
            className={styles.backButton}
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            disabled={currentStep === 1}
          >
            Back
          </button>

          {/* Dots Indicator */}
          <div className={styles.dotsWrapper} aria-label="Step indicator">
            {[1, 2, 3, 4].map((stepNum) => (
              <button
                key={stepNum}
                type="button"
                className={`${styles.dot} ${currentStep === stepNum ? styles.dotActive : ''}`}
                onClick={() => setCurrentStep(stepNum)}
                aria-label={`Go to step ${stepNum}`}
              />
            ))}
          </div>

          {currentStep < totalSteps ? (
            <button
              type="button"
              id="onboarding-next-btn"
              className={styles.nextButton}
              onClick={() => setCurrentStep((prev) => Math.min(totalSteps, prev + 1))}
            >
              <span>Next</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              id="onboarding-finish-btn"
              className={styles.finishButton}
              onClick={handleFinish}
            >
              <span>Enter Dashboard</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
