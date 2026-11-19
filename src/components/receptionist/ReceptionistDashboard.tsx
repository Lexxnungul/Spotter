'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert,
  ClipboardList,
  TriangleAlert,
  CircleCheck,
  CircleDashed,
  Check,
  LockKeyhole,
  Lock,
  Ticket,
  Circle,
  Smartphone,
  Copy,
  Printer,
  FolderOpen,
  SquareArrowUpRightExit,
  Search,
  Scale,
  FileText,
  House,
  UserRound,
  LogOut,
  X,
  Mail,
  Phone,
  CalendarDays,
  Wallet,
  Clock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatMemberNumberDisplay } from '../../lib/member-number';
import { fuzzyMatch } from '../../lib/fuzzy-search';
import styles from './ReceptionistDashboard.module.css';

interface IssuedMember {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  memberNumber: string;
  tier: 'BASIC' | 'PREMIUM' | 'DIAMOND';
  status: string;
  expiryDate: string;
  openingBalanceKobo?: number;
  createdAt: string;
  isClaimed: boolean;
  isEmailVerified?: boolean;
  issuedBy?: {
    id: string;
    fullName: string;
    role: string;
  };
}

function formatIssuedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatAccountStatus(status?: string): string {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function formatNaira(kobo?: number): string {
  if (kobo === undefined || kobo === null) return '—';
  return `₦${(kobo / 100).toLocaleString('en-NG')}`;
}

export default function ReceptionistDashboard() {
  const router = useRouter();
  const { user, loginStaff, logout } = useAuth();

  // Intake Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [tier, setTier] = useState<'BASIC' | 'PREMIUM' | 'DIAMOND'>('PREMIUM');
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
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState(10);

  // Member Detail Modal
  const [selectedMember, setSelectedMember] = useState<IssuedMember | null>(null);

  // Staff Login Form (for unauthenticated gate)
  const [gateEmail, setGateEmail] = useState('');
  const [gatePassword, setGatePassword] = useState('');
  const [gateError, setGateError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Staff Avatar Dropdown Menu State
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(event.target as Node)) {
        setIsAvatarMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsAvatarMenuOpen(false);
      }
    }
    if (isAvatarMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAvatarMenuOpen]);

  // Close member detail modal on Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelectedMember(null);
      }
    }
    if (selectedMember) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [selectedMember]);

  // Update initial price suggestion when tier toggles
  const handleTierChange = (newTier: 'BASIC' | 'PREMIUM' | 'DIAMOND') => {
    setTier(newTier);
    if (newTier === 'DIAMOND') {
      setInitialPaymentNaira('45000');
    } else if (newTier === 'PREMIUM') {
      setInitialPaymentNaira('25000');
    } else if (newTier === 'BASIC') {
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

  // Reset to first page whenever the filter or page size changes
  useEffect(() => {
    setLedgerPage(1);
  }, [searchQuery, ledgerPageSize]);

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
    setGatePassword('SpotterDesk#2026!');
    setIsLoggingIn(true);
    const res = await loginStaff('desk@spottergym.com', 'SpotterDesk#2026!');
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
                type="text"
                className={styles.input}
                placeholder="desk@spottergym.com or desk"
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
            <ShieldAlert size={30} />
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

  // Filter recent issuances by query with typo-tolerant fuzzy matching, most relevant first
  const trimmedSearchQuery = searchQuery.trim();
  const filteredIssuances = recentIssuances
    .map((m) => ({
      member: m,
      score: trimmedSearchQuery
        ? fuzzyMatch(trimmedSearchQuery, [m.fullName, m.phone, m.memberNumber])
        : 1,
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (trimmedSearchQuery && b.score !== a.score) {
        return b.score - a.score;
      }
      return new Date(b.member.createdAt).getTime() - new Date(a.member.createdAt).getTime();
    })
    .map((entry) => entry.member);

  const totalPages = Math.max(1, Math.ceil(filteredIssuances.length / ledgerPageSize));
  const currentPage = Math.min(ledgerPage, totalPages);
  const pageStart = (currentPage - 1) * ledgerPageSize;
  const pageEnd = Math.min(pageStart + ledgerPageSize, filteredIssuances.length);
  const paginatedIssuances = filteredIssuances.slice(pageStart, pageStart + ledgerPageSize);

  return (
    <div className={styles.container}>
      {/* 1. Header Bar */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brandArea}>
            <div className={styles.logoBadge}>SPOTTER DESK</div>
            <h1 className={styles.terminalTitle}>
              Receptionist Terminal
            </h1>
          </div>

          <div className={styles.headerActions} ref={avatarMenuRef}>
            <button
              type="button"
              className={styles.avatarButton}
              onClick={() => setIsAvatarMenuOpen((prev) => !prev)}
              aria-label="Staff account menu"
              aria-expanded={isAvatarMenuOpen}
              aria-haspopup="true"
              id="btn-staff-avatar"
            >
              <span className={styles.avatarInitial} aria-hidden="true">
                {user.staff.fullName[0]?.toUpperCase() || 'S'}
              </span>
            </button>

            {isAvatarMenuOpen && (
              <div className={styles.avatarDropdown} id="staff-avatar-dropdown" role="menu">
                <div className={styles.dropdownStaffSection}>
                  <div className={styles.dropdownStaffAvatar} aria-hidden="true">
                    {user.staff.fullName[0]?.toUpperCase() || 'S'}
                  </div>
                  <div className={styles.dropdownStaffInfo}>
                    <span className={styles.dropdownStaffName}>{user.staff.fullName}</span>
                    <span className={styles.dropdownStaffRole}>
                      <span className={styles.onlinePulse} />
                      {user.staff.role === 'OWNER' ? 'Gym Owner' : 'Desk Receptionist'} • Active Shift
                    </span>
                  </div>
                </div>

                <div className={styles.dropdownDivider} />

                <div className={styles.dropdownMenuItems}>
                  <button
                    type="button"
                    className={styles.dropdownMenuItem}
                    onClick={() => {
                      setIsAvatarMenuOpen(false);
                      router.push('/');
                    }}
                    id="btn-go-home"
                    role="menuitem"
                  >
                    <House size={16} aria-hidden="true" />
                    <span>Home</span>
                  </button>

                  <button
                    type="button"
                    className={styles.dropdownMenuItem}
                    onClick={() => {
                      setIsAvatarMenuOpen(false);
                      router.push('/member');
                    }}
                    id="btn-preview-member-app"
                    role="menuitem"
                  >
                    <UserRound size={16} aria-hidden="true" />
                    <span>Member view</span>
                  </button>

                  <div className={styles.dropdownDivider} />

                  <button
                    type="button"
                    className={`${styles.dropdownMenuItem} ${styles.dropdownMenuItemDanger}`}
                    onClick={() => {
                      setIsAvatarMenuOpen(false);
                      logout();
                      router.push('/');
                    }}
                    id="btn-staff-logout"
                    role="menuitem"
                  >
                    <LogOut size={16} aria-hidden="true" />
                    <span>End Duty</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. Main Dashboard Body */}
      <main className={styles.main}>
        <div className={styles.gridTwoCol}>
          {/* Left Column: Intending Member Intake Form */}
          <section className={styles.card} aria-labelledby="form-heading">
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle} id="form-heading">
                  <ClipboardList size={18} /> Intending Member Intake
                </h2>
                <p className={styles.cardSubtitle}>
                  Issue a unique, cryptographically random 6-digit member number for a walk-in gym member.
                </p>
              </div>
            </div>

            {errorMessage && (
              <div className={styles.errorText} role="alert" id="intake-error-banner">
                <TriangleAlert size={14} /> {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className={styles.successHelper} role="status" id="intake-success-banner">
                <CircleCheck size={14} /> {successMessage}
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
                    {phoneCheckResult.exists ? <TriangleAlert size={13} /> : <Check size={13} />}
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
                      {tier === 'BASIC' && <Check size={16} style={{ color: 'var(--color-primary, #0044e3)' }} />}
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
                      {tier === 'PREMIUM' && <Check size={16} style={{ color: 'var(--color-primary, #0044e3)' }} />}
                    </div>
                    <span className={styles.tierPrice}>₦25,000 / month</span>
                    <span className={styles.tierDesc}>
                      All Basic perks + 1 monthly guest pass + custom training plans.
                    </span>
                  </div>

                  <div
                    className={`${styles.tierCard} ${tier === 'DIAMOND' ? styles.tierCardActive : ''}`}
                    onClick={() => handleTierChange('DIAMOND')}
                    role="radio"
                    aria-checked={tier === 'DIAMOND'}
                    tabIndex={0}
                    id="tier-option-diamond"
                  >
                    <div className={styles.tierName}>
                      <span>Diamond VIP</span>
                      {tier === 'DIAMOND' && <Check size={16} style={{ color: 'var(--color-primary, #0044e3)' }} />}
                    </div>
                    <span className={styles.tierPrice}>₦45,000 / month</span>
                    <span className={styles.tierDesc}>
                      VIP all-hours access + coach consultations + executive locker.
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
                    <LockKeyhole size={16} /> Generate & Issue 6-Digit Member Number
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
                  <Ticket size={18} /> Membership Card Issuance
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
                      <Circle size={8} style={{ color: 'var(--color-primary, #0044e3)', fill: 'var(--color-primary, #0044e3)' }} /> SPOTTER GYM &bull; LAGOS
                    </div>
                    <span
                      className={`${styles.slipTierBadge} ${
                        newlyIssuedMember.tier === 'DIAMOND'
                          ? styles.slipTierBadgeDiamond
                          : newlyIssuedMember.tier === 'PREMIUM'
                          ? styles.slipTierBadgePremium
                          : styles.slipTierBadgeBasic
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
                    <Smartphone size={15} /> Member Next Steps:
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
                    {copiedNumber === newlyIssuedMember.memberNumber ? (
                      <>
                        <Check size={14} /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={14} /> Copy Member Number
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className={styles.btnPrint}
                    onClick={handlePrintSlip}
                    id="btn-print-member-slip"
                  >
                    <Printer size={14} /> Print Card Slip
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
              <div className={styles.ledgerTitleRow}>
                <h2 className={styles.cardTitle} id="ledger-heading">
                  <FolderOpen size={18} /> Member Numbers Issued
                </h2>
                <button
                  type="button"
                  className={styles.infoButton}
                  aria-describedby="ledger-info-tooltip"
                  aria-label="About Member Numbers Issued"
                >
                  <SquareArrowUpRightExit size={15} aria-hidden="true" />
                  <span
                    id="ledger-info-tooltip"
                    role="tooltip"
                    className={styles.infoTooltip}
                  >
                    Audit record of numbers generated during your shift.
                  </span>
                </button>
              </div>
            </div>

            <div className={styles.searchBox}>
              <span className={styles.searchIcon} aria-hidden="true">
                <Search size={14} />
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
                  paginatedIssuances.map((item) => (
                    <tr
                      key={item.id}
                      className={styles.ledgerRow}
                      onClick={() => setSelectedMember(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedMember(item);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`View details for ${item.fullName}`}
                    >
                      <td style={{ fontWeight: 600, color: 'var(--color-on-background, #00174c)' }}>{item.fullName}</td>
                      <td>
                        <span className={styles.numberPill}>{item.memberNumber}</span>
                      </td>
                      <td>{item.phone}</td>
                      <td>
                        <span
                          className={`${styles.slipTierBadge} ${
                            item.tier === 'DIAMOND'
                              ? styles.slipTierBadgeDiamond
                              : item.tier === 'PREMIUM'
                              ? styles.slipTierBadgePremium
                              : styles.slipTierBadgeBasic
                          }`}
                        >
                          {item.tier}
                        </span>
                      </td>
                      <td>{formatIssuedDate(item.createdAt)}</td>
                      <td>
                        {item.isClaimed ? (
                          <span className={styles.statusClaimed}>
                            <CircleCheck size={13} /> Active on Portal
                          </span>
                        ) : (
                          <span className={styles.statusPending}>
                            <CircleDashed size={13} /> Awaiting Member Claim
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.btnTableAction}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyNumber(item.memberNumber);
                          }}
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

          {!isLoadingRecent && filteredIssuances.length > 0 && (
            <div className={styles.ledgerFooter}>
              <div className={styles.paginationInfo}>
                Showing <strong>{pageStart + 1}</strong>–<strong>{pageEnd}</strong> of{' '}
                <strong>{filteredIssuances.length}</strong>
              </div>

              <div className={styles.paginationControls}>
                <label className={styles.pageSizeControl}>
                  Rows per page
                  <select
                    className={styles.pageSizeSelect}
                    value={ledgerPageSize}
                    onChange={(e) => setLedgerPageSize(Number(e.target.value))}
                    aria-label="Rows per page"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </label>

                <button
                  type="button"
                  className={styles.pageBtn}
                  onClick={() => setLedgerPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                  aria-label="Previous page"
                >
                  Prev
                </button>
                <span className={styles.pageIndicator}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className={styles.pageBtn}
                  onClick={() => setLedgerPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Member Detail Modal */}
      {selectedMember && (() => {
        const isPortalActive = selectedMember.isClaimed && selectedMember.status === 'ACTIVE';
        const initials = selectedMember.fullName
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase())
          .join('');
        return (
          <div
            className={styles.modalOverlay}
            onClick={() => setSelectedMember(null)}
            role="presentation"
          >
            <div
              className={styles.memberModal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="member-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <div>
                  <span className={styles.modalEyebrow}>Member Issuance Details</span>
                  <h2 className={styles.modalTitle} id="member-modal-title">
                    {selectedMember.fullName}
                  </h2>
                </div>
                <button
                  type="button"
                  className={styles.modalCloseBtn}
                  onClick={() => setSelectedMember(null)}
                  aria-label="Close member details"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              <div className={styles.modalBody}>
                <div className={styles.memberModalHero}>
                  <div className={styles.memberModalAvatar} aria-hidden="true">
                    {initials || 'M'}
                  </div>
                  <div className={styles.memberModalHeroInfo}>
                    <div className={styles.memberModalNumber}>
                      {formatMemberNumberDisplay(selectedMember.memberNumber)}
                    </div>
                    <span
                      className={`${styles.slipTierBadge} ${
                        selectedMember.tier === 'DIAMOND'
                          ? styles.slipTierBadgeDiamond
                          : selectedMember.tier === 'PREMIUM'
                          ? styles.slipTierBadgePremium
                          : styles.slipTierBadgeBasic
                      }`}
                    >
                      {selectedMember.tier} MEMBERSHIP
                    </span>
                  </div>
                </div>

                <div className={styles.modalStatusRow}>
                  <span
                    className={
                      isPortalActive ? styles.modalStatusActive : styles.modalStatusInactive
                    }
                  >
                    {isPortalActive ? (
                      <CircleCheck size={14} aria-hidden="true" />
                    ) : (
                      <CircleDashed size={14} aria-hidden="true" />
                    )}
                    {isPortalActive
                      ? 'Active on Portal'
                      : selectedMember.isClaimed
                      ? 'Claimed • Inactive'
                      : 'Not Claimed • Inactive'}
                  </span>
                  <span
                    className={
                      selectedMember.status === 'ACTIVE'
                        ? styles.modalStatusActive
                        : styles.modalStatusInactive
                    }
                  >
                    {selectedMember.status === 'ACTIVE' ? (
                      <CircleCheck size={14} aria-hidden="true" />
                    ) : (
                      <CircleDashed size={14} aria-hidden="true" />
                    )}
                    Account: {formatAccountStatus(selectedMember.status)}
                  </span>
                </div>

                <dl className={styles.modalDetailGrid}>
                  <div className={styles.modalDetailItem}>
                    <dt>
                      <Phone size={14} aria-hidden="true" /> Phone
                    </dt>
                    <dd>{selectedMember.phone}</dd>
                  </div>
                  <div className={styles.modalDetailItem}>
                    <dt>
                      <Mail size={14} aria-hidden="true" /> Email
                    </dt>
                    <dd>{selectedMember.email || 'Not provided'}</dd>
                  </div>
                  <div className={styles.modalDetailItem}>
                    <dt>
                      <Ticket size={14} aria-hidden="true" /> Tier
                    </dt>
                    <dd>{formatAccountStatus(selectedMember.tier)}</dd>
                  </div>
                  <div className={styles.modalDetailItem}>
                    <dt>
                      <Smartphone size={14} aria-hidden="true" /> Portal Claim
                    </dt>
                    <dd>
                      {selectedMember.isClaimed
                        ? 'Member number claimed'
                        : 'Awaiting member claim'}
                    </dd>
                  </div>
                  <div className={styles.modalDetailItem}>
                    <dt>
                      <CircleCheck size={14} aria-hidden="true" /> Email Verification
                    </dt>
                    <dd>
                      {selectedMember.isEmailVerified ? 'Verified' : 'Not verified'}
                    </dd>
                  </div>
                  <div className={styles.modalDetailItem}>
                    <dt>
                      <Wallet size={14} aria-hidden="true" /> Opening Balance
                    </dt>
                    <dd>{formatNaira(selectedMember.openingBalanceKobo)}</dd>
                  </div>
                  <div className={styles.modalDetailItem}>
                    <dt>
                      <Clock size={14} aria-hidden="true" /> Issued Date
                    </dt>
                    <dd>{formatIssuedDate(selectedMember.createdAt)}</dd>
                  </div>
                  <div className={styles.modalDetailItem}>
                    <dt>
                      <CalendarDays size={14} aria-hidden="true" /> Expiry Date
                    </dt>
                    <dd>{selectedMember.expiryDate}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 3. Security Ribbon */}
      <div className={styles.securityRibbon}>
        <div className={styles.securityRibbonInner}>
          <div className={styles.securityItem}>
            <Lock size={14} className={styles.securityIcon} aria-hidden="true" />
            <span>Security Policy: Row-Level Isolation & CSPRNG Number Generation</span>
          </div>
          <div className={styles.securityItem}>
            <Scale size={14} className={styles.securityIcon} aria-hidden="true" />
            <span>Compliance: NDPA 2023 Consent Flow Protected</span>
          </div>
          <div className={styles.securityItem}>
            <FileText size={14} className={styles.securityIcon} aria-hidden="true" />
            <span>Actor Audit: All issued numbers logged under ID {user.staff.id}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
