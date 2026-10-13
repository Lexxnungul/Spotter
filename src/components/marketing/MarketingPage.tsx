'use client';

import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import styles from './MarketingPage.module.css';

export default function MarketingPage({ onOpenApp }: { onOpenApp?: () => void }) {
  const { user, openAuthModal, logout } = useAuth();

  useEffect(() => {
    document.title = 'Spotter | Approved Gym Records';
  }, []);

  const handleLaunchApp = () => {
    if (user) {
      if (onOpenApp) onOpenApp();
    } else {
      openAuthModal('pin');
    }
  };

  return (
    <div className={styles.marketingContainer}>
      {/* Ambient Radial Lights */}
      <div className={styles.glowAmbientOrb} aria-hidden="true" />
      <div className={styles.glowAmbientOrbSecondary} aria-hidden="true" />

      {/* Top Navbar */}
      <header className={styles.navbar}>
        <div className={styles.brandGroup}>
          <div className={styles.brandLogo} id="brand-header-logo" aria-label="Spotter Logo">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 32 32"
              width="36"
              height="36"
              className={styles.brandLogoSvg}
              role="img"
              aria-label="Spotter S Logo"
            >
              <rect width="32" height="32" rx="0" fill="var(--color-primary, #0044e3)" />
              <text x="16" y="23" fontFamily="system-ui, -apple-system, sans-serif" fontSize="20" fontWeight="700" fill="#ffffff" textAnchor="middle">S</text>
            </svg>
          </div>
        </div>

        <div className={styles.navActions}>
          {user ? (
            <>
              <button
                type="button"
                className={styles.navButtonPrimary}
                onClick={handleLaunchApp}
                id="btn-nav-open-app"
              >
                Open {user.type === 'member' ? 'Member App' : 'Staff Desk'}
              </button>
              <button
                type="button"
                className={styles.navButtonGhost}
                onClick={logout}
                id="btn-nav-logout"
              >
                Sign Out
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.navButtonPrimary}
              onClick={() => openAuthModal('pin')}
              id="btn-nav-get-started"
            >
              Get Started
            </button>
          )}
        </div>
      </header>

      {/* 100vh Hero Core */}
      <main className={styles.heroSection}>
        <div className={styles.heroGrid}>
          {/* Left Column: Headline and Call-to-actions */}
          <div className={styles.heroContent}>
            <div className={styles.eyebrowPill}>
              ZERO-LEAK GYM PLATFORM • LAGOS, NIGERIA
            </div>

            <h1 className={styles.heroHeading}>
              Approved gym records, instant check-in, and{' '}
              <span className={styles.heroHeadingHighlight}>member balance.</span>
            </h1>

            <p className={styles.heroSubtitle}>
              Spotter delivers row-level attendance security, audited Flutterwave payments,
              and an AI desk assistant. Built specifically for member phones, bandwidth limits,
              and Nigerian gym operations.
            </p>

            <div className={styles.ctaButtonGroup}>
              <button
                type="button"
                className={styles.ctaButtonMain}
                onClick={handleLaunchApp}
                id="btn-hero-launch-app"
              >
                <span>🚀</span> Launch Member App
              </button>

              <button
                type="button"
                className={styles.ctaButtonSecondary}
                onClick={() => openAuthModal('activate')}
                id="btn-hero-activate"
              >
                <span>🔑</span> Activate Device (Desk Code)
              </button>

              <button
                type="button"
                className={styles.ctaButtonSecondary}
                onClick={() => openAuthModal('staff')}
                id="btn-hero-staff"
              >
                <span>🏢</span> Staff & Owner Portal
              </button>
            </div>

            {/* Feature Pillars Grid */}
            <div className={styles.pillarsGrid} id="features">
              <div className={styles.pillarCard}>
                <span className={styles.pillarTitle}>
                  <span>🔒</span> Row-Level Isolation
                </span>
                <span className={styles.pillarDesc}>
                  PostgreSQL database policies guarantee members only ever see their own records.
                </span>
              </div>

              <div className={styles.pillarCard}>
                <span className={styles.pillarTitle}>
                  <span>📱</span> 100dvh PWA Shell
                </span>
                <span className={styles.pillarDesc}>
                  Under 200 KB compressed. Cached status works offline during power and network outages.
                </span>
              </div>

              <div className={styles.pillarCard}>
                <span className={styles.pillarTitle}>
                  <span>🤖</span> AI Desk Router
                </span>
                <span className={styles.pillarDesc}>
                  Answers timetables and prices instantly. Hands off cancellations to WhatsApp with zero guesswork.
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Trust Verification Bar */}
      <footer className={styles.bottomTrustBar} id="security">
        <div className={styles.trustList}>
          <div className={styles.trustItem}>
            <span className={styles.trustCheck}>✓</span> NDPA 2023 Consent Logs
          </div>
          <div className={styles.trustItem}>
            <span className={styles.trustCheck}>✓</span> Lagos Timezone Enforcement
          </div>
          <div className={styles.trustItem}>
            <span className={styles.trustCheck}>✓</span> Server-Side Idempotency Keys
          </div>
        </div>
        <div>Spotter v0.2 • Built with Design System Tokens</div>
      </footer>
    </div>
  );
}
