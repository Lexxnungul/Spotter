'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { formatMemberNumberDisplay } from '../../lib/member-number';
import styles from './ReceptionistDashboard.module.css';

interface IssuedMember {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  memberNumber: string;
  tier: 'BASIC' | 'PREMIUM';
  status: string;
  expiryDate: string;
  openingBalanceKobo?: number;
  createdAt: string;
  isClaimed: boolean;
  issuedBy?: {
    id: string;
    fullName: string;
    role: string;
  };
}

export default function ReceptionistDashboard() {
  const router = useRouter();
  const { user, loginStaff, logout } = useAuth();

  // Intake Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [tier, setTier] = useState<'BASIC' | 'PREMIUM'>('PREMIUM');
  const [initialPaymentNaira, setInitialPaymentNaira] = useState('25000');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'POS' | 'PENDING'>('CASH');
  const [notes, setNotes] = useState('');

  // UI & Loading States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [phoneCheckResult, setPhoneCheckResult] = useState<{ exists: boolean; message?: string } | null>(null);
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

  // Newly Issued Member (to show slip)
  const [newlyIssuedMember, setNewlyIssuedMember] = useState<IssuedMember | null>(null);

  // Recent Issuances List & Search
  const [recentIssuances, setRecentIssuances] = useState<IssuedMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);

  // Staff Login Form (for unauthenticated gate)
  const [gateEmail, setGateEmail] = useState('');
  const [gatePassword, setGatePassword] = useState('');
  const [gateError, setGateError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Update initial price suggestion when tier toggles
  const handleTierChange = (newTier: 'BASIC' | 'PREMIUM') => {
    setTier(newTier);
    if (newTier === 'PREMIUM' && initialPaymentNaira === '15000') {
      setInitialPaymentNaira('25000');
    } else if (newTier === 'BASIC' && initialPaymentNaira === '25000') {
      setInitialPaymentNaira('15000');
    }
  };

  // Fetch recent issuances
  const loadRecentIssuances = useCallback(async () => {
    if (!user || user.type !== 'staff') return;
    setIsLoadingRecent(true);
    try {
      const res = await fetch('/api/receptionist/recent-issuances', {
        headers: {
          'x-staff-id': user.staff.id,
          'x-staff-email': user.staff.email,
          'x-staff-role': user.staff.role,
        },
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.issuances)) {
        setRecentIssuances(data.issuances);
      }
    } catch {
      // Ignore network errors in demo mode
    } finally {
      setIsLoadingRecent(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && user.type === 'staff') {
      loadRecentIssuances();
    }
  }, [user, loadRecentIssuances]);

  // Real-time phone check on blur or 11 digits
  const checkExistingPhone = async (val: string) => {
    const clean = val.trim();
    if (clean.length < 10) {
      setPhoneCheckResult(null);
      return;
    }

    if (!user || user.type !== 'staff') return;

    try {
      const res = await fetch('/api/receptionist/check-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-staff-id': user.staff.id,
          'x-staff-email': user.staff.email,
          'x-staff-role': user.staff.role,
        },
        body: JSON.stringify({ phone: clean }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.exists && data.member) {
          setPhoneCheckResult({
            exists: true,
            message: `Existing member found: ${data.member.fullName} (#${data.member.memberNumber})`,
          });
        } else {
          setPhoneCheckResult({
            exists: false,
            message: 'Phone number verified. No prior registration found.',
          });
        }
      }
    } catch {
      // Ignore check failure
    }
  };

  // Handle Form Submission (Generate Member Number)
  const handleGenerateMemberNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!user || user.type !== 'staff') {
      setErrorMessage('Staff session expired. Please sign in again.');
      return;
    }

    if (!fullName.trim() || fullName.trim().split(/\s+/).length < 2) {
      setErrorMessage('Please enter intending member’s full name (at least 2 words).');
      return;
    }

    if (!phone.trim()) {
      setErrorMessage('Please enter a valid phone number.');
      return;
    }

    const paymentNumber = parseInt(initialPaymentNaira.replace(/,/g, '') || '0', 10);
    const initialPaymentKobo = isNaN(paymentNumber) ? 0 : paymentNumber * 100;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/receptionist/generate-member-number', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-staff-id': user.staff.id,
          'x-staff-email': user.staff.email,
          'x-staff-role': user.staff.role,
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          tier,
          email: email.trim() || undefined,
          initialPaymentKobo,
          paymentMethod,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Failed to generate member number.');
        return;
      }

      // Success
      const issued = data.member as IssuedMember;
      setNewlyIssuedMember(issued);
      setSuccessMessage(`Member Number ${issued.memberNumber} generated successfully for ${issued.fullName}!`);
      setRecentIssuances((prev) => [issued, ...prev]);

      // Scroll to issued card
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch {
      setErrorMessage('Network error while generating member number. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form for next member
  const handleIssueAnother = () => {
    setNewlyIssuedMember(null);
    setFullName('');
    setPhone('');
    setEmail('');
    setNotes('');
    setPhoneCheckResult(null);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Copy Member Number
  const handleCopyNumber = (num: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(num);
      setCopiedNumber(num);
      setTimeout(() => setCopiedNumber(null), 2500);
    }
  };

  // Print Member Slip
  const handlePrintSlip = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // Handle Gate Login
  const handleGateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGateError(null);
    setIsLoggingIn(true);
    const res = await loginStaff(gateEmail, gatePassword);
    setIsLoggingIn(false);
    if (!res.success) {
      setGateError(res.error || 'Invalid staff credentials.');
    }
  };

  // Quick Demo Access
  const handleQuickDemoStaff = async () => {
    setGateEmail('desk@spottergym.com');
    setGatePassword('deskpassword');
    setIsLoggingIn(true);
    const res = await loginStaff('desk@spottergym.com', 'deskpassword');
    setIsLoggingIn(false);
    if (!res.success) {
      setGateError(res.error || 'Demo login failed.');
    }
  };

  // 1. UN趋THENTICATED STATE: Show Staff Gate
  if (!user) {
    return (
      <div className={styles.gateContainer}>
        <div className={styles.gateCard}>
          <div className={styles.gateHeader}>
            <div className={styles.logoBadge}>SPOTTER DESK</div>
            <h1 className={styles.gateTitle} id="gate-title">Receptionist Terminal</h1>
            <p className={styles.gateSubtitle}>
              Protected front-desk system. Authorized gym staff and receptionists only.
            </p>
          </div>

          {gateError && (
            <div className={styles.errorText} style={{ textAlign: 'center' }}>
              {gateError}
            </div>
          )}

          <form onSubmit={handleGateSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="staff-email-input">
                Staff Email Address
              </label>
              <input
                id="staff-email-input"
                type="email"
                className={styles.input}
                placeholder="desk@spottergym.com"
                value={gateEmail}
                onChange={(e) => setGateEmail(e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="staff-password-input">
                Staff Password
              </label>
              <input
                id="staff-password-input"
                type="password"
                className={styles.input}
                placeholder="••••••••••••"
                value={gatePassword}
                onChange={(e) => setGatePassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={isLoggingIn}
              id="btn-staff-gate-login"
            >
              {isLoggingIn ? 'Authenticating...' : 'Sign In to Desk Terminal'}
            </button>
          </form>

          <div className={styles.quickDemoBox}>
            <span className={styles.quickDemoLabel}>Instant Test Access (Pair-Programming Demo)</span>
            <button
              type="button"
              className={styles.btnDemoLogin}
              onClick={handleQuickDemoStaff}
              id="btn-quick-desk-demo"
            >
              Log In as Chioma Okeke (Desk Staff)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. FORBIDDEN STATE: Member attempts to access Staff Terminal
  if (user.type === 'member') {
    return (
      <div className={styles.forbiddenContainer}>
        <div className={styles.forbiddenCard}>
          <div className={styles.forbiddenIcon} aria-hidden="true">
            🛡️
          </div>
          <span className={styles.slipTierBadge} style={{ background: '#ef4444' }}>
            403 - FORBIDDEN ACCESS
          </span>
          <h1 className={styles.forbiddenTitle}>Staff Permission Required</h1>
          <p className={styles.forbiddenText}>
            You are currently signed in as a gym member (
            <strong>{user.member.fullName}</strong>). The Receptionist Dashboard and Member Number
            Generator are strictly restricted to authorized gym front desk staff.
          </p>
          <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '8px' }}>
            <button
              type="button"
              className={styles.btnPrimary}
              style={{ flex: 1 }}
              onClick={() => router.push('/member')}
              id="btn-return-member"
            >
              Return to Member App
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => {
                logout();
                router.push('/');
              }}
              id="btn-switch-account"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Filter recent issuances by query
  const filteredIssuances = recentIssuances.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.fullName.toLowerCase().includes(q) ||
      m.phone.includes(q) ||
      m.memberNumber.includes(q)
    );
  });

  return (
    <div className={styles.container}>
      {/* 1. Header Bar */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brandArea}>
            <div className={styles.logoBadge}>SPOTTER DESK</div>
            <h1 className={styles.terminalTitle}>
              Front Desk Terminal <span className={styles.terminalTag}>Lagos HQ</span>
            </h1>
          </div>

          <div className={styles.receptionistBadge}>
            <div className={styles.staffAvatar} aria-hidden="true">
              {user.staff.fullName[0]}
            </div>
            <div className={styles.staffInfo}>
              <span className={styles.staffName}>{user.staff.fullName}</span>
              <span className={styles.staffRole}>
                <span className={styles.onlinePulse} />
                {user.staff.role === 'OWNER' ? 'Gym Owner' : 'Desk Receptionist'} • Active Shift
              </span>
            </div>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => router.push('/')}
              id="btn-go-home"
            >
              Home
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => router.push('/member')}
              id="btn-preview-member-app"
            >
              Member View
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => {
                logout();
                router.push('/');
              }}
              id="btn-staff-logout"
            >
              End Duty
            </button>
          </div>
        </div>
      </header>

      {/* 2. Security Ribbon */}
      <div className={styles.securityRibbon}>
        <div className={styles.securityRibbonInner}>
          <div className={styles.securityItem}>
            <span className={styles.securityIcon}>🔒</span>
            <span>Security Policy: Row-Level Isolation & CSPRNG Number Generation</span>
          </div>
          <div className={styles.securityItem}>
            <span className={styles.securityIcon}>⚖️</span>
            <span>Compliance: NDPA 2023 Consent Flow Protected</span>
          </div>
          <div className={styles.securityItem}>
            <span className={styles.securityIcon}>📝</span>
            <span>Actor Audit: All issued numbers logged under ID {user.staff.id}</span>
          </div>
        </div>
      </div>

      {/* 3. Main Dashboard Body */}
      <main className={styles.main}>
        <div className={styles.gridTwoCol}>
          {/* Left Column: Intending Member Intake Form */}
          <section className={styles.card} aria-labelledby="form-heading">
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle} id="form-heading">
                  <span>📋</span> Intending Member Intake
                </h2>
                <p className={styles.cardSubtitle}>
                  Issue a unique, cryptographically random 6-digit member number for a walk-in gym member.
                </p>
              </div>
            </div>

            {errorMessage && (
              <div className={styles.errorText} role="alert" id="intake-error-banner">
                ⚠️ {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className={styles.successHelper} role="status" id="intake-success-banner">
                ✅ {successMessage}
              </div>
            )}

            <form onSubmit={handleGenerateMemberNumber} className={styles.form}>
              {/* Full Name */}
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="input-full-name">
                  Full Name <span className={styles.requiredStar}>*</span>
                </label>
                <input
                  id="input-full-name"
                  type="text"
                  className={styles.input}
                  placeholder="e.g. Babatunde Fashola"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              {/* Phone Number */}
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="input-phone">
                  Nigerian Phone Number <span className={styles.requiredStar}>*</span>
                </label>
                <input
                  id="input-phone"
                  type="tel"
                  className={styles.input}
                  placeholder="0803 123 4567 or +234 803 123 4567"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (phoneCheckResult) setPhoneCheckResult(null);
                  }}
                  onBlur={(e) => checkExistingPhone(e.target.value)}
                  required
                />
                {phoneCheckResult && (
                  <span
                    className={phoneCheckResult.exists ? styles.errorText : styles.successHelper}
                    id="phone-check-indicator"
                  >
                    {phoneCheckResult.exists ? '⚠️ ' : '✓ '}
                    {phoneCheckResult.message}
                  </span>
                )}
              </div>

              {/* Email Address (Optional) */}
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="input-email">
                  Email Address <span className={styles.optionalTag}>(Optional - for digital slip)</span>
                </label>
                <input
                  id="input-email"
                  type="email"
                  className={styles.input}
                  placeholder="member@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {/* Tier Selection */}
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Membership Tier <span className={styles.requiredStar}>*</span>
                </label>
                <div className={styles.tierGrid} role="radiogroup" aria-label="Membership Tier">
                  <div
                    className={`${styles.tierCard} ${tier === 'BASIC' ? styles.tierCardActive : ''}`}
                    onClick={() => handleTierChange('BASIC')}
                    role="radio"
                    aria-checked={tier === 'BASIC'}
                    tabIndex={0}
                    id="tier-option-basic"
                  >
                    <div className={styles.tierName}>
                      <span>Basic Tier</span>
                      {tier === 'BASIC' && <span style={{ color: '#38bdf8' }}>✓</span>}
                    </div>
                    <span className={styles.tierPrice}>₦15,000 / month</span>
                    <span className={styles.tierDesc}>
                      Standard gym access, timetables, rules & access hours.
                    </span>
                  </div>

                  <div
                    className={`${styles.tierCard} ${tier === 'PREMIUM' ? styles.tierCardActive : ''}`}
                    onClick={() => handleTierChange('PREMIUM')}
                    role="radio"
                    aria-checked={tier === 'PREMIUM'}
                    tabIndex={0}
                    id="tier-option-premium"
                  >
                    <div className={styles.tierName}>
                      <span>Premium Tier</span>
                      {tier === 'PREMIUM' && <span style={{ color: '#38bdf8' }}>✓</span>}
                    </div>
                    <span className={styles.tierPrice}>₦25,000 / month</span>
                    <span className={styles.tierDesc}>
                      All Basic perks + 1 monthly guest pass + custom training plans.
                    </span>
                  </div>
                </div>
              </div>

              {/* Initial Payment & Method */}
              <div className={styles.paymentRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="input-payment-amount">
                    Initial Payment (₦)
                  </label>
                  <input
                    id="input-payment-amount"
                    type="number"
                    step="500"
                    className={styles.input}
                    value={initialPaymentNaira}
                    onChange={(e) => setInitialPaymentNaira(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="select-payment-method">
                    Payment Method
                  </label>
                  <select
                    id="select-payment-method"
                    className={styles.select}
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                  >
                    <option value="CASH">Cash at Desk</option>
                    <option value="POS">POS Terminal</option>
                    <option value="TRANSFER">Bank Transfer</option>
                    <option value="PENDING">Payment Pending</option>
                  </select>
                </div>
              </div>

              {/* Staff Notes */}
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="input-notes">
                  Desk Notes / Emergency Contact <span className={styles.optionalTag}>(Optional)</span>
                </label>
                <input
                  id="input-notes"
                  type="text"
                  className={styles.input}
                  placeholder="e.g. Referred by Emeka, Paid cash to Chioma"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                />
              </div>

              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={isSubmitting}
                id="btn-generate-member-number"
              >
                {isSubmitting ? (
                  <span>Generating Secure Member Number...</span>
                ) : (
                  <>
                    <span>🔐</span> Generate & Issue 6-Digit Member Number
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Right Column: Issued Slip Preview or Front Desk Guidelines */}
          <section className={styles.card} aria-labelledby="preview-heading">
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle} id="preview-heading">
                  <span>🎫</span> Membership Card Issuance
                </h2>
                <p className={styles.cardSubtitle}>
                  Print physical slip or copy 6-digit member number for the intending member.
                </p>
              </div>
            </div>

            {newlyIssuedMember ? (
              <div className={styles.issuedCardWrapper}>
                {/* Physical Gym Slip Mockup */}
                <div className={styles.membershipSlip} id="printable-membership-slip">
                  <div className={styles.slipHeader}>
                    <div className={styles.slipGymLogo}>
                      <span style={{ color: '#38bdf8' }}>●</span> SPOTTER GYM &bull; LAGOS
                    </div>
                    <span
                      className={`${styles.slipTierBadge} ${
                        newlyIssuedMember.tier === 'BASIC' ? styles.slipTierBadgeBasic : ''
                      }`}
                    >
                      {newlyIssuedMember.tier} MEMBERSHIP
                    </span>
                  </div>

                  <h3 className={styles.slipMemberName}>{newlyIssuedMember.fullName}</h3>
                  <p className={styles.slipPhone}>Phone: {newlyIssuedMember.phone}</p>

                  <div className={styles.memberNumberDisplayBox}>
                    <div className={styles.numberLabel}>Your 6-Digit Gym Member Number</div>
                    <div className={styles.bigNumber} id="issued-member-number-display">
                      {formatMemberNumberDisplay(newlyIssuedMember.memberNumber)}
                    </div>
                  </div>

                  <div className={styles.slipMeta}>
                    <span>Valid until: {newlyIssuedMember.expiryDate}</span>
                    <span>Issued by: {user.staff.fullName}</span>
                  </div>
                </div>

                {/* Member Portal Activation Instructions */}
                <div className={styles.activationInstructions}>
                  <h4 className={styles.instructionsTitle}>
                    <span>📱</span> Member Next Steps:
                  </h4>
                  <ol className={styles.stepList}>
                    <li>
                      Visit <strong>spottergym.app/auth</strong> on your mobile phone.
                    </li>
                    <li>
                      Tap <em>Create Account</em> and enter your 6-digit Member Number (
                      <strong>{newlyIssuedMember.memberNumber}</strong>).
                    </li>
                    <li>
                      Create an 8+ character password to activate your personal gym check-in portal.
                    </li>
                  </ol>
                </div>

                {/* Actions */}
                <div className={styles.cardActionButtons}>
                  <button
                    type="button"
                    className={styles.btnCopy}
                    onClick={() => handleCopyNumber(newlyIssuedMember.memberNumber)}
                    id="btn-copy-member-number"
                  >
                    {copiedNumber === newlyIssuedMember.memberNumber ? '✓ Copied!' : '📋 Copy Member Number'}
                  </button>
                  <button
                    type="button"
                    className={styles.btnPrint}
                    onClick={handlePrintSlip}
                    id="btn-print-member-slip"
                  >
                    🖨️ Print Card Slip
                  </button>
                </div>

                <button
                  type="button"
                  className={styles.btnNext}
                  onClick={handleIssueAnother}
                  id="btn-issue-another"
                >
                  + Issue Another Member Number
                </button>
              </div>
            ) : (
              /* When no number is issued yet: Front Desk Guidelines */
              <div className={styles.policyList}>
                <div className={styles.policyItem}>
                  <div className={styles.policyIcon}>1</div>
                  <div className={styles.policyContent}>
                    <div className={styles.policyTitle}>Verify Intending Member ID</div>
                    <div className={styles.policyDesc}>
                      Check government or employee identification to confirm full legal name before generating card.
                    </div>
                  </div>
                </div>

                <div className={styles.policyItem}>
                  <div className={styles.policyIcon}>2</div>
                  <div className={styles.policyContent}>
                    <div className={styles.policyTitle}>Secure Number Generation</div>
                    <div className={styles.policyDesc}>
                      Each member number is cryptographically generated via CSPRNG and checked against collision in the active database.
                    </div>
                  </div>
                </div>

                <div className={styles.policyItem}>
                  <div className={styles.policyIcon}>3</div>
                  <div className={styles.policyContent}>
                    <div className={styles.policyTitle}>Hand Physical Card & Member Number</div>
                    <div className={styles.policyDesc}>
                      Write or print the 6-digit member number onto the physical Spotter gym access card.
                    </div>
                  </div>
                </div>

                <div className={styles.policyItem}>
                  <div className={styles.policyIcon}>4</div>
                  <div className={styles.policyContent}>
                    <div className={styles.policyTitle}>Direct Member to Self-Activate</div>
                    <div className={styles.policyDesc}>
                      Tell the member to visit spottergym.app/auth to link their card, set their password, and complete email verification.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Bottom Section: Recent Issuances Ledger */}
        <section className={styles.ledgerSection} aria-labelledby="ledger-heading">
          <div className={styles.ledgerHeader}>
            <div>
              <h2 className={styles.cardTitle} id="ledger-heading">
                <span>🗂️</span> Recent Member Numbers Issued
              </h2>
              <p className={styles.cardSubtitle}>
                Audit record of numbers generated during your shift.
              </p>
            </div>

            <div className={styles.searchBox}>
              <span className={styles.searchIcon} aria-hidden="true">
                🔍
              </span>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search by name, phone or number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                id="input-ledger-search"
              />
            </div>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Member Name</th>
                  <th>Member Number</th>
                  <th>Phone</th>
                  <th>Tier</th>
                  <th>Issued Date</th>
                  <th>Portal Claim Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingRecent ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>
                      Loading recent issuances...
                    </td>
                  </tr>
                ) : filteredIssuances.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                      No recent member numbers found.
                    </td>
                  </tr>
                ) : (
                  filteredIssuances.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600, color: '#ffffff' }}>{item.fullName}</td>
                      <td>
                        <span className={styles.numberPill}>{item.memberNumber}</span>
                      </td>
                      <td>{item.phone}</td>
                      <td>
                        <span
                          className={`${styles.slipTierBadge} ${
                            item.tier === 'BASIC' ? styles.slipTierBadgeBasic : ''
                          }`}
                        >
                          {item.tier}
                        </span>
                      </td>
                      <td>{item.expiryDate}</td>
                      <td>
                        {item.isClaimed ? (
                          <span className={styles.statusClaimed}>
                            <span>●</span> Active on Portal
                          </span>
                        ) : (
                          <span className={styles.statusPending}>
                            <span>○</span> Awaiting Member Claim
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.btnTableAction}
                          onClick={() => handleCopyNumber(item.memberNumber)}
                          title="Copy Member Number"
                        >
                          {copiedNumber === item.memberNumber ? 'Copied' : 'Copy'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
