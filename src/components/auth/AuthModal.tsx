'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import styles from './AuthModal.module.css';

export default function AuthModal() {
  const {
    isAuthModalOpen,
    authModalInitialTab,
    closeAuthModal,
    loginWithPin,
    activateMember,
    loginStaff,
    lockoutRemainingSeconds,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'pin' | 'activate' | 'staff'>(authModalInitialTab);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // PIN Tab state
  const [pinDigits, setPinDigits] = useState<string>('');

  // Activation Tab state
  const [activationCode, setActivationCode] = useState<string>('');
  const [hasConsented, setHasConsented] = useState<boolean>(false);
  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');

  // Staff Tab state
  const [staffEmail, setStaffEmail] = useState<string>('');
  const [staffPassword, setStaffPassword] = useState<string>('');

  useEffect(() => {
    setActiveTab(authModalInitialTab);
    setErrorMsg(null);
  }, [authModalInitialTab, isAuthModalOpen]);

  // Handle ESC key to dismiss modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAuthModalOpen) {
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  // Dynamic document title when modal view is open
  useEffect(() => {
    if (!isAuthModalOpen) return;
    const prevTitle = document.title;
    const tabTitle =
      activeTab === 'pin'
        ? 'Sign In | Spotter'
        : activeTab === 'activate'
        ? 'Activate Device | Spotter'
        : 'Staff Portal | Spotter';
    document.title = tabTitle;
    return () => {
      document.title = prevTitle;
    };
  }, [isAuthModalOpen, activeTab]);

  if (!isAuthModalOpen) return null;

  // Keypad press handler for PIN
  const handleKeypadPress = (val: string) => {
    setErrorMsg(null);
    if (val === 'CLEAR') {
      setPinDigits('');
      return;
    }
    if (val === 'BACK') {
      setPinDigits((prev) => prev.slice(0, -1));
      return;
    }
    if (pinDigits.length < 4) {
      const nextDigits = pinDigits + val;
      setPinDigits(nextDigits);
      if (nextDigits.length === 4) {
        // Automatically attempt login when 4 digits entered
        triggerPinLogin(nextDigits);
      }
    }
  };

  const triggerPinLogin = async (pin: string) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    const res = await loginWithPin(pin);
    setIsSubmitting(false);
    if (!res.success) {
      setErrorMsg(res.error || 'Invalid PIN.');
      setPinDigits('');
    }
  };

  const handleActivationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (newPin !== confirmPin) {
      setErrorMsg('PINs do not match. Please verify your 4-digit PIN.');
      return;
    }

    setIsSubmitting(true);
    const res = await activateMember(activationCode, newPin, hasConsented);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Activation failed.');
    }
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    const res = await loginStaff(staffEmail, staffPassword);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Staff login failed.');
    }
  };

  return (
    <div
      className={styles.modalOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAuthModal();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className={styles.modalCard}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerTitleGroup}>
            <div className={styles.logoIcon}>⚡</div>
            <h2 id="auth-modal-title" className={styles.modalTitle}>
              Spotter Authentication
            </h2>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={closeAuthModal}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className={styles.tabBar} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'pin'}
            className={`${styles.tabButton} ${activeTab === 'pin' ? styles.activeTabButton : ''}`}
            onClick={() => {
              setActiveTab('pin');
              setErrorMsg(null);
            }}
            id="tab-btn-pin"
          >
            Member PIN
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'activate'}
            className={`${styles.tabButton} ${activeTab === 'activate' ? styles.activeTabButton : ''}`}
            onClick={() => {
              setActiveTab('activate');
              setErrorMsg(null);
            }}
            id="tab-btn-activate"
          >
            Activate Phone
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'staff'}
            className={`${styles.tabButton} ${activeTab === 'staff' ? styles.activeTabButton : ''}`}
            onClick={() => {
              setActiveTab('staff');
              setErrorMsg(null);
            }}
            id="tab-btn-staff"
          >
            Staff Desk
          </button>
        </div>

        {/* Body Content */}
        <div className={styles.modalBody}>
          {errorMsg && (
            <div className={styles.errorBanner} role="alert">
              {errorMsg}
            </div>
          )}

          {/* TAB 1: PIN UNLOCK */}
          {activeTab === 'pin' && (
            <div className={styles.pinContainer}>
              <p className={styles.pinInstruction}>
                Enter your 4-digit member PIN to open your gym records:
              </p>

              {lockoutRemainingSeconds > 0 && (
                <div className={styles.errorBanner}>
                  Device locked. Time remaining:{' '}
                  <strong>
                    {Math.floor(lockoutRemainingSeconds / 60)}m {lockoutRemainingSeconds % 60}s
                  </strong>
                  <br />
                  Desk hours: 06:00 - 21:00.
                </div>
              )}

              {/* Visual PIN Dots */}
              <div className={styles.pinDotsRow}>
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`${styles.pinDot} ${idx < pinDigits.length ? styles.pinDotFilled : ''}`}
                  />
                ))}
              </div>

              {/* Numeric Keypad */}
              <div className={styles.keypadGrid}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    className={styles.keypadKey}
                    onClick={() => handleKeypadPress(digit)}
                    disabled={isSubmitting || lockoutRemainingSeconds > 0}
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  className={`${styles.keypadKey} ${styles.keypadKeySpecial}`}
                  onClick={() => handleKeypadPress('CLEAR')}
                  disabled={isSubmitting || lockoutRemainingSeconds > 0}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className={styles.keypadKey}
                  onClick={() => handleKeypadPress('0')}
                  disabled={isSubmitting || lockoutRemainingSeconds > 0}
                >
                  0
                </button>
                <button
                  type="button"
                  className={`${styles.keypadKey} ${styles.keypadKeySpecial}`}
                  onClick={() => handleKeypadPress('BACK')}
                  disabled={isSubmitting || lockoutRemainingSeconds > 0}
                >
                  ⌫
                </button>
              </div>

              <div className={styles.demoHelper}>
                <span className={styles.demoHelperText}>First time linking your phone?</span>
                <button
                  type="button"
                  className={styles.demoFillLink}
                  onClick={() => setActiveTab('activate')}
                >
                  Switch to 6-digit Activation
                </button>
                <button
                  type="button"
                  className={styles.demoFillLink}
                  onClick={() => {
                    setPinDigits('1234');
                    triggerPinLogin('1234');
                  }}
                >
                  Quick Test: Fill Demo PIN (1234)
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: ACTIVATION (FR-7) */}
          {activeTab === 'activate' && (
            <form onSubmit={handleActivationSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="input-activation-code">
                  6-Digit Activation Code
                  <span>From Gym Desk</span>
                </label>
                <input
                  id="input-activation-code"
                  type="text"
                  maxLength={6}
                  value={activationCode}
                  onChange={(e) => setActivationCode(e.target.value.replace(/\D/g, ''))}
                  className={`${styles.input} ${styles.codeInput}`}
                  placeholder="849201"
                  required
                />
              </div>

              {/* NDPA Data Protection Notice */}
              <div className={styles.consentCard}>
                <strong>Nigeria Data Protection Act (NDPA 2023) Notice:</strong>
                <p style={{ marginTop: '4px' }}>
                  Spotter records your attendance dates and payment ledger to verify your gym membership.
                  Your records use row-level database isolation and are never shared with other members.
                </p>
                <label className={styles.consentRow}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={hasConsented}
                    onChange={(e) => setHasConsented(e.target.checked)}
                    id="chk-ndpa-consent"
                    required
                  />
                  <span>I understand and agree to the storage of my gym attendance records.</span>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="input-new-pin">
                    Choose 4-Digit PIN
                  </label>
                  <input
                    id="input-new-pin"
                    type="password"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    className={styles.input}
                    placeholder="••••"
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="input-confirm-pin">
                    Confirm PIN
                  </label>
                  <input
                    id="input-confirm-pin"
                    type="password"
                    maxLength={4}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    className={styles.input}
                    placeholder="••••"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className={styles.submitButton}
                disabled={isSubmitting || !hasConsented || activationCode.length !== 6 || newPin.length !== 4}
                id="btn-submit-activation"
              >
                {isSubmitting ? 'Linking Phone...' : 'Link Phone & Open App'}
              </button>

              <div className={styles.demoHelper}>
                <button
                  type="button"
                  className={styles.demoFillLink}
                  onClick={() => {
                    setActivationCode('849201');
                    setHasConsented(true);
                    setNewPin('1234');
                    setConfirmPin('1234');
                  }}
                >
                  Quick Test: Fill Demo Code (849201 - Tunde)
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: STAFF & OWNER */}
          {activeTab === 'staff' && (
            <form onSubmit={handleStaffSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="input-staff-email">
                  Staff Email
                </label>
                <input
                  id="input-staff-email"
                  type="email"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  className={styles.input}
                  placeholder="desk@spottergym.com"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="input-staff-password">
                  Password
                </label>
                <input
                  id="input-staff-password"
                  type="password"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  className={styles.input}
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                className={styles.submitButton}
                disabled={isSubmitting || !staffEmail || !staffPassword}
                id="btn-submit-staff"
              >
                {isSubmitting ? 'Verifying Desk Credentials...' : 'Sign In to Staff Desk'}
              </button>

              <div className={styles.demoHelper}>
                <button
                  type="button"
                  className={styles.demoFillLink}
                  onClick={() => {
                    setStaffEmail('desk@spottergym.com');
                    setStaffPassword('deskpassword');
                  }}
                >
                  Quick Test: Fill Desk Staff (Chioma)
                </button>
                <button
                  type="button"
                  className={styles.demoFillLink}
                  onClick={() => {
                    setStaffEmail('owner@spottergym.com');
                    setStaffPassword('ownerpassword');
                  }}
                >
                  Quick Test: Fill Gym Owner (Emeka)
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
