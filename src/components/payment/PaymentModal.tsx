'use client';

import React, { useEffect, useRef, useState } from 'react';
import styles from './PaymentModal.module.css';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: {
    id: string;
    fullName: string;
    memberNumber?: string;
    tier: 'BASIC' | 'PREMIUM' | 'DIAMOND';
    expiryDate: string;
    balanceKobo: number;
    email?: string;
  };
  isNewMember?: boolean;
  isOnline: boolean;
  waitingPayment?: {
    reference: string | null;
    createdAt: string;
  } | null;
  onPaymentSuccess?: (reference: string) => void;
  onPaymentPending?: (reference: string) => void;
}

export default function PaymentModal({
  isOpen,
  onClose,
  member,
  isNewMember = false,
  isOnline,
  waitingPayment,
  onPaymentSuccess,
  onPaymentPending,
}: PaymentModalProps) {
  const [selectedTier, setSelectedTier] = useState<'BASIC' | 'PREMIUM' | 'DIAMOND'>(
    member.tier || 'BASIC'
  );
  const [paymentLogId, setPaymentLogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const paymentLogIdRef = useRef<string | null>(null);
  const hasProceededRef = useRef(false);

  useEffect(() => {
    if (!isOpen || !isOnline || !member.id) {
      return;
    }

    let active = true;
    hasProceededRef.current = false;
    const purpose = isNewMember ? 'NEW_SUBSCRIPTION' : 'RENEWAL';
    const tierAtOpen = member.tier || 'BASIC';

    (async () => {
      try {
        const res = await fetch('/api/payment/journey', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'MODAL_OPENED',
            memberId: member.id,
            paymentLogId: paymentLogIdRef.current ?? undefined,
            purpose,
            tier: tierAtOpen,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (active && data?.paymentLogId) {
          paymentLogIdRef.current = data.paymentLogId;
          setPaymentLogId(data.paymentLogId);
        }
      } catch {
        // Journey logging is best-effort and must not block checkout UI
      }
    })();

    return () => {
      active = false;
    };
  }, [isOpen, isOnline, isNewMember, member.id, member.tier]);

  if (!isOpen) return null;

  const tierPrices: Record<'BASIC' | 'PREMIUM' | 'DIAMOND', number> = {
    BASIC: 15000,
    PREMIUM: 25000,
    DIAMOND: 45000,
  };

  const currentPriceNaira = tierPrices[selectedTier] || 15000;
  const balanceNaira = Math.round(member.balanceKobo / 100);
  const totalDueNaira = currentPriceNaira + Math.max(0, balanceNaira);

  const tierDisplayNames: Record<'BASIC' | 'PREMIUM' | 'DIAMOND', string> = {
    BASIC: 'Basic',
    PREMIUM: 'Premium',
    DIAMOND: 'Diamond VIP',
  };

  // Compute preview of new expiry date
  const computeNewExpiry = () => {
    const cur = new Date(member.expiryDate);
    const now = new Date();
    const base = isNaN(cur.getTime()) || cur < now ? now : cur;
    const future = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
    return future.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const handleSelectTier = (tier: 'BASIC' | 'PREMIUM' | 'DIAMOND') => {
    setSelectedTier(tier);
    if (!isOnline || !member.id) return;

    const purpose = isNewMember ? 'NEW_SUBSCRIPTION' : 'RENEWAL';
    const activeLogId = paymentLogIdRef.current ?? paymentLogId;

    void fetch('/api/payment/journey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'PLAN_SELECTED',
        memberId: member.id,
        paymentLogId: activeLogId ?? undefined,
        purpose,
        tier,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.paymentLogId && !paymentLogIdRef.current) {
          paymentLogIdRef.current = data.paymentLogId;
          setPaymentLogId(data.paymentLogId);
        }
      })
      .catch(() => {
        // Best-effort journey logging
      });
  };

  const handleCloseModal = () => {
    if (loading) return;

    const activeLogId = paymentLogIdRef.current ?? paymentLogId;
    if (
      activeLogId &&
      !hasProceededRef.current &&
      isOnline &&
      Boolean(member.id)
    ) {
      const purpose = isNewMember ? 'NEW_SUBSCRIPTION' : 'RENEWAL';
      void fetch('/api/payment/journey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          action: 'ABANDONED_MODAL',
          memberId: member.id,
          paymentLogId: activeLogId,
          purpose,
          tier: selectedTier,
          reason: 'User closed payment modal before completing checkout',
        }),
      }).catch(() => {
        // Best-effort abandonment logging
      });
    }

    paymentLogIdRef.current = null;
    setPaymentLogId(null);
    hasProceededRef.current = false;
    setErrorMsg(null);
    setSelectedTier(member.tier || 'BASIC');
    onClose();
  };

  const handlePay = async (simulate = false) => {
    if (!isOnline) {
      setErrorMsg('You need data for this.');
      return;
    }
    if (!member.id) {
      setErrorMsg('Please sign in with a registered member account to pay via Flutterwave.');
      return;
    }
    setErrorMsg(null);
    setLoading(true);

    try {
      const purpose = isNewMember ? 'NEW_SUBSCRIPTION' : 'RENEWAL';
      const activeLogId = paymentLogIdRef.current ?? paymentLogId;

      const res = await fetch('/api/payment/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: member.id,
          paymentLogId: activeLogId ?? undefined,
          purpose,
          tier: selectedTier,
          redirectUrl: window.location.origin,
        }),
      });

      const data = await res.json();

      if (data?.paymentLogId) {
        paymentLogIdRef.current = data.paymentLogId;
        setPaymentLogId(data.paymentLogId);
      }

      if (!res.ok || !data.success) {
        if (data.isWaiting) {
          setErrorMsg(data.message || 'A payment is waiting. Do not pay again.');
        } else {
          setErrorMsg(data.error || 'We could not start the payment. You have not been charged.');
        }
        return;
      }

      if (simulate || data.isDevSandbox) {
        // 1. Mark return check PENDING on PaymentLog (never settles without webhook)
        await fetch('/api/payment/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference: data.reference,
          }),
        });

        // 2. Deliver simulated webhook through server webhook processor (dev-only route)
        const simRes = await fetch('/api/payment/webhook/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference: data.reference,
            memberId: member.id,
            gatewayStatus: 'successful',
          }),
        });

        const simData = await simRes.json();
        if (
          simRes.ok &&
          simData.success &&
          simData.status === 'SUCCESS'
        ) {
          hasProceededRef.current = true;
          paymentLogIdRef.current = null;
          setPaymentLogId(null);
          onPaymentSuccess?.(data.reference);
          onClose();
          return;
        }

        if (simRes.status === 202 || simData?.status === 'PENDING') {
          hasProceededRef.current = true;
          paymentLogIdRef.current = null;
          setPaymentLogId(null);
          onPaymentPending?.(data.reference);
          onClose();
          return;
        }

        setErrorMsg(
          simData.error ||
          simData.message ||
          'Payment could not be confirmed by webhook. Check status or try again.'
        );
        return;
      }

      // Live Flutterwave redirect
      if (data.paymentLink) {
        hasProceededRef.current = true;
        const logIdToTrack = data.paymentLogId ?? paymentLogIdRef.current ?? paymentLogId;
        if (logIdToTrack) {
          try {
            await fetch('/api/payment/journey', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              keepalive: true,
              body: JSON.stringify({
                action: 'GATEWAY_REDIRECT',
                memberId: member.id,
                paymentLogId: logIdToTrack,
                reference: data.reference,
                purpose,
                tier: selectedTier,
              }),
            });
          } catch {
            // Best-effort log before leaving page
          }
        }
        window.location.href = data.paymentLink;
      } else {
        setErrorMsg('Unable to reach Flutterwave gateway. Try again or pay at the desk.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network error initiating payment.';
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) handleCloseModal();
      }}
    >
      <div className={styles.modalCard}>
        {/* Header: Dynamic for new members vs renewals */}
        <div className={styles.modalHeader}>
          <div>
            <h2 id="payment-modal-title" className={styles.modalTitle}>
              {isNewMember ? 'Choose Your Subscription Plan' : 'Renew Gym Subscription'}
            </h2>
            <p className={styles.modalSubtitle}>
              {isNewMember
                ? 'Select a membership plan to activate your gym access'
                : 'Monthly membership renewal via Flutterwave gateway'}
            </p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={handleCloseModal}
            disabled={loading}
            aria-label="Close modal"
            id="btn-close-payment-modal"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {/* Member Pill */}
          <div className={styles.memberPill}>
            <span className={styles.memberPillName}>{member.fullName}</span>
            <span className={styles.memberPillNumber}>
              {member.memberNumber ? `#${member.memberNumber}` : isNewMember ? 'New Member' : 'Member'}
            </span>
          </div>

          {/* 30-minute lock warning */}
          {waitingPayment && (
            <div className={`${styles.alertBox} ${styles.alertBoxWarning}`} role="alert">
              <strong>A payment is waiting. Do not pay again.</strong>
              <div className={styles.waitingSubtext}>
                Ref: {waitingPayment.reference} • Initiated recently. Please wait or check your bank app.
              </div>
            </div>
          )}

          {/* Offline / Error warning */}
          {!isOnline && (
            <div className={`${styles.alertBox} ${styles.alertBoxError}`} role="alert">
              You need data for this.
            </div>
          )}

          {errorMsg && (
            <div className={`${styles.alertBox} ${styles.alertBoxError}`} role="alert">
              {errorMsg}
            </div>
          )}

          {/* 3 Membership Plans Presentation */}
          <div>
            <p className={styles.planOptionsTitle}>
              {isNewMember ? 'Select A Membership Plan' : 'Select Subscription Tier'}
            </p>
            <div className={styles.planGrid}>
              {/* 1. Basic Plan */}
              <div
                className={`${styles.planCard} ${selectedTier === 'BASIC' ? styles.planCardActive : ''}`}
                onClick={() => handleSelectTier('BASIC')}
                role="button"
                tabIndex={0}
                id="plan-option-basic"
              >
                <div className={styles.planCardHeader}>
                  <span className={styles.planName}>Basic</span>
                  {!isNewMember && member.tier === 'BASIC' && (
                    <span className={styles.planBadge}>Current</span>
                  )}
                  {isNewMember && <span className={styles.planBadge}>Standard</span>}
                </div>
                <div className={styles.planPrice}>
                  ₦15,000 <span className={styles.planPriceSmall}>/ mo</span>
                </div>
                <p className={styles.planDesc}>
                  Gym floor & weight equipment access, daily whiteboard check-in, 06:00 – 21:00.
                </p>
              </div>

              {/* 2. Premium Plan */}
              <div
                className={`${styles.planCard} ${selectedTier === 'PREMIUM' ? styles.planCardActive : ''}`}
                onClick={() => handleSelectTier('PREMIUM')}
                role="button"
                tabIndex={0}
                id="plan-option-premium"
              >
                <div className={styles.planCardHeader}>
                  <span className={styles.planName}>Premium</span>
                  {!isNewMember && member.tier === 'PREMIUM' && (
                    <span className={styles.planBadge}>Current</span>
                  )}
                  <span className={styles.planBadge}>Popular</span>
                </div>
                <div className={styles.planPrice}>
                  ₦25,000 <span className={styles.planPriceSmall}>/ mo</span>
                </div>
                <p className={styles.planDesc}>
                  Includes floor trainer guidance, 1 monthly guest pass, and priority desk service.
                </p>
              </div>

              {/* 3. Diamond Plan */}
              <div
                className={`${styles.planCard} ${selectedTier === 'DIAMOND' ? styles.planCardDiamondActive : ''
                  }`}
                onClick={() => handleSelectTier('DIAMOND')}
                role="button"
                tabIndex={0}
                id="plan-option-diamond"
              >
                <div className={styles.planCardHeader}>
                  <span className={styles.planName}>Diamond</span>
                  {!isNewMember && member.tier === 'DIAMOND' && (
                    <span className={styles.planBadgeDiamond}>Current</span>
                  )}
                  <span className={styles.planBadgeDiamond}>VIP</span>
                </div>
                <div className={styles.planPrice}>
                  ₦45,000 <span className={styles.planPriceSmall}>/ mo</span>
                </div>
                <p className={styles.planDesc}>
                  Dedicated 1-on-1 trainer consultation, unlimited guest passes, locker & towel service.
                </p>
              </div>
            </div>
          </div>

          {/* Breakdown Card */}
          <div className={styles.breakdownCard}>
            <div className={styles.breakdownRow}>
              <span>
                {tierDisplayNames[selectedTier]} {isNewMember ? 'Membership' : 'Renewal'} (1 Month)
              </span>
              <span>₦{currentPriceNaira.toLocaleString()}</span>
            </div>
            {balanceNaira > 0 && (
              <div className={styles.breakdownRow}>
                <span>Outstanding Balance</span>
                <span>₦{balanceNaira.toLocaleString()}</span>
              </div>
            )}
            <div className={styles.breakdownRowTotal}>
              <span>Total Amount Due</span>
              <span>{totalDueNaira.toLocaleString()} naira (₦{totalDueNaira.toLocaleString()})</span>
            </div>
          </div>

          {/* Expiry / Activation notice */}
          <div className={styles.expiryNotice}>
            <span>🗓</span>
            <span>
              {isNewMember ? 'Activates' : 'Extends'} access through{' '}
              <strong>{computeNewExpiry()}</strong>
            </span>
          </div>

          {/* Trust Banner */}
          <div className={styles.trustBanner}>
            <span className={styles.trustShield}>✓</span>
            <span>Secured by Flutterwave • Cards, Bank Transfer & USSD accepted</span>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={handleCloseModal}
            disabled={loading}
          >
            Cancel
          </button>

          <button
            type="button"
            className={styles.payButton}
            onClick={() => handlePay(false)}
            disabled={loading || !isOnline || Boolean(waitingPayment)}
            id="btn-proceed-flutterwave"
          >
            {loading ? (
              'Contacting Gateway...'
            ) : isNewMember ? (
              `Subscribe to ${tierDisplayNames[selectedTier]} (₦${totalDueNaira.toLocaleString()})`
            ) : (
              `Pay ₦${totalDueNaira.toLocaleString()} with Flutterwave`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
