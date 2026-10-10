'use client';

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';

interface CachedStatus {
  tier: string;
  expiry: string;
  daysTrained: number;
  balanceKobo: number;
  asOf: string;
}

const QUICK_QUESTIONS = [
  'Timetable',
  'Prices',
  'Rules',
  'Access hours',
  'Guest policy',
  'Pause & cancellation terms',
  'How many days did I train this month?',
  'Do I owe anything?',
];

export default function MemberHomeScreen() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [questionText, setQuestionText] = useState<string>('');
  const [networkNotice, setNetworkNotice] = useState<string | null>(null);

  // Initial cached status fallback (loads immediately offline or before server refresh)
  const [status, setStatus] = useState<CachedStatus>({
    tier: 'Premium',
    expiry: '28 October 2026',
    daysTrained: 0,
    balanceKobo: 0,
    asOf: 'Today, 08:00',
  });

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setNetworkNotice(null);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleActionClick = (actionName: string) => {
    if (!isOnline) {
      setNetworkNotice('You need data for this.');
      return;
    }
    setNetworkNotice(null);
    // Action handler implementation will connect to routes in subsequent phases
  };

  const handleQuestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      setNetworkNotice('You need data to ask a question.');
      return;
    }
    if (!questionText.trim()) return;
    // Query pipeline will connect in subsequent phases
  };

  const formattedBalance =
    status.balanceKobo === 0
      ? '0 naira'
      : `${(status.balanceKobo / 100).toLocaleString()} naira`;

  return (
    <div className={styles.screenContainer}>
      {/* 1. Cached Status Card with 'as of' time */}
      <section className={styles.statusCard} aria-label="Member Status">
        <div className={styles.statusHeader}>
          <span className={styles.tierBadge}>{status.tier}</span>
          <span className={styles.asOfText}>as of {status.asOf}</span>
        </div>
        <div className={styles.statusGrid}>
          <div className={styles.metricCol}>
            <span className={styles.metricLabel}>Expiry</span>
            <span className={styles.metricValue}>{status.expiry}</span>
          </div>
          <div className={styles.metricCol}>
            <span className={styles.metricLabel}>Days trained</span>
            <span className={styles.metricValue}>{status.daysTrained}</span>
          </div>
          <div className={styles.metricCol}>
            <span className={styles.metricLabel}>Balance</span>
            <span className={styles.metricValue}>{formattedBalance}</span>
          </div>
        </div>
      </section>

      {/* 2. Three Primary Buttons: Check in, Pay, Ask the desk */}
      <nav className={styles.actionRow} aria-label="Primary Actions">
        <button
          type="button"
          className={styles.primaryAction}
          onClick={() => handleActionClick('Check in')}
          id="btn-check-in"
        >
          Check in
        </button>
        <button
          type="button"
          className={styles.secondaryAction}
          onClick={() => handleActionClick('Pay')}
          id="btn-pay"
        >
          Pay
        </button>
        <button
          type="button"
          className={styles.secondaryAction}
          onClick={() => handleActionClick('Ask the desk')}
          id="btn-ask-desk"
        >
          Ask the desk
        </button>
      </nav>

      {/* Offline Network Notice */}
      {networkNotice && (
        <div role="alert" className={styles.asOfText} style={{ textAlign: 'center' }}>
          {networkNotice}
        </div>
      )}

      {/* 3. Eight Tappable Questions */}
      <section className={styles.questionsBlock} aria-label="Quick Questions">
        <span className={styles.blockTitle}>Quick questions</span>
        <div className={styles.chipsContainer}>
          {QUICK_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              type="button"
              className={styles.questionChip}
              onClick={() => {
                if (!isOnline) {
                  setNetworkNotice('You need data to ask a question.');
                } else {
                  setQuestionText(q);
                }
              }}
              title={q}
            >
              {q}
            </button>
          ))}
        </div>
      </section>

      {/* 4. Text Box: Ask a question */}
      <form onSubmit={handleQuestionSubmit} className={styles.inputRow}>
        <input
          type="text"
          className={styles.textInput}
          placeholder="Ask a question..."
          value={questionText}
          maxLength={300}
          onChange={(e) => setQuestionText(e.target.value)}
          aria-label="Ask a question"
          id="input-ask-question"
        />
        <button type="submit" className={styles.submitBtn} id="btn-submit-question">
          Ask
        </button>
      </form>
    </div>
  );
}
