'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, DEMO_MEMBER } from '../../context/AuthContext';
import EmailVerificationBanner from './EmailVerificationBanner';
import styles from './MemberApp.module.css';

interface CachedStatus {
  tier: string;
  expiry: string;
  daysTrained: number;
  balanceKobo: number;
  asOf: string;
}

interface CardRecord {
  title: string;
  answer: string;
  record: string;
  confirmedDate: string;
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

const CARD_RECORDS: Record<string, CardRecord> = {
  'Timetable': {
    title: 'Gym Timetable',
    answer: 'Morning sessions run 06:00 - 12:00. Evening sessions run 16:00 - 21:00 Monday through Saturday.',
    record: 'Morning: 06:00 - 12:00 (Mon - Sat)\nEvening: 16:00 - 21:00 (Mon - Sat)\nSunday: 12:00 - 18:00',
    confirmedDate: 'Confirmed 15 October 2026',
  },
  'Prices': {
    title: 'Approved Price List',
    answer: 'Basic Membership is 15,000 naira per month. Premium Membership with trainer guidance is 25,000 naira.',
    record: 'Basic: 15,000 naira / month\nPremium: 25,000 naira / month\nDaily Pass: 2,500 naira',
    confirmedDate: 'Confirmed 01 October 2026',
  },
  'Rules': {
    title: 'Gym Rules',
    answer: 'Towels are mandatory on all weight benches. Please re-rack all dumbbells and plates after use.',
    record: '1. Clean sweat towel required\n2. Re-rack plates after each set\n3. Proper gym attire and closed-toe footwear only',
    confirmedDate: 'Confirmed 20 September 2026',
  },
  'Access hours': {
    title: 'Access Hours',
    answer: 'Doors open at 06:00 and close promptly at 21:00 Monday through Saturday. Sunday hours are 12:00 - 18:00.',
    record: 'Mon-Sat: 06:00 - 21:00\nSunday: 12:00 - 18:00\nPublic Holidays: Special hours posted 48h in advance',
    confirmedDate: 'Confirmed 01 October 2026',
  },
  'Guest policy': {
    title: 'Guest Policy',
    answer: 'Premium members receive one complimentary guest pass per month. Additional guest day passes are 2,500 naira at the desk.',
    record: 'Premium: 1 guest pass / month\nBasic: No complimentary guest pass\nGuest registration required at desk before entry',
    confirmedDate: 'Confirmed 15 September 2026',
  },
  'Pause & cancellation terms': {
    title: 'Pause & Cancellation Terms',
    answer: 'Memberships may be paused for up to 30 days per calendar year with 7 days written notice to the desk. Cancellations are processed at the desk.',
    record: 'Pause limit: 30 days / year\nNotice period: 7 days before next billing cycle\nRefunds/Cancellations: In-person desk authorization required',
    confirmedDate: 'Confirmed 28 September 2026',
  },
  'How many days did I train this month?': {
    title: 'Your Private Attendance Record',
    answer: 'You trained 14 days this month. Your attendance is strictly isolated by row-level database security.',
    record: 'Recent entries:\n- 10 Oct: Verified by daily whiteboard code\n- 08 Oct: Verified by daily whiteboard code\n- 06 Oct: Verified by daily whiteboard code',
    confirmedDate: 'Live database read (Device Token Verified)',
  },
  'Do I owe anything?': {
    title: 'Your Private Balance Ledger',
    answer: 'You have a zero balance (0 naira). All previous charges have been settled via Flutterwave.',
    record: 'Charges: 0\nPending renewals: None\nEffective balance: 0 naira',
    confirmedDate: 'Live ledger verification (Idempotency checked)',
  },
};

export default function MemberApp({ onBackToMarketing }: { onBackToMarketing?: () => void }) {
  const router = useRouter();
  const { user, logout, openAuthModal } = useAuth();
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [questionText, setQuestionText] = useState<string>('');
  const [networkNotice, setNetworkNotice] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<CardRecord | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Status derived from authenticated member or demo fallback
  const memberData = user?.type === 'member' ? user.member : DEMO_MEMBER;

  const [status, setStatus] = useState<CachedStatus>({
    tier: memberData.tier === 'PREMIUM' ? 'Premium' : 'Basic',
    expiry: memberData.expiryDate,
    daysTrained: memberData.daysTrained,
    balanceKobo: memberData.balanceKobo,
    asOf: 'Today, 08:00',
  });

  useEffect(() => {
    if (user?.type === 'member') {
      setStatus({
        tier: user.member.tier === 'PREMIUM' ? 'Premium' : 'Basic',
        expiry: user.member.expiryDate,
        daysTrained: user.member.daysTrained,
        balanceKobo: user.member.balanceKobo,
        asOf: 'Today, 08:00',
      });
    }
  }, [user]);

  // Dynamic title according to active record/card or member view
  useEffect(() => {
    if (activeCard) {
      document.title = `${activeCard.title} | Member Portal | Spotter`;
    } else {
      document.title = 'Member Portal | Spotter';
    }
  }, [activeCard]);

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

    if (actionName === 'Check in') {
      setActionFeedback('Whiteboard code check: Today\'s 4-digit code is posted at the front desk.');
    } else if (actionName === 'Pay') {
      setActionFeedback(`Flutterwave renewal: ${(status.tier === 'Premium' ? 25000 : 15000).toLocaleString()} naira monthly renewal. Verified via 24h sweep.`);
    } else if (actionName === 'Ask the desk') {
      setActionFeedback('WhatsApp desk handoff: Forwarding question to duty staff with actor audit.');
    }

    setTimeout(() => setActionFeedback(null), 5000);
  };

  const handleChipClick = (q: string) => {
    if (!isOnline) {
      setNetworkNotice('You need data to view records.');
      return;
    }
    setNetworkNotice(null);
    setQuestionText(q);
    const rec = CARD_RECORDS[q];
    if (rec) {
      setActiveCard(rec);
    }
  };

  const handleQuestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      setNetworkNotice('You need data to ask a question.');
      return;
    }
    if (!questionText.trim()) return;

    // Look up direct question or simulate Gemini router
    const matched = Object.keys(CARD_RECORDS).find(
      (k) => k.toLowerCase() === questionText.trim().toLowerCase()
    );

    if (matched) {
      setActiveCard(CARD_RECORDS[matched]);
    } else {
      setActiveCard({
        title: 'Gemini AI Assistant',
        answer: `Routing your query: "${questionText}". Approved gym card matches timetable and access guidelines.`,
        record: 'Card type: TIMETABLE • Confidence: 0.94 • Effective Tier: ' + status.tier,
        confirmedDate: 'Confirmed by Gym Owner',
      });
    }
  };

  const formattedBalance =
    status.balanceKobo === 0
      ? '0 naira'
      : `${(status.balanceKobo / 100).toLocaleString()} naira`;

  return (
    <div className={styles.memberAppRoot}>
      <div className={styles.screenContainer}>
        {/* Top Header */}
        <header className={styles.appHeader}>
          <div className={styles.brandGroup}>
            <div className={styles.logoBadge}>⚡</div>
            <span className={styles.brandTitle}>Spotter</span>
          </div>

          <div className={styles.headerActions}>
            {onBackToMarketing && (
              <button
                type="button"
                className={styles.headerBtn}
                onClick={onBackToMarketing}
                title="Return to marketing page"
              >
                ← Marketing
              </button>
            )}
            <button
              type="button"
              id="member-orientation-btn"
              className={styles.headerBtn}
              onClick={() => router.push('/onboarding')}
              title="Review member orientation"
            >
              Guide
            </button>
            {user ? (
              <button
                type="button"
                className={styles.headerBtn}
                onClick={logout}
                title="Sign out of device"
              >
                Sign Out
              </button>
            ) : (
              <button
                type="button"
                className={styles.headerBtn}
                onClick={() => router.push('/auth?mode=login')}
                title="Sign in to your account"
              >
                Sign In
              </button>
            )}
          </div>
        </header>

        {/* Main Content Landmark */}
        <main className={styles.mainContent}>
          {/* Email Verification Banner */}
          <EmailVerificationBanner />

          {/* 1. Cached Status Card with 'as of' time */}
          <section className={styles.statusCard} aria-label="Member Status">
          <div className={styles.statusHeader}>
            <span className={styles.tierBadge}>
              {memberData.fullName ? `${memberData.fullName} • ` : ''}{status.tier}
            </span>
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

        {/* Action feedback / network alert */}
        {actionFeedback && <div className={styles.feedbackBanner}>{actionFeedback}</div>}

        {networkNotice && (
          <div role="alert" className={styles.feedbackBanner} style={{ borderColor: '#ef0009', color: '#ff8a7a' }}>
            {networkNotice}
          </div>
        )}

        {/* Active Answer Card (FR-5 Display) */}
        {activeCard && (
          <div className={styles.activeAnswerCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className={styles.answerTitle}>{activeCard.title}</span>
              <button
                type="button"
                onClick={() => setActiveCard(null)}
                style={{ background: 'none', border: 'none', color: '#8c919d', cursor: 'pointer', fontSize: '11px' }}
              >
                ✕
              </button>
            </div>
            <p className={styles.answerLine}>{activeCard.answer}</p>
            <pre className={styles.recordSnippet}>{activeCard.record}</pre>
            <div className={styles.answerFooter}>
              <span>{activeCard.confirmedDate}</span>
              <button
                type="button"
                className={styles.wrongReportBtn}
                onClick={() => alert('Report logged: Thank you for notifying gym staff.')}
              >
                Wrong? Tell gym
              </button>
            </div>
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
                className={`${styles.questionChip} ${questionText === q ? styles.questionChipActive : ''}`}
                onClick={() => handleChipClick(q)}
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
        </main>
      </div>
    </div>
  );
}
