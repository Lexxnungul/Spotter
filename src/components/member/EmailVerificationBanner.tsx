'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import styles from './EmailVerificationBanner.module.css';

export default function EmailVerificationBanner() {
  const { user, verifyEmail, resendVerificationEmail } = useAuth();
  const [code, setCode] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isResending, setIsResending] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  // Countdown timer for resend button
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  // Only render for authenticated members who have an email and are NOT verified
  if (!user || user.type !== 'member' || !user.member.email) {
    return null;
  }

  // Do not show banner if already verified or dismissed
  if (user.member.isEmailVerified || isDismissed) {
    return null;
  }

  const memberEmail = user.member.email;

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    // Only accept numeric digits up to 6 characters
    const numeric = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(numeric);
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanCode = code.trim();
    if (cleanCode.length !== 6) {
      setErrorMsg('Please enter all 6 digits of the verification code.');
      return;
    }

    setIsSubmitting(true);
    const result = await verifyEmail(cleanCode);
    setIsSubmitting(false);

    if (!result.success) {
      setErrorMsg(result.error || 'Verification failed. Please try again.');
    } else {
      setSuccessMsg('✓ Email verified successfully!');
      setTimeout(() => {
        setIsDismissed(true);
      }, 1500);
    }
  };

  const handleResend = async () => {
    if (cooldownSeconds > 0 || isResending) return;
    setErrorMsg(null);
    setIsResending(true);

    const result = await resendVerificationEmail();
    setIsResending(false);

    if (!result.success) {
      setErrorMsg(result.error || 'Could not resend code. Please try again later.');
    } else {
      setCooldownSeconds(30);
      setErrorMsg(null);
    }
  };

  if (successMsg) {
    return (
      <div className={styles.bannerRoot} role="status" aria-live="polite">
        <div className={styles.successMessage}>{successMsg}</div>
      </div>
    );
  }

  return (
    <div
      className={styles.bannerRoot}
      role="region"
      aria-label="Email verification notice"
      id="email-verification-banner"
    >
      <h2 className={styles.bannerTitle}>Verify your email</h2>
      <p className={styles.bannerDescription}>
        We sent a six digit code to <span className={styles.bannerEmailHighlight}>{memberEmail}</span>. Enter it below to verify your email.
      </p>

      <form onSubmit={handleVerifySubmit} className={styles.verifyForm}>
        <label className={styles.codeLabel} htmlFor="input-verification-code">
          Six digit code
        </label>
        <div className={styles.inputRow}>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            className={styles.codeInput}
            value={code}
            onChange={handleCodeChange}
            aria-label="Six digit code"
            id="input-verification-code"
            disabled={isSubmitting}
            autoComplete="one-time-code"
          />
          <button
            type="submit"
            className={styles.verifyBtn}
            disabled={code.length !== 6 || isSubmitting}
            id="btn-submit-verify-code"
          >
            {isSubmitting ? 'Verifying...' : 'Verify'}
          </button>
          <button
            type="button"
            className={styles.resendBtn}
            onClick={handleResend}
            disabled={cooldownSeconds > 0 || isResending}
            id="btn-resend-verification-code"
          >
            {isResending
              ? 'Sending...'
              : cooldownSeconds > 0
              ? `Send a new code (${cooldownSeconds}s)`
              : 'Send a new code'}
          </button>
        </div>

        {errorMsg && (
          <div role="alert" className={styles.errorMessage} id="verification-error-msg">
            {errorMsg}
          </div>
        )}
      </form>
    </div>
  );
}
