'use client';

import React from 'react';
import Link from 'next/link';
import styles from './LegalPageLayout.module.css';

interface LegalPageLayoutProps {
  title: string;
  eyebrow: string;
  lastUpdated: string;
  activePage: 'privacy' | 'terms';
  onBackToHome?: () => void;
  onSelectView?: (view: 'privacy' | 'terms') => void;
  children: React.ReactNode;
}

export default function LegalPageLayout({
  title,
  eyebrow,
  lastUpdated,
  activePage,
  onBackToHome,
  onSelectView,
  children,
}: LegalPageLayoutProps) {
  return (
    <div className={styles.pageContainer}>
      {/* Sticky Header */}
      <header className={styles.header}>
        {onBackToHome ? (
          <button
            type="button"
            onClick={onBackToHome}
            className={styles.brandButton}
            aria-label="Spotter Home"
          >
            <div className={styles.brandLogo}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 32 32"
                width="32"
                height="32"
                aria-hidden="true"
              >
                <rect width="32" height="32" rx="4" fill="#0044e3" />
                <text
                  x="16"
                  y="23"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fontSize="20"
                  fontWeight="700"
                  fill="#ffffff"
                  textAnchor="middle"
                >
                  S
                </text>
              </svg>
            </div>
            <span className={styles.brandTitle}>Spotter</span>
          </button>
        ) : (
          <Link href="/" className={styles.brandLink} aria-label="Spotter Home">
            <div className={styles.brandLogo}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 32 32"
                width="32"
                height="32"
                aria-hidden="true"
              >
                <rect width="32" height="32" rx="4" fill="#0044e3" />
                <text
                  x="16"
                  y="23"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fontSize="20"
                  fontWeight="700"
                  fill="#ffffff"
                  textAnchor="middle"
                >
                  S
                </text>
              </svg>
            </div>
            <span className={styles.brandTitle}>Spotter</span>
          </Link>
        )}

        {onBackToHome ? (
          <button
            type="button"
            onClick={onBackToHome}
            className={styles.backButton}
            id="btn-back-home"
          >
            &larr; Back to Home
          </button>
        ) : (
          <Link href="/" className={styles.backButton} id="btn-back-home">
            &larr; Back to Home
          </Link>
        )}
      </header>

      {/* Main Legal Document Content */}
      <main className={styles.main}>
        <div className={styles.heroHeader}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h1 className={styles.pageTitle}>{title}</h1>
          <div className={styles.lastUpdated}>{lastUpdated}</div>
        </div>

        <div className={styles.contentCard}>{children}</div>
      </main>

      {/* Footer Section */}
      <footer className={styles.footer} id="site-footer">
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            Spotter &bull; Gym Member System
          </div>
          <div className={styles.footerLinks}>
            {onSelectView ? (
              <button
                type="button"
                onClick={() => onSelectView('privacy')}
                className={`${styles.footerLink} ${activePage === 'privacy' ? styles.activeFooterLink : ''}`}
                id="link-footer-privacy"
              >
                Privacy Policy
              </button>
            ) : (
              <Link
                href="/privacy"
                className={`${styles.footerLink} ${activePage === 'privacy' ? styles.activeFooterLink : ''}`}
                id="link-footer-privacy"
              >
                Privacy Policy
              </Link>
            )}
            {onSelectView ? (
              <button
                type="button"
                onClick={() => onSelectView('terms')}
                className={`${styles.footerLink} ${activePage === 'terms' ? styles.activeFooterLink : ''}`}
                id="link-footer-terms"
              >
                Terms of Service
              </button>
            ) : (
              <Link
                href="/terms"
                className={`${styles.footerLink} ${activePage === 'terms' ? styles.activeFooterLink : ''}`}
                id="link-footer-terms"
              >
                Terms of Service
              </Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
