'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import styles from './AuthModal.module.css';

export default function AuthModal() {
  const router = useRouter();
  const {
    isAuthModalOpen,
    authModalInitialTab,
    closeAuthModal,
    createAccount,
    loginWithCredentials,
  } = useAuth();

  const [mode, setMode] = useState<'create' | 'login'>('create');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Create Account Form Fields
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [memberNumber, setMemberNumber] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [hasConsented, setHasConsented] = useState<boolean>(false);
  const [consentError, setConsentError] = useState<boolean>(false);

  // Login Form Fields
  const [loginIdentifier, setLoginIdentifier] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');

  // Touched state to display inline errors when blurred without typing
  const [createTouched, setCreateTouched] = useState<Record<string, boolean>>({});
  const [loginTouched, setLoginTouched] = useState<Record<string, boolean>>({});

  const getFullNameError = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return 'this field must not be empty';
    if (trimmed.length < 2) return 'Full name must be at least 2 characters.';
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length < 2) return 'Please enter at least 2 words or names separated by a space.';
    return null;
  };

  const getEmailError = (val: string, touched: boolean): string | null => {
    if (!val) {
      return touched ? 'this field must not be empty' : null;
    }
    const trimmed = val.trim();
    if (!trimmed) {
      return 'enter a valid email address';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return 'enter a valid email address';
    }
    return null;
  };

  const getMemberNumberError = (val: string, touched: boolean): string | null => {
    const trimmed = val.trim();
    if (!trimmed) {
      return touched ? 'this field must not be empty' : null;
    }
    if (trimmed.length < 6 || !/^\d{6}$/.test(trimmed)) {
      return touched ? 'Member number must be 6 digits.' : null;
    }
    return null;
  };

  const createErrors = {
    fullName: createTouched.fullName ? getFullNameError(fullName) : null,
    email: getEmailError(email, Boolean(createTouched.email)),
    memberNumber: getMemberNumberError(memberNumber, Boolean(createTouched.memberNumber)),
    password: Boolean(createTouched.password && !password.trim()),
  };

  const areFieldsFilledAndValid =
    getFullNameError(fullName) === null &&
    getEmailError(email, true) === null &&
    getMemberNumberError(memberNumber, true) === null &&
    password.trim().length >= 8;

  const isCreateFormValid = areFieldsFilledAndValid && hasConsented;

  const handleDisabledButtonClick = () => {
    if (!isCreateFormValid && areFieldsFilledAndValid && !hasConsented) {
      setConsentError(true);
      setErrorMsg('Please accept the terms and conditions to continue.');
      if (typeof document !== 'undefined') {
        document.getElementById('chk-history-consent')?.focus();
      }
    }
  };

  const loginErrors = {
    loginIdentifier: Boolean(loginTouched.loginIdentifier && !loginIdentifier.trim()),
    loginPassword: Boolean(loginTouched.loginPassword && !loginPassword.trim()),
  };

  useEffect(() => {
    if (authModalInitialTab === 'login' || authModalInitialTab === 'staff') {
      setMode('login');
    } else {
      setMode('create');
    }
    setErrorMsg(null);
    setConsentError(false);
    setCreateTouched({});
    setLoginTouched({});
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
    document.title = mode === 'create' ? 'Create Account | Spotter' : 'Member Log In | Spotter';
    return () => {
      document.title = prevTitle;
    };
  }, [isAuthModalOpen, mode]);

  if (!isAuthModalOpen) return null;

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const emptyFullName = !fullName.trim();
    const emptyEmail = !email.trim();
    const emptyMemberNumber = !memberNumber.trim();
    const emptyPassword = !password.trim();

    if (emptyFullName || emptyEmail || emptyMemberNumber || emptyPassword) {
      setCreateTouched({
        fullName: Boolean(getFullNameError(fullName)),
        email: true,
        memberNumber: true,
        password: emptyPassword,
      });
      return;
    }

    const fullNameErr = getFullNameError(fullName);
    if (fullNameErr) {
      setCreateTouched((prev) => ({ ...prev, fullName: true }));
      setErrorMsg(fullNameErr);
      return;
    }

    const emailErr = getEmailError(email, true);
    if (emailErr) {
      setCreateTouched((prev) => ({ ...prev, email: true }));
      setErrorMsg(emailErr);
      return;
    }

    const memberNumErr = getMemberNumberError(memberNumber, true);
    if (memberNumErr) {
      setCreateTouched((prev) => ({ ...prev, memberNumber: true }));
      setErrorMsg(memberNumErr);
      return;
    }
    const trimmedPassword = password.trim();
    if (trimmedPassword !== password) {
      setPassword(trimmedPassword);
    }
    if (trimmedPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }
    if (!hasConsented) {
      if (areFieldsFilledAndValid) {
        setConsentError(true);
      }
      setErrorMsg('Please accept the terms and conditions to continue.');
      return;
    }

    setIsSubmitting(true);
    const res = await createAccount({
      fullName,
      email,
      memberNumber,
      password: trimmedPassword,
      hasConsented,
    });
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Failed to create account.');
    } else {
      router.push('/onboarding');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedPassword = loginPassword.trim();
    if (trimmedPassword !== loginPassword) {
      setLoginPassword(trimmedPassword);
    }
    const emptyIdentifier = !loginIdentifier.trim();
    const emptyPassword = !trimmedPassword;

    if (emptyIdentifier || emptyPassword) {
      setLoginTouched({
        loginIdentifier: emptyIdentifier,
        loginPassword: emptyPassword,
      });
      return;
    }

    setIsSubmitting(true);
    const res = await loginWithCredentials(loginIdentifier.trim(), trimmedPassword);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Invalid credentials.');
    } else {
      const isStaff = loginIdentifier.toLowerCase().includes('desk@') || loginIdentifier.toLowerCase().includes('owner@');
      if (isStaff) {
        router.push('/receptionist');
      }
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
      aria-describedby="auth-modal-desc"
    >
      <div className={styles.modalCard}>
        {/* Header matching screenshot */}
        <div className={styles.cardHeader}>
          <button
            type="button"
            className={styles.closeButton}
            onClick={closeAuthModal}
            aria-label="Close modal"
          >
            ✕
          </button>

          <div className={styles.badge}>SPOTTER</div>

          <h2 id="auth-modal-title" className={styles.title}>
            {mode === 'create' ? 'Create Account' : 'Member Log In'}
          </h2>

          <p id="auth-modal-desc" className={styles.subtitle}>
            {mode === 'create'
              ? 'Link your gym card to activate your personal Spotter portal.'
              : 'Access your gym check-in code, attendance records, and balance.'}
          </p>
        </div>

        {/* Card Body */}
        <div className={styles.cardBody}>
          {errorMsg && (
            <div className={styles.errorBanner} role="alert">
              {errorMsg}
            </div>
          )}

          {/* VIEW 1: CREATE ACCOUNT (Exact replica of provided image) */}
          {mode === 'create' ? (
            <form onSubmit={handleCreateSubmit} noValidate aria-label="Create Account Form">
              {/* Full Name */}
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="input-full-name">
                  Full Name
                </label>
                <input
                  id="input-full-name"
                  type="text"
                  minLength={2}
                  value={fullName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFullName(val);
                    if (!getFullNameError(val)) {
                      setCreateTouched((prev) => ({ ...prev, fullName: false }));
                    }
                  }}
                  onBlur={() => {
                    if (getFullNameError(fullName)) {
                      setCreateTouched((prev) => ({ ...prev, fullName: true }));
                    }
                  }}
                  className={`${styles.input} ${createErrors.fullName ? styles.inputError : ''}`}
                  placeholder="Chioma Adeyemi"
                  aria-invalid={createErrors.fullName ? 'true' : undefined}
                  aria-describedby={createErrors.fullName ? 'error-input-full-name' : undefined}
                  required
                />
                {createErrors.fullName && (
                  <span id="error-input-full-name" className={styles.fieldError} role="alert">
                    {createErrors.fullName}
                  </span>
                )}
              </div>

              {/* Email Address */}
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="input-email-address">
                  Email Address
                </label>
                <input
                  id="input-email-address"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value.toLowerCase());
                  }}
                  onBlur={() => {
                    setCreateTouched((prev) => ({ ...prev, email: true }));
                  }}
                  className={`${styles.input} ${createErrors.email ? styles.inputError : ''}`}
                  placeholder="chioma@example.com"
                  aria-invalid={createErrors.email ? 'true' : undefined}
                  aria-describedby={createErrors.email ? 'error-input-email-address' : undefined}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                />
                {createErrors.email && (
                  <span id="error-input-email-address" className={styles.fieldError} role="alert">
                    {createErrors.email}
                  </span>
                )}
              </div>

              {/* Member Number */}
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="input-member-number">
                  Member Number
                </label>
                <input
                  id="input-member-number"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={memberNumber}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setMemberNumber(digitsOnly);
                    if (digitsOnly.length === 6) {
                      setCreateTouched((prev) => ({ ...prev, memberNumber: false }));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (
                      ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key) ||
                      e.ctrlKey ||
                      e.metaKey
                    ) {
                      return;
                    }
                    if (!/^\d$/.test(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  onBlur={() => {
                    setCreateTouched((prev) => ({ ...prev, memberNumber: true }));
                  }}
                  className={`${styles.input} ${createErrors.memberNumber ? styles.inputError : ''}`}
                  placeholder="Enter member number"
                  aria-invalid={createErrors.memberNumber ? 'true' : undefined}
                  aria-describedby={createErrors.memberNumber ? 'error-input-member-number' : undefined}
                  required
                />
                {createErrors.memberNumber && (
                  <span id="error-input-member-number" className={styles.fieldError} role="alert">
                    {createErrors.memberNumber}
                  </span>
                )}
              </div>

              {/* Password */}
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="input-create-password">
                  Password
                </label>
                <div className={`${styles.passwordWrapper} ${createErrors.password ? styles.inputError : ''}`}>
                  <input
                    id="input-create-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (e.target.value.trim()) {
                        setCreateTouched((prev) => ({ ...prev, password: false }));
                      }
                    }}
                    onBlur={() => {
                      const trimmed = password.trim();
                      if (trimmed !== password) {
                        setPassword(trimmed);
                      }
                      if (!trimmed) {
                        setCreateTouched((prev) => ({ ...prev, password: true }));
                      }
                    }}
                    className={styles.passwordInput}
                    aria-invalid={createErrors.password ? 'true' : undefined}
                    aria-describedby={
                      createErrors.password
                        ? 'error-input-create-password'
                        : Boolean(password)
                        ? 'hint-input-create-password'
                        : undefined
                    }
                    required
                  />
                  <button
                    type="button"
                    className={styles.showPasswordBtn}
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {createErrors.password && (
                  <span id="error-input-create-password" className={styles.fieldError} role="alert">
                    this field must not be empty
                  </span>
                )}
                {Boolean(password) && (
                  <span id="hint-input-create-password" className={styles.helperText}>
                    Use at least eight characters.
                  </span>
                )}
              </div>

              {/* Consent Checkbox */}
              <label
                className={`${styles.consentRow} ${consentError ? styles.consentRowAlert : ''}`}
                htmlFor="chk-history-consent"
              >
                <input
                  id="chk-history-consent"
                  type="checkbox"
                  checked={hasConsented}
                  aria-invalid={consentError ? 'true' : undefined}
                  aria-describedby={consentError ? 'error-consent' : undefined}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setHasConsented(checked);
                    if (checked) {
                      setConsentError(false);
                      setErrorMsg((prev) =>
                        prev === 'Please accept the terms and conditions to continue.' ? null : prev
                      );
                    }
                  }}
                  className={styles.checkbox}
                  required
                />
                <span className={styles.consentText}>
                  I accept that Spotter stores my check-in history and email privately for 24 months, accessible only to my member account.
                </span>
              </label>
              {consentError && (
                <span id="error-consent" className={styles.fieldError} role="alert">
                  Please accept the terms and conditions to continue.
                </span>
              )}

              {/* Create Account Primary Button */}
              <div
                className={`${styles.submitButtonContainer} ${!isCreateFormValid ? styles.submitButtonDisabledContainer : ''}`}
                onClick={handleDisabledButtonClick}
              >
                <button
                  type="submit"
                  id="btn-submit-create-account"
                  className={styles.submitButton}
                  disabled={!isCreateFormValid || isSubmitting}
                  style={!isCreateFormValid ? { pointerEvents: 'none' } : undefined}
                >
                  {isSubmitting ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>

            </form>
          ) : (
            /* VIEW 2: LOG IN VIEW (Matches provided screenshot) */
            <form onSubmit={handleLoginSubmit} noValidate>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="input-login-id">
                  Email Address
                </label>
                <input
                  id="input-login-id"
                  type="text"
                  value={loginIdentifier}
                  onChange={(e) => {
                    setLoginIdentifier(e.target.value);
                    if (e.target.value.trim()) {
                      setLoginTouched((prev) => ({ ...prev, loginIdentifier: false }));
                    }
                  }}
                  onBlur={() => {
                    if (!loginIdentifier.trim()) {
                      setLoginTouched((prev) => ({ ...prev, loginIdentifier: true }));
                    }
                  }}
                  className={`${styles.input} ${loginErrors.loginIdentifier ? styles.inputError : ''}`}
                  placeholder="chioma@example.com"
                  aria-invalid={loginErrors.loginIdentifier ? 'true' : undefined}
                  aria-describedby={loginErrors.loginIdentifier ? 'error-input-login-id' : undefined}
                  required
                />
                {loginErrors.loginIdentifier && (
                  <span id="error-input-login-id" className={styles.fieldError} role="alert">
                    this field must not be empty
                  </span>
                )}
              </div>

              <div className={styles.formGroup}>
                <div className={styles.labelRow}>
                  <label className={styles.label} htmlFor="input-login-password">
                    Password
                  </label>
                  <button
                    type="button"
                    className={styles.forgotPasswordLink}
                    onClick={() => setErrorMsg('To reset your password, visit the gym desk (open 06:00 - 21:00).')}
                    id="btn-forgot-password"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className={`${styles.passwordWrapper} ${loginErrors.loginPassword ? styles.inputError : ''}`}>
                  <input
                    id="input-login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      if (e.target.value.trim()) {
                        setLoginTouched((prev) => ({ ...prev, loginPassword: false }));
                      }
                    }}
                    onBlur={() => {
                      const trimmed = loginPassword.trim();
                      if (trimmed !== loginPassword) {
                        setLoginPassword(trimmed);
                      }
                      if (!trimmed) {
                        setLoginTouched((prev) => ({ ...prev, loginPassword: true }));
                      }
                    }}
                    className={styles.passwordInput}
                    aria-invalid={loginErrors.loginPassword ? 'true' : undefined}
                    aria-describedby={loginErrors.loginPassword ? 'error-input-login-password' : undefined}
                    required
                  />
                  <button
                    type="button"
                    className={styles.showPasswordBtn}
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {loginErrors.loginPassword && (
                  <span id="error-input-login-password" className={styles.fieldError} role="alert">
                    this field must not be empty
                  </span>
                )}
              </div>

              <button
                type="submit"
                id="btn-submit-login"
                className={styles.submitButton}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Signing In...' : 'Log In'}
              </button>
            </form>
          )}
        </div>

        {/* Footer matching screenshot */}
        <div className={styles.cardFooter}>
          {mode === 'create' ? (
            <>
              Already registered?{' '}
              <button
                type="button"
                className={styles.footerLink}
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                  setCreateTouched({});
                  setLoginTouched({});
                }}
                id="link-switch-to-login"
              >
                Login to you account
              </button>
            </>
          ) : (
            <>
              New to Spotter?{' '}
              <button
                type="button"
                className={styles.footerLink}
                onClick={() => {
                  setMode('create');
                  setErrorMsg(null);
                  setCreateTouched({});
                  setLoginTouched({});
                }}
                id="link-switch-to-create"
              >
                Create an account
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
