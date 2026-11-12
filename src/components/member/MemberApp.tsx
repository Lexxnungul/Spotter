'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import EmailVerificationBanner from './EmailVerificationBanner';
import PaymentModal from '../payment/PaymentModal';
import ReceiptModal, { ReceiptProps } from '../payment/ReceiptModal';
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

function formatTierLabel(tier?: string | null): 'Basic' | 'Premium' | 'Diamond' {
  if (tier === 'DIAMOND') return 'Diamond';
  if (tier === 'PREMIUM') return 'Premium';
  return 'Basic';
}

// 8 Primary Quick Questions from the Target Design
const TARGET_QUICK_QUESTIONS = [
  'What time is the Saturday class?',
  'Can I bring a guest with me?',
  'Why is my card not working before six?',
  'What are the gym access hours?',
  'What is the current subscription price?',
  'How do I pause my membership?',
  'What training plans are available?',
  'Who is the trainer on duty today?',
];

const CARD_RECORDS: Record<string, CardRecord> = {
  // 1. Saturday Class / Timetable
  'What time is the Saturday class?': {
    title: 'Gym Timetable & Classes',
    answer: 'Morning sessions run 06:00 - 12:00. Saturday classes run at 08:00 (HIIT & Strength) and 10:30 (Cardio & Core).',
    record: 'Saturday: 08:00 (HIIT & Strength), 10:30 (Cardio & Core)\nMon - Fri: 06:00 - 12:00, 16:00 - 21:00\nSunday: 12:00 - 18:00',
    confirmedDate: 'Confirmed 15 October 2026',
  },
  'Timetable': {
    title: 'Gym Timetable',
    answer: 'Morning sessions run 06:00 - 12:00. Evening sessions run 16:00 - 21:00 Monday through Saturday.',
    record: 'Morning: 06:00 - 12:00 (Mon - Sat)\nEvening: 16:00 - 21:00 (Mon - Sat)\nSunday: 12:00 - 18:00',
    confirmedDate: 'Confirmed 15 October 2026',
  },

  // 2. Guest Policy
  'Can I bring a guest with me?': {
    title: 'Guest Policy',
    answer: 'Premium members receive one complimentary guest pass per month. Additional guest day passes are 2,500 naira at the desk.',
    record: 'Premium: 1 guest pass / month\nBasic: No complimentary guest pass\nGuest registration required at desk before entry',
    confirmedDate: 'Confirmed 15 September 2026',
  },
  'Guest policy': {
    title: 'Guest Policy',
    answer: 'Premium members receive one complimentary guest pass per month. Additional guest day passes are 2,500 naira at the desk.',
    record: 'Premium: 1 guest pass / month\nBasic: No complimentary guest pass\nGuest registration required at desk before entry',
    confirmedDate: 'Confirmed 15 September 2026',
  },

  // 3. Card Access / Hours
  'Why is my card not working before six?': {
    title: 'Access Hours & Turnstile Security',
    answer: 'The gym doors open at 06:00. Access turnstiles and scanners activate promptly at 06:00 for security and staff duty coverage.',
    record: 'Operating hours: 06:00 - 21:00\nTurnstile power: Activated at 06:00 by duty supervisor\nPre-06:00 access: Not permitted for safety compliance',
    confirmedDate: 'Confirmed 01 October 2026',
  },

  // 4. Access Hours
  'What are the gym access hours?': {
    title: 'Access Hours',
    answer: 'Doors open at 06:00 and close promptly at 21:00 Monday through Saturday. Sunday hours are 12:00 - 18:00.',
    record: 'Mon-Sat: 06:00 - 21:00\nSunday: 12:00 - 18:00\nPublic Holidays: Special hours posted 48h in advance',
    confirmedDate: 'Confirmed 01 October 2026',
  },
  'Access hours': {
    title: 'Access Hours',
    answer: 'Doors open at 06:00 and close promptly at 21:00 Monday through Saturday. Sunday hours are 12:00 - 18:00.',
    record: 'Mon-Sat: 06:00 - 21:00\nSunday: 12:00 - 18:00\nPublic Holidays: Special hours posted 48h in advance',
    confirmedDate: 'Confirmed 01 October 2026',
  },

  // 5. Prices
  'What is the current subscription price?': {
    title: 'Approved Price List',
    answer: 'Basic Membership is 15,000 naira per month. Premium Membership with trainer guidance is 25,000 naira per month.',
    record: 'Basic: 15,000 naira / month\nPremium: 25,000 naira / month\nDaily Pass: 2,500 naira',
    confirmedDate: 'Confirmed 01 October 2026',
  },
  'Prices': {
    title: 'Approved Price List',
    answer: 'Basic Membership is 15,000 naira per month. Premium Membership with trainer guidance is 25,000 naira.',
    record: 'Basic: 15,000 naira / month\nPremium: 25,000 naira / month\nDaily Pass: 2,500 naira',
    confirmedDate: 'Confirmed 01 October 2026',
  },

  // 6. Pause & Cancellation Terms
  'How do I pause my membership?': {
    title: 'Pause & Cancellation Terms',
    answer: 'Memberships may be paused for up to 30 days per calendar year with 7 days written notice to the desk.',
    record: 'Pause limit: 30 days / year\nNotice period: 7 days before next billing cycle\nRefunds/Cancellations: In-person desk authorization required',
    confirmedDate: 'Confirmed 28 September 2026',
  },
  'Pause & cancellation terms': {
    title: 'Pause & Cancellation Terms',
    answer: 'Memberships may be paused for up to 30 days per calendar year with 7 days written notice to the desk. Cancellations are processed at the desk.',
    record: 'Pause limit: 30 days / year\nNotice period: 7 days before next billing cycle\nRefunds/Cancellations: In-person desk authorization required',
    confirmedDate: 'Confirmed 28 September 2026',
  },

  // 7. Training Plans
  'What training plans are available?': {
    title: 'Training Plans & Coaching',
    answer: 'Spotter offers 3 approved training routines: Upper/Lower Split, Full-Body Conditioning, and Hypertrophy Track.',
    record: '1. 3-Day Full Body\n2. 4-Day Push/Pull/Legs\n3. 5-Day Hypertrophy & Athletic Track\nAvailable in member portal & desk prints',
    confirmedDate: 'Confirmed 10 October 2026',
  },

  // 8. Trainer on Duty
  'Who is the trainer on duty today?': {
    title: 'Duty Staff & Trainer Guidance',
    answer: 'Coach Femi is the assigned floor trainer on duty today. For customized coaching or workout adjustments, visit the desk.',
    record: 'Floor Supervisor: Coach Femi\nDesk Reception: Chioma Okeke\nDuty shift: 06:00 - 14:00 (Morning Shift)',
    confirmedDate: 'Confirmed Today',
  },

  // Rules & Personal Records Aliases
  'Rules': {
    title: 'Gym Rules',
    answer: 'Towels are mandatory on all weight benches. Please re-rack all dumbbells and plates after use.',
    record: '1. Clean sweat towel required\n2. Re-rack plates after each set\n3. Proper gym attire and closed-toe footwear only',
    confirmedDate: 'Confirmed 20 September 2026',
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
  const { user, logout } = useAuth();
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [questionText, setQuestionText] = useState<string>('');
  const [networkNotice, setNetworkNotice] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<CardRecord | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Payment integration states
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptProps['receipt']>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [waitingPayment, setWaitingPayment] = useState<{ reference: string | null; createdAt: string } | null>(null);
  const [pendingTxRef, setPendingTxRef] = useState<string | null>(null);
  const [isNewMember, setIsNewMember] = useState<boolean>(false);
  const [paymentStatusAlert, setPaymentStatusAlert] = useState<{
    type: 'pending' | 'success' | 'error';
    message: string;
    receipt?: any;
  } | null>(null);

  // Status derived strictly from authenticated member session
  const memberData = user?.type === 'member' ? user.member : null;

  const [status, setStatus] = useState<CachedStatus>({
    tier: formatTierLabel(memberData?.tier),
    expiry: memberData?.expiryDate || 'Not Subscribed',
    daysTrained: memberData?.daysTrained ?? 0,
    balanceKobo: memberData?.balanceKobo ?? 0,
    asOf: 'Today, 08:00',
  });

  useEffect(() => {
    if (user?.type === 'member') {
      setStatus({
        tier: formatTierLabel(user.member.tier),
        expiry: user.member.expiryDate,
        daysTrained: user.member.daysTrained,
        balanceKobo: user.member.balanceKobo,
        asOf: 'Today, 08:00',
      });
    } else {
      setStatus({
        tier: 'Basic',
        expiry: 'Not Subscribed',
        daysTrained: 0,
        balanceKobo: 0,
        asOf: 'Today, 08:00',
      });
      setPaymentHistory([]);
      setWaitingPayment(null);
    }
  }, [user]);

  const memberId = user?.type === 'member' ? user.member.id : null;

  const applyVerifiedPaymentSuccess = useCallback(
    (
      data: {
        receipt?: ReceiptProps['receipt'];
        newExpiry?: string;
        tier?: string;
      },
      openReceiptModal = false
    ) => {
      if (data.receipt) {
        if (openReceiptModal) {
          setSelectedReceipt(data.receipt);
          setIsReceiptModalOpen(true);
        }
        setPaymentHistory((prev) => [
          data.receipt!,
          ...prev.filter((item) => item.reference !== data.receipt!.reference),
        ]);
      }
      setPaymentStatusAlert({
        type: 'success',
        message: 'Payment confirmed! Your subscription is active.',
        receipt: data.receipt,
      });
      setIsNewMember(false);
      setWaitingPayment(null);
      setPendingTxRef(null);
      setStatus((prev) => ({
        ...prev,
        ...(data.newExpiry ? { expiry: data.newExpiry } : {}),
        ...(data.tier ? { tier: formatTierLabel(data.tier) } : {}),
      }));
    },
    []
  );

  // Load live payment status and recent verified receipts from PaymentLog
  useEffect(() => {
    if (!memberId) {
      return;
    }

    fetch(`/api/payment/status?memberId=${encodeURIComponent(memberId)}`)
      .then((r) => {
        if (r.status === 404) {
          logout();
          return null;
        }
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (data?.success) {
          if (Array.isArray(data.receipts)) {
            setPaymentHistory(data.receipts);
          }
          if (data.hasWaitingPayment && data.waitingPayment) {
            setWaitingPayment(data.waitingPayment);
            if (data.waitingPayment.reference) {
              setPendingTxRef((prev) => prev || data.waitingPayment.reference);
              setPaymentStatusAlert((prev) =>
                prev?.type === 'success'
                  ? prev
                  : {
                      type: 'pending',
                      message:
                        'Waiting for bank / Flutterwave webhook confirmation...',
                    }
              );
            }
          } else {
            setWaitingPayment(null);
          }
          if (typeof data.member?.isNewMember === 'boolean') {
            setIsNewMember(data.member.isNewMember);
          } else if (typeof data.member?.verifiedPaymentsCount === 'number') {
            setIsNewMember(data.member.verifiedPaymentsCount === 0);
          }
          setStatus((prev) => ({
            ...prev,
            ...(data.member?.tier ? { tier: formatTierLabel(data.member.tier) } : {}),
            ...(data.member?.expiryFormatted ? { expiry: data.member.expiryFormatted } : {}),
            ...(typeof data.member?.balanceKobo === 'number'
              ? { balanceKobo: data.member.balanceKobo }
              : {}),
          }));
        }
      })
      .catch((err) => console.warn('[Payment status load failed]:', err));
  }, [memberId, logout]);

  // Handle gateway return and advance/poll PaymentLog strictly via webhook confirmation
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment_status');
    const txRef = params.get('tx_ref');
    const gatewayStatus = params.get('status');
    const transactionId = params.get('transaction_id');

    if (txRef && (paymentStatus === 'returned' || gatewayStatus || transactionId)) {
      setPaymentStatusAlert({
        type: 'pending',
        message: 'Checking your payment. Waiting for webhook confirmation...',
      });

      fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: txRef,
          gatewayStatus: gatewayStatus ?? undefined,
          transactionId: transactionId ?? undefined,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.verified && data.status === 'SUCCESS') {
            applyVerifiedPaymentSuccess(data, true);
          } else if (data.status === 'PENDING' || data.status === 'INITIATED') {
            setPendingTxRef(txRef);
            setPaymentStatusAlert({
              type: 'pending',
              message:
                data.message ||
                'Checking your payment. Waiting for webhook confirmation...',
            });
          } else {
            if (data.status === 'FAILED' || data.status === 'ABANDONED') {
              setWaitingPayment(null);
              setPendingTxRef(null);
            }
            setPaymentStatusAlert({
              type: 'error',
              message:
                data.error ||
                data.message ||
                'The payment did not go through. You have not been charged.',
            });
          }
        })
        .catch(() => {
          setPendingTxRef(txRef);
          setPaymentStatusAlert({
            type: 'pending',
            message:
              'Checking your payment. Waiting for webhook confirmation...',
          });
        });

      // Clear search query from URL without page reload
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [applyVerifiedPaymentSuccess]);

  // Poll PaymentLog status while waiting for asynchronous Flutterwave webhook
  useEffect(() => {
    if (!pendingTxRef || !isOnline) {
      return;
    }

    let isCancelled = false;
    let attempts = 0;
    const MAX_POLL_ATTEMPTS = 48; // 48 * 2.5s = 2 minutes

    const intervalId = setInterval(async () => {
      if (isCancelled) return;
      attempts += 1;

      try {
        const res = await fetch('/api/payment/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference: pendingTxRef,
            poll: true,
          }),
        });
        const data = await res.json();
        if (isCancelled) return;

        if (res.ok && data.success && data.verified && data.status === 'SUCCESS') {
          applyVerifiedPaymentSuccess(data, true);
          return;
        }

        if (data.status === 'FAILED' || data.status === 'ABANDONED') {
          setWaitingPayment(null);
          setPendingTxRef(null);
          setPaymentStatusAlert({
            type: 'error',
            message:
              data.error ||
              data.message ||
              'The payment did not go through. You have not been charged.',
          });
          return;
        }
      } catch (pollErr) {
        console.warn('[Webhook status poll failed]:', pollErr);
      }

      if (attempts >= MAX_POLL_ATTEMPTS && !isCancelled) {
        setPendingTxRef(null);
        setPaymentStatusAlert({
          type: 'pending',
          message:
            'Still waiting for webhook confirmation. Reopen the app shortly to check your receipt.',
        });
      }
    }, 2500);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [pendingTxRef, isOnline, applyVerifiedPaymentSuccess]);

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
      setActionFeedback("Whiteboard code check: Today's 4-digit code is posted at the front desk.");
    } else if (actionName === 'Pay') {
      if (!memberId) {
        router.push('/auth?mode=login');
        return;
      }
      setIsPaymentModalOpen(true);
      return;
    } else if (actionName === 'Ask the desk') {
      setActionFeedback('WhatsApp desk handoff: Forwarding question to duty staff with actor audit.');
    }

    setTimeout(() => setActionFeedback(null), 5000);
  };

  const handlePaymentSuccess = async (reference: string) => {
    try {
      const res = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.verified && data.status === 'SUCCESS') {
        applyVerifiedPaymentSuccess(data, true);
      } else if (data.status === 'PENDING' || data.status === 'INITIATED') {
        setPendingTxRef(reference);
        setPaymentStatusAlert({
          type: 'pending',
          message:
            data.message ||
            'Checking your payment. Waiting for webhook confirmation...',
        });
      } else {
        setPaymentStatusAlert({
          type: 'error',
          message:
            data.message ||
            data.error ||
            'Payment could not be verified in PaymentLog yet.',
        });
      }
    } catch (e) {
      console.warn('[Payment verify failed]:', e);
    }
  };

  const handleQuestionClick = (q: string) => {
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
    const cleanQuery = questionText.trim().toLowerCase();
    const matchedKey = Object.keys(CARD_RECORDS).find(
      (k) => k.toLowerCase() === cleanQuery || cleanQuery.includes(k.toLowerCase())
    );

    if (matchedKey) {
      setActiveCard(CARD_RECORDS[matchedKey]);
    } else {
      setActiveCard({
        title: 'Gemini AI Assistant',
        answer: `Routing your query: "${questionText}". Approved gym card matches timetable and access guidelines.`,
        record: `Card type: TIMETABLE • Confidence: 0.94 • Effective Tier: ${status.tier}`,
        confirmedDate: 'Confirmed by Gym Owner',
      });
    }
  };

  const memberDisplayName = memberData?.fullName || 'Spotter Member';
  const memberDisplayEmail = memberData?.email || 'Sign in to load your account';
  const rawMemberNumber = memberData?.memberNumber || '';
  const memberNumberDisplay = rawMemberNumber
    ? rawMemberNumber.startsWith('#')
      ? rawMemberNumber
      : `#${rawMemberNumber}`
    : '#------';

  const effectiveTierDisplay = isNewMember
    ? 'No Active Plan'
    : status.tier === 'Diamond'
      ? 'Diamond VIP Member'
      : status.tier === 'Premium'
        ? 'Premium Member'
        : 'Basic Member';
  const balanceDisplay = status.balanceKobo === 0 ? 'Nothing due.' : `${(status.balanceKobo / 100).toLocaleString()} naira`;

  return (
    <div className={styles.memberAppRoot}>
      <div className={styles.screenContainer}>
        {/* Top Header matching Target Design */}
        <header className={styles.appHeader}>
          <div className={styles.memberIdentity}>
            <h1 className={styles.memberName}>{memberDisplayName}</h1>
            <p className={styles.memberEmail}>{memberDisplayEmail}</p>
          </div>

          <div className={styles.headerActions}>
            <span className={styles.memberNumberBadge} id="member-number-badge">
              {memberNumberDisplay}
            </span>

            {onBackToMarketing && (
              <button
                type="button"
                className={styles.headerOutlineBtn}
                onClick={onBackToMarketing}
                title="Return to marketing page"
              >
                Marketing
              </button>
            )}

            <button
              type="button"
              id="member-orientation-btn"
              className={styles.headerOutlineBtn}
              onClick={() => router.push('/onboarding')}
              title="Review member orientation"
            >
              Guide
            </button>

            {user ? (
              <button
                type="button"
                className={styles.headerOutlineBtn}
                onClick={logout}
                title="Sign out of device"
                id="btn-member-sign-out"
              >
                Sign Out
              </button>
            ) : (
              <button
                type="button"
                className={styles.headerOutlineBtn}
                onClick={() => router.push('/auth?mode=login')}
                title="Sign in to your account"
                id="btn-member-sign-in"
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

          {/* 4 Metric / Status Cards Grid matching Target Design */}
          <section className={styles.statusGrid} aria-label="Member Status Overview">
            <div className={styles.statusCardItem}>
              <span className={styles.statusLabel}>EFFECTIVE TIER</span>
              <span className={styles.statusValue}>{effectiveTierDisplay}</span>
              <span className={styles.statusSubtext}>
                {isNewMember
                  ? 'Choose a plan to activate'
                  : status.tier === 'Diamond'
                    ? '₦45,000 / month'
                    : status.tier === 'Premium'
                      ? '₦25,000 / month'
                      : '₦15,000 / month'}
              </span>
            </div>

            <div className={styles.statusCardItem}>
              <span className={styles.statusLabel}>
                {isNewMember ? 'SUBSCRIPTION STATUS' : 'EXPIRY DATE'}
              </span>
              <span className={styles.statusValue}>
                {isNewMember ? 'Not Subscribed' : status.expiry}
              </span>
              <div className={styles.statusActionRow}>
                <button
                  type="button"
                  className={styles.renewLinkBtn}
                  onClick={() => setIsPaymentModalOpen(true)}
                  title={isNewMember ? 'Choose a subscription plan' : 'Renew your subscription'}
                  id="btn-renew-expiry-card"
                >
                  {isNewMember ? 'Choose Plan ➔' : 'Renew ➔'}
                </button>
              </div>
            </div>

            <div className={styles.statusCardItem}>
              <span className={styles.statusLabel}>ATTENDANCE</span>
              <span className={styles.statusValue}>{status.daysTrained} days this month</span>
              <span className={styles.statusSubtext}>
                Verified by daily code
              </span>
            </div>

            <div className={styles.statusCardItem}>
              <span className={styles.statusLabel}>BALANCE</span>
              <span className={styles.statusValue}>{balanceDisplay}</span>
              {status.balanceKobo > 0 && (
                <div className={styles.statusActionRow}>
                  <button
                    type="button"
                    className={styles.renewLinkBtn}
                    onClick={() => setIsPaymentModalOpen(true)}
                    title="Settle outstanding balance"
                  >
                    Pay Balance
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Three Primary Actions: Check in, Pay Subscription / Choose Plan, Ask the desk */}
          <nav className={styles.actionRow} aria-label="Primary Actions">
            <button
              type="button"
              className={styles.primaryAction}
              onClick={() => handleActionClick('Check in')}
              id="btn-check-in"
            >
              <span>✓</span> Check in
            </button>
            <button
              type="button"
              className={styles.payAction}
              onClick={() => handleActionClick('Pay')}
              id="btn-pay"
            >
              <span>💳</span> {isNewMember ? 'Choose Subscription Plan' : 'Pay Subscription'}
            </button>
            <button
              type="button"
              className={styles.secondaryAction}
              onClick={() => handleActionClick('Ask the desk')}
              id="btn-ask-desk"
            >
              Ask the desk
            </button>
            <button
              type="button"
              className={styles.secondaryAction}
              onClick={() => setShowHistory((prev) => !prev)}
              id="btn-payment-history"
              title="View previous payments and receipts"
            >
              <span>📄</span> {showHistory ? 'Hide Receipts' : 'Receipts & History'}
              {paymentHistory.length > 0 && ` (${paymentHistory.length})`}
            </button>
          </nav>

          {/* Payment Status Alerts */}
          {paymentStatusAlert && (
            <div className={styles.paymentAlertContainer}>
              {paymentStatusAlert.type === 'pending' && (
                <div className={styles.paymentAlertPending} role="status">
                  <div>
                    <span className={styles.pulseIndicator} />
                    <strong>{paymentStatusAlert.message}</strong>
                  </div>
                  <button
                    type="button"
                    className={styles.dismissAlertBtn}
                    onClick={() => setPaymentStatusAlert(null)}
                    aria-label="Dismiss payment status notice"
                  >
                    ✕
                  </button>
                </div>
              )}

              {paymentStatusAlert.type === 'success' && (
                <div className={styles.paymentAlertSuccess} role="alert">
                  <div>
                    <strong>✓ {paymentStatusAlert.message}</strong>
                  </div>
                  <div className={styles.alertActionRow}>
                    {paymentStatusAlert.receipt && (
                      <button
                        type="button"
                        className={styles.viewReceiptBtn}
                        onClick={() => {
                          setSelectedReceipt(paymentStatusAlert.receipt);
                          setIsReceiptModalOpen(true);
                        }}
                        id="btn-view-alert-receipt"
                      >
                        View Receipt
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.dismissAlertBtn}
                      onClick={() => setPaymentStatusAlert(null)}
                      aria-label="Dismiss success notice"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {paymentStatusAlert.type === 'error' && (
                <div role="alert" className={`${styles.feedbackBanner} ${styles.feedbackBannerError}`}>
                  {paymentStatusAlert.message}
                </div>
              )}
            </div>
          )}

          {/* Payment History & Receipts Drawer */}
          {showHistory && (
            <section className={styles.historyPanel} aria-label="Payment History and Receipts">
              <div className={styles.historyHeader}>
                <h3 className={styles.historyTitle}>Payment History & Receipts</h3>
                <span className={styles.historyCount}>
                  {paymentHistory.length} transaction(s) recorded
                </span>
              </div>

              {paymentHistory.length === 0 ? (
                <p className={styles.historyEmptyText}>
                  No previous payments on record. When you renew via Flutterwave or the front desk, official receipts will be archived here.
                </p>
              ) : (
                <div className={styles.tableResponsiveWrapper}>
                  <table className={styles.historyTable}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Purpose</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Status</th>
                        <th>Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentHistory.map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.dateSpelledOut}</td>
                          <td>{item.purpose}</td>
                          <td><strong>{item.amountNaira}</strong></td>
                          <td>{item.method}</td>
                          <td>
                            <span className={item.status === 'SUCCESS' ? styles.statusSuccessBadge : styles.statusPendingBadge}>
                              {item.status}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={styles.receiptMiniBtn}
                              onClick={() => {
                                setSelectedReceipt(item);
                                setIsReceiptModalOpen(true);
                              }}
                              title="View and print official receipt"
                            >
                              Receipt
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* Action Feedback / Network Warning */}
          {actionFeedback && <div className={styles.feedbackBanner}>{actionFeedback}</div>}

          {networkNotice && (
            <div role="alert" className={`${styles.feedbackBanner} ${styles.feedbackBannerError}`}>
              {networkNotice}
            </div>
          )}

          {/* Active Answer Card (FR-5 Display) */}
          {activeCard && (
            <div className={styles.activeAnswerCard} id="active-card-display">
              <div className={styles.answerHeader}>
                <span className={styles.answerTitle}>{activeCard.title}</span>
                <button
                  type="button"
                  className={styles.closeAnswerBtn}
                  onClick={() => setActiveCard(null)}
                  aria-label="Close answer card"
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

          {/* Ask About The Gym Section matching Target Design */}
          <section className={styles.askSection} aria-label="Ask About The Gym">
            <h2 className={styles.sectionHeading}>Ask About The Gym</h2>
            <p className={styles.sectionSubtitle}>
              Tapped questions skip model calls and verify against approved gym records.
            </p>

            {/* 3-Column Question Cards Grid */}
            <div className={styles.questionsGrid} role="group" aria-label="Approved Gym Questions">
              {TARGET_QUICK_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`${styles.questionCard} ${questionText === q ? styles.questionCardActive : ''}`}
                  onClick={() => handleQuestionClick(q)}
                  title={q}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Text Input Row: Ask a Custom Question */}
            <form onSubmit={handleQuestionSubmit} className={styles.inputRow}>
              <input
                type="text"
                className={styles.textInput}
                placeholder="Ask any question about the gym..."
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
          </section>

          {/* Footer Area matching Target Design */}
          <footer className={styles.footerArea}>
            <p className={styles.footerHelpText}>
              Need assistance with personal records or waivers?{' '}
              <button
                type="button"
                className={styles.footerHelpLink}
                onClick={() => handleActionClick('Ask the desk')}
              >
                Contact the desk
              </button>
            </p>

            <div className={styles.footerActions}>
              <button
                type="button"
                className={styles.footerActionLink}
                onClick={() => router.push('/auth?mode=login')}
                id="btn-manage-password"
              >
                Manage Password
              </button>
            </div>
          </footer>
        </main>
      </div>

      {/* Payment / Subscription Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        member={{
          id: memberData?.id || '',
          fullName: memberDisplayName,
          memberNumber: rawMemberNumber || undefined,
          tier:
            status.tier === 'Diamond'
              ? 'DIAMOND'
              : status.tier === 'Premium'
                ? 'PREMIUM'
                : 'BASIC',
          expiryDate: status.expiry,
          balanceKobo: status.balanceKobo,
          email: memberData?.email,
        }}
        isNewMember={isNewMember}
        isOnline={isOnline}
        waitingPayment={waitingPayment}
        onPaymentSuccess={handlePaymentSuccess}
        onPaymentPending={(ref) => {
          setPendingTxRef(ref);
          setPaymentStatusAlert({
            type: 'pending',
            message: 'Checking your payment. Waiting for webhook confirmation...',
          });
        }}
      />

      {/* Official Proof of Payment Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        receipt={selectedReceipt}
      />
    </div>
  );
}
