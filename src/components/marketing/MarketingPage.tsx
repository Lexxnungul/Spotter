'use client';

import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import styles from './MarketingPage.module.css';

interface MarketingPageProps {
  onOpenApp?: () => void;
  onViewPrivacy?: () => void;
  onViewTerms?: () => void;
}

export default function MarketingPage({
  onOpenApp,
  onViewPrivacy,
  onViewTerms,
}: MarketingPageProps) {
  const { user, openAuthModal, logout } = useAuth();

  useEffect(() => {
    document.title = 'Spotter | Approved Gym Records';
  }, []);

  const handleLaunchApp = () => {
    if (user) {
      if (onOpenApp) onOpenApp();
    } else {
      openAuthModal('create');
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
          <div className={styles.brandLogo} id="brand-header-logo">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 32 32"
              width="36"
              height="36"
              className={styles.brandLogoSvg}
              role="img"
              aria-label="Spotter Logo"
            >
              <rect width="32" height="32" rx="0" fill="var(--color-primary, #0044e3)" />
              <text x="16" y="23" fontFamily="system-ui, -apple-system, sans-serif" fontSize="20" fontWeight="700" fill="#ffffff" textAnchor="middle">S</text>
            </svg>
          </div>
        </div>

        <nav className={styles.navActions} aria-label="Main Navigation">
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
              onClick={() => openAuthModal('create')}
              id="btn-nav-get-started"
            >
              Get Started
            </button>
          )}
        </nav>
      </header>

      {/* 100vh Hero Core */}
      <main className={styles.heroSection} id="main-content" aria-labelledby="hero-heading">
        <div className={styles.heroGrid}>
          {/* Left Column: Headline and Call-to-actions */}
          <div className={styles.heroContent}>
            <h1 className={styles.heroHeading} id="hero-heading">
              Approved gym records, instant check-in, and{' '}
              <span className={styles.heroHeadingHighlight}>member balance.</span>
            </h1>

            <p className={styles.heroSubtitle}>
              Row-level attendance security, audited Flutterwave payments, and an AI desk assistant built for Nigerian gyms.
            </p>

            <div className={styles.ctaButtonGroup}>
              <button
                type="button"
                className={styles.ctaButtonMain}
                onClick={handleLaunchApp}
                id="btn-hero-get-started"
              >
                Get Started for free
              </button>
            </div>

            {/* Card Section */}
            <section className={styles.cardSection} id="card-section" aria-labelledby="card-section-title">
              <div className={styles.cardSectionHeader}>
                <h2 className={styles.cardSectionTitle} id="card-section-title">Built For Member Independence</h2>
                <p className={styles.cardSectionSubtitle}>
                  Zero clutter, zero ads, and instant confirmation.
                </p>
              </div>

              <div className={styles.cardsGrid}>
                {/* 01 Check In */}
                <div className={styles.featureCard} aria-labelledby="feature-card-1-title">
                  <div className={styles.cardBadgeNumber} aria-hidden="true">01</div>
                  <h3 className={styles.cardHeading} id="feature-card-1-title">Check In</h3>
                  <p className={styles.cardBodyText}>
                    Generate a single-use six-digit code in the app and enter it at the door keypad for immediate arrival confirmation.
                  </p>
                </div>

                {/* 02 My Records */}
                <div className={styles.featureCard} aria-labelledby="feature-card-2-title">
                  <div className={styles.cardBadgeNumber} aria-hidden="true">02</div>
                  <h3 className={styles.cardHeading} id="feature-card-2-title">My Records</h3>
                  <p className={styles.cardBodyText}>
                    Private attendance history and exact ledger balance read strictly by your authenticated member account.
                  </p>
                </div>

                {/* 03 Ask About The Gym */}
                <div className={styles.featureCard} aria-labelledby="feature-card-3-title">
                  <div className={styles.cardBadgeNumber} aria-hidden="true">03</div>
                  <h3 className={styles.cardHeading} id="feature-card-3-title">Ask About The Gym</h3>
                  <p className={styles.cardBodyText}>
                    Direct answers grounded only in the gym&apos;s approved written records. Outdated or missing answers are never guessed.
                  </p>
                </div>

                {/* 04 Pay & Renew */}
                <div className={styles.featureCard} aria-labelledby="feature-card-4-title">
                  <div className={styles.cardBadgeNumber} aria-hidden="true">04</div>
                  <h3 className={styles.cardHeading} id="feature-card-4-title">Pay &amp; Renew</h3>
                  <p className={styles.cardBodyText}>
                    Renew subscriptions or clear arrears via Flutterwave. Confirmed payments extend your membership instantly.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Site Footer */}
      <footer className={styles.footer} id="site-footer" aria-label="Site Footer">
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            Spotter &bull; Gym Member System
          </div>
          <nav className={styles.footerLinks} aria-label="Legal documents">
            <button
              type="button"
              onClick={onViewPrivacy}
              className={styles.footerLink}
              id="link-footer-privacy"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={onViewTerms}
              className={styles.footerLink}
              id="link-footer-terms"
            >
              Terms of Service
            </button>
          </nav>
        </div>
      </footer>
    </div>
  );
}
