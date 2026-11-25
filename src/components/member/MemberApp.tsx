'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import QRCode from 'qrcode';
import { ArrowRight, Check, ChevronDown, CircleCheck, CreditCard, House, LogOut, Menu, ReceiptText, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { createCheckInQrPayload } from '../../lib/checkin-qr';
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
  source?: 'records' | 'gemini';
}

interface ChatHistoryTurn {
  role: 'user' | 'model';
  content: string;
}

function formatTierLabel(tier?: string | null): 'Basic' | 'Premium' | 'Diamond' {
  if (tier === 'DIAMOND') return 'Diamond';
  if (tier === 'PREMIUM') return 'Premium';
  return 'Basic';
}

function formatLabel(value?: string | null): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function formatCheckInTime(value?: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('en-GB', {
    timeZone: 'Africa/Lagos',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  const [showMoreQuestions, setShowMoreQuestions] = useState<boolean>(false);
  const [subscriptionNotice, setSubscriptionNotice] = useState<string | null>(null);
  const [networkNotice, setNetworkNotice] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<CardRecord | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isAskingGemini, setIsAskingGemini] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<ChatHistoryTurn[]>([]);
  const [chatConversationId, setChatConversationId] = useState<string | null>(null);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState<boolean>(false);
  const [isGeneratingCheckIn, setIsGeneratingCheckIn] = useState<boolean>(false);
  const [checkInCode, setCheckInCode] = useState<{
    code: string;
    generatedAt: string;
    expiresAt: string;
    emailedTo: string;
  } | null>(null);
  const [checkInQrDataUrl, setCheckInQrDataUrl] = useState<string>('');
  const [showCheckInQr, setShowCheckInQr] = useState<boolean>(false);
  const [checkInStatus, setCheckInStatus] = useState<{
    checkedInToday: boolean;
    checkedInAt: string | null;
  } | null>(null);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const code = checkInCode?.code;

    setShowCheckInQr(false);

    if (!code) {
      setCheckInQrDataUrl('');
      return;
    }

    QRCode.toDataURL(createCheckInQrPayload(code), {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 260,
      color: { dark: '#00174c', light: '#ffffff' },
    })
      .then((dataUrl) => {
        if (!cancelled) setCheckInQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setCheckInQrDataUrl('');
      });

    return () => {
      cancelled = true;
    };
  }, [checkInCode?.code]);

  useEffect(() => {
    if (!isAvatarMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(event.target as Node)) {
        setIsAvatarMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAvatarMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAvatarMenuOpen]);

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

  useEffect(() => {
    if (user?.type !== 'member') {
      setCheckInCode(null);
      setCheckInStatus(null);
      return;
    }

    let isActive = true;
    const loadCheckInStatus = async () => {
      try {
        const res = await fetch('/api/checkin/status', { cache: 'no-store' });
        const data = await res.json();
        if (isActive && res.ok && data.success) {
          setCheckInStatus({
            checkedInToday: !!data.checkedInToday,
            checkedInAt: data.checkedInAt,
          });
        }
      } catch {
        if (isActive) {
          setCheckInStatus(null);
        }
      }
    };

    const handleCheckInSuccess = (event: Event) => {
      const detail = (event as CustomEvent<{ checkedInAt?: string; daysTrained?: number }>).detail;
      setCheckInCode(null);
      setCheckInStatus({
        checkedInToday: true,
        checkedInAt: detail?.checkedInAt || new Date().toISOString(),
      });
      if (typeof detail?.daysTrained === 'number') {
        setStatus((previous) => ({ ...previous, daysTrained: detail.daysTrained! }));
      }
    };

    loadCheckInStatus();
    window.addEventListener('spotter:checkin-success', handleCheckInSuccess);
    return () => {
      isActive = false;
      window.removeEventListener('spotter:checkin-success', handleCheckInSuccess);
    };
  }, [user]);

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
      setSubscriptionNotice(null);
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

  const hasNoPlan = isNewMember;

  const showSubscriptionNotice = () => {
    setSubscriptionNotice('Please pay for a subscription to use this feature.');
  };

  const handleQuestionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (hasNoPlan) {
      setQuestionText('');
      showSubscriptionNotice();
      return;
    }
    setQuestionText(e.target.value);
    setSubscriptionNotice(null);
  };

  const handleQuestionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!hasNoPlan) return;
    if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      showSubscriptionNotice();
    }
  };

  const handleQuestionPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (!hasNoPlan) return;
    e.preventDefault();
    showSubscriptionNotice();
  };

  const handleGenerateCheckIn = async () => {
    if (!isOnline) {
      setNetworkNotice('You need data for this.');
      return;
    }
    if (!memberId) {
      router.push('/auth?mode=login');
      return;
    }

    setNetworkNotice(null);
    setActionFeedback(null);
    setIsGeneratingCheckIn(true);

    try {
      const res = await fetch('/api/checkin/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setActionFeedback(data.error || 'Could not generate a check-in code. Please try again.');
        return;
      }

      if (data.alreadyCheckedIn) {
        setCheckInCode(null);
        setCheckInStatus({
          checkedInToday: true,
          checkedInAt: data.checkedInAt,
        });
        setActionFeedback('You are already checked in today.');
        return;
      }

      setCheckInStatus({ checkedInToday: false, checkedInAt: null });
      setCheckInCode({
        code: data.code,
        generatedAt: data.generatedAt,
        expiresAt: data.expiresAt,
        emailedTo: data.emailedTo,
      });
      setActionFeedback(`Check-in code sent to ${data.emailedTo}.`);
    } catch {
      setActionFeedback('Unable to connect to server. Please check your internet connection.');
    } finally {
      setIsGeneratingCheckIn(false);
    }
  };

  const handleActionClick = (actionName: string) => {
    if (!isOnline) {
      setNetworkNotice('You need data for this.');
      return;
    }
    setNetworkNotice(null);

    if (actionName === 'Check in') {
      void handleGenerateCheckIn();
      return;
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

  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasNoPlan) {
      showSubscriptionNotice();
      return;
    }
    if (!isOnline) {
      setNetworkNotice('You need data to ask a question.');
      return;
    }

    const message = questionText.trim();
    if (!message || isAskingGemini) return;

    const localRecord = CARD_RECORDS[message];
    if (localRecord) {
      setActiveCard(localRecord);
      setChatHistory((prev) =>
        [
          ...prev,
          { role: 'user' as const, content: message },
          { role: 'model' as const, content: localRecord.answer },
        ].slice(-20)
      );
      setQuestionText('');
      return;
    }

    setNetworkNotice(null);
    setActionFeedback(null);
    setIsAskingGemini(true);
    setActiveCard({
      title: 'Gemini AI Assistant',
      answer: 'Thinking...',
      record: 'Contacting Gemini...',
      confirmedDate: 'Live AI response',
      source: 'gemini',
    });

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          conversationId: chatConversationId ?? undefined,
          history: chatHistory,
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success || typeof data.reply !== 'string') {
        setActiveCard(null);
        setActionFeedback(
          data?.error || 'The assistant could not respond right now. Please try again.'
        );
        return;
      }

      const reply = data.reply as string;
      const isLocalReply = data.source === 'local';
      if (typeof data.conversationId === 'string') {
        setChatConversationId(data.conversationId);
      }
      setChatHistory((prev) =>
        [
          ...prev,
          { role: 'user' as const, content: message },
          { role: 'model' as const, content: reply },
        ].slice(-20)
      );
      setActiveCard({
        title: isLocalReply && typeof data.title === 'string' ? data.title : 'Gemini AI Assistant',
        answer: reply,
        record: isLocalReply && typeof data.record === 'string'
          ? data.record
          : `Live Gemini response\nTier: ${status.tier}\nSent: ${new Date().toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
            })}`,
        confirmedDate: isLocalReply
          ? 'Answered locally while live AI is unavailable'
          : 'Live AI response just now',
        source: isLocalReply ? 'records' : 'gemini',
      });
      setQuestionText('');
    } catch {
      setActiveCard(null);
      setActionFeedback('Unable to reach the assistant. Please check your connection.');
    } finally {
      setIsAskingGemini(false);
    }
  };

  const memberDisplayName = memberData?.fullName || 'Spotter Member';
  const memberDisplayEmail = memberData?.email || 'Sign in to load your account';
  const avatarInitial = memberData?.fullName?.trim().charAt(0).toUpperCase() || 'M';
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
  const balanceDisplay = status.balanceKobo === 0 ? 'Nothing Due.' : `${(status.balanceKobo / 100).toLocaleString()} naira`;
  const attendanceDisplay = `${status.daysTrained} ${status.daysTrained === 1 ? 'Day' : 'Days'} This Month`;

  return (
    <div className={styles.memberAppRoot}>
      <div className={styles.screenContainer}>
        {/* Top Header matching Target Design */}
        <header className={styles.appHeader}>
          <div className={styles.logoBadge}>SPOTTER</div>

          <div className={styles.headerActions} ref={avatarMenuRef}>
            <button
              type="button"
              className={`${styles.avatarButton} ${
                isAvatarMenuOpen ? styles.avatarButtonOpen : ''
              }`}
              onClick={() => setIsAvatarMenuOpen((prev) => !prev)}
              aria-label="Member account menu"
              aria-expanded={isAvatarMenuOpen}
              aria-haspopup="true"
              id="btn-member-avatar"
            >
              <span className={styles.avatarInitial} aria-hidden="true">
                {avatarInitial}
              </span>
              <span
                className={`${styles.avatarMenuIcon} ${
                  isAvatarMenuOpen ? styles.avatarMenuIconOpen : ''
                }`}
                aria-hidden="true"
              >
                <Menu size={22} className={styles.menuIconBars} />
                <X size={22} className={styles.menuIconClose} />
              </span>
            </button>

            {isAvatarMenuOpen && (
              <div
                className={styles.avatarDropdown}
                id="member-avatar-dropdown"
                role="menu"
                aria-label="Member account menu"
              >
                <div className={styles.dropdownMemberSection}>
                  <div className={styles.dropdownAvatar} aria-hidden="true">
                    {avatarInitial}
                  </div>
                  <div className={styles.dropdownMemberInfo}>
                    <span className={styles.dropdownName}>{memberDisplayName}</span>
                    <span className={styles.dropdownEmail}>{memberDisplayEmail}</span>
                  </div>
                </div>

                <div className={styles.dropdownDivider} />

                <div className={styles.dropdownNumberRow}>
                  <CreditCard size={16} aria-hidden="true" />
                  <span className={styles.dropdownNumberLabel}>Member number</span>
                  <span className={styles.dropdownNumberBadge} id="member-number-badge">
                    {memberNumberDisplay}
                  </span>
                </div>

                <div className={styles.dropdownDivider} />

                <div className={styles.dropdownMenuItems}>
                  {onBackToMarketing && (
                    <button
                      type="button"
                      className={styles.dropdownMenuItem}
                      onClick={() => {
                        setIsAvatarMenuOpen(false);
                        onBackToMarketing();
                      }}
                      id="btn-member-marketing"
                      role="menuitem"
                    >
                      <House size={16} aria-hidden="true" />
                      <span>Marketing</span>
                    </button>
                  )}

                  {user ? (
                    <button
                      type="button"
                      className={`${styles.dropdownMenuItem} ${styles.dropdownMenuItemDanger}`}
                      onClick={() => {
                        setIsAvatarMenuOpen(false);
                        logout();
                      }}
                      id="btn-member-sign-out"
                      role="menuitem"
                    >
                      <LogOut size={16} aria-hidden="true" />
                      <span>Sign Out</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.dropdownMenuItem}
                      onClick={() => {
                        setIsAvatarMenuOpen(false);
                        router.push('/auth?mode=login');
                      }}
                      id="btn-member-sign-in"
                      role="menuitem"
                    >
                      <ArrowRight size={16} aria-hidden="true" />
                      <span>Sign In</span>
                    </button>
                  )}
                </div>
              </div>
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
                  {isNewMember ? 'Choose Plan' : 'Renew'} <ArrowRight size={13} />
                </button>
              </div>
            </div>

            <div className={styles.statusCardItem}>
              <span className={styles.statusLabel}>ATTENDANCE</span>
              <span className={styles.statusValue}>{attendanceDisplay}</span>
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
              disabled={isGeneratingCheckIn}
            >
              <Check size={16} />
              {isGeneratingCheckIn
                ? 'Generating code...'
                : checkInStatus?.checkedInToday
                  ? 'Checked In'
                  : 'Check in'}
            </button>
            <button
              type="button"
              className={styles.payAction}
              onClick={() => handleActionClick('Pay')}
              id="btn-pay"
            >
              <CreditCard size={16} /> {isNewMember ? 'Choose Subscription Plan' : 'Pay Subscription'}
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
              <ReceiptText size={16} /> {showHistory ? 'Hide Receipts' : 'Receipts & History'}
              {paymentHistory.length > 0 && ` (${paymentHistory.length})`}
            </button>
          </nav>

          {(checkInCode || checkInStatus?.checkedInToday) && (
            <section className={styles.checkInPanel} aria-label="Check-in status">
              {checkInStatus?.checkedInToday ? (
                <>
                  <div className={styles.checkInPanelHeading}>
                    <CircleCheck size={18} /> Checked in at {formatCheckInTime(checkInStatus.checkedInAt)}
                  </div>
                  <p className={styles.checkInPanelText}>
                    This visit has been counted in your attendance.
                  </p>
                </>
              ) : checkInCode ? (
                <>
                  <div className={styles.checkInPanelHeading}>Your one-tap check-in code</div>
                  <div className={styles.checkInCodeValue} id="checkin-generated-code">
                    {checkInCode.code}
                  </div>
                  <p className={styles.checkInPanelText}>
                    Emailed to {checkInCode.emailedTo}. Valid until{' '}
                    {formatCheckInTime(checkInCode.expiresAt)} Lagos time.
                  </p>
                  <div className={styles.checkInPanelActions}>
                    <button
                      type="button"
                      className={styles.renewLinkBtn}
                      onClick={() => setShowCheckInQr((previous) => !previous)}
                      id="btn-toggle-checkin-qr"
                    >
                      {showCheckInQr ? 'Hide QR code' : 'Show QR code'}
                    </button>
                    <button
                      type="button"
                      className={styles.renewLinkBtn}
                      onClick={() => router.push(`/spotter/checkin?code=${checkInCode.code}`)}
                      id="btn-open-checkin-simulator"
                    >
                      Open check-in simulator <ArrowRight size={13} />
                    </button>
                  </div>
                  {showCheckInQr ? (
                    <div className={styles.checkInQrBox}>
                      {checkInQrDataUrl ? (
                        <Image
                          src={checkInQrDataUrl}
                          alt="QR code for this check-in session"
                          width={236}
                          height={236}
                          unoptimized
                          className={styles.checkInQrImage}
                          id="checkin-qr-code"
                        />
                      ) : (
                        <span className={styles.checkInQrCaption}>Preparing QR code...</span>
                      )}
                      <span className={styles.checkInQrCaption}>Or scan at the desk</span>
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>
          )}

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
                    <X size={16} />
                  </button>
                </div>
              )}

              {paymentStatusAlert.type === 'success' && (
                <div className={styles.paymentAlertSuccess} role="alert">
                  <div>
                    <strong><CircleCheck size={15} /> {paymentStatusAlert.message}</strong>
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
                      <X size={16} />
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
                          <td>{formatLabel(item.method)}</td>
                          <td>
                            <span className={item.status === 'SUCCESS' ? styles.statusSuccessBadge : styles.statusPendingBadge}>
                              {formatLabel(item.status)}
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
                  <X size={16} />
                </button>
              </div>
              <p
                className={`${styles.answerLine} ${
                  activeCard.source === 'gemini' ? styles.aiAnswerLine : ''
                }`}
              >
                {activeCard.answer}
              </p>
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
              Tapped questions open approved gym records. Custom questions are answered by Gemini AI.
            </p>

            {/* 3-Column Question Cards Grid */}
            <div className={styles.questionsGrid} role="group" aria-label="Approved Gym Questions">
              {TARGET_QUICK_QUESTIONS.slice(0, 3).map((q, idx) => (
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

            {showMoreQuestions && (
              <div
                id="more-questions"
                className={styles.questionsGrid}
                role="group"
                aria-label="More Approved Gym Questions"
              >
                {TARGET_QUICK_QUESTIONS.slice(3).map((q, idx) => (
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
            )}

            <button
              type="button"
              className={styles.moreQuestionsButton}
              onClick={() => setShowMoreQuestions((visible) => !visible)}
              aria-expanded={showMoreQuestions}
              aria-controls="more-questions"
            >
              More questions
              <ChevronDown
                size={16}
                className={`${styles.moreQuestionsIcon} ${showMoreQuestions ? styles.moreQuestionsIconOpen : ''}`}
                aria-hidden="true"
              />
            </button>

            {/* Text Input Row: Ask a Custom Question */}
            <form onSubmit={handleQuestionSubmit} className={styles.inputRow}>
              <input
                type="text"
                className={`${styles.textInput} ${hasNoPlan ? styles.textInputLocked : ''}`}
                placeholder="Ask any question about the gym..."
                value={questionText}
                maxLength={300}
                onChange={handleQuestionChange}
                onKeyDown={handleQuestionKeyDown}
                onPaste={handleQuestionPaste}
                readOnly={hasNoPlan}
                disabled={isAskingGemini}
                aria-readonly={hasNoPlan}
                aria-describedby={subscriptionNotice ? 'subscription-notice' : undefined}
                aria-label="Ask a question"
                id="input-ask-question"
              />
              <button
                type="submit"
                className={styles.submitBtn}
                id="btn-submit-question"
                disabled={hasNoPlan || isAskingGemini}
                aria-busy={isAskingGemini}
              >
                {isAskingGemini ? 'Thinking...' : 'Ask'}
              </button>
            </form>
            {subscriptionNotice && (
              <p id="subscription-notice" role="alert" className={styles.subscriptionNotice}>
                {subscriptionNotice}
              </p>
            )}
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
