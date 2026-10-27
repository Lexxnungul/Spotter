'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface MemberSession {
  id: string;
  fullName: string;
  phone: string;
  tier: 'BASIC' | 'PREMIUM';
  status: 'ACTIVE' | 'PAUSED' | 'LEFT';
  expiryDate: string;
  daysTrained: number;
  balanceKobo: number;
  deviceToken: string;
  linkedAt: string;
  consentedAt?: string;
  pinHash?: string;
  email?: string;
  memberNumber?: string;
  password?: string;
  isEmailVerified?: boolean;
}

export interface StaffSession {
  id: string;
  fullName: string;
  email: string;
  role: 'STAFF' | 'OWNER';
  whatsapp: string;
}

export type AuthUser = 
  | { type: 'member'; member: MemberSession }
  | { type: 'staff'; staff: StaffSession }
  | null;

export type AuthViewMode = 'create' | 'login' | 'pin' | 'activate' | 'staff';

interface AuthContextType {
  user: AuthUser;
  isAuthenticated: boolean;
  lockoutRemainingSeconds: number;
  isAuthModalOpen: boolean;
  authModalInitialTab: AuthViewMode;
  openAuthModal: (tab?: AuthViewMode) => void;
  closeAuthModal: () => void;
  createAccount: (data: {
    fullName: string;
    email: string;
    memberNumber: string;
    password: string;
    hasConsented: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
  loginWithCredentials: (
    identifier: string,
    password: string
  ) => Promise<{ success: boolean; error?: string; user?: AuthUser }>;
  loginWithPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  activateMember: (code: string, pin: string, consent: boolean) => Promise<{ success: boolean; error?: string }>;
  loginStaff: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: AuthUser }>;
  verifyEmail: (code: string) => Promise<{ success: boolean; error?: string }>;
  resendVerificationEmail: () => Promise<{ success: boolean; error?: string; message?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo seed data for instant pair-programming review
export const DEMO_MEMBER_CHIOMA: MemberSession = {
  id: 'mem_1042',
  fullName: 'Chioma Adeyemi',
  email: 'chioma@example.com',
  memberNumber: '1042',
  phone: '+234 802 345 6789',
  tier: 'PREMIUM',
  status: 'ACTIVE',
  expiryDate: '28 October 2026',
  daysTrained: 12,
  balanceKobo: 0,
  deviceToken: 'dev_tok_chioma_1042',
  linkedAt: new Date().toISOString(),
  consentedAt: new Date().toISOString(),
  password: 'password123',
  isEmailVerified: true,
};

export const DEMO_MEMBER: MemberSession = {
  id: 'mem_demo_01',
  fullName: 'Tunde Bakare',
  phone: '+234 801 234 5678',
  tier: 'PREMIUM',
  status: 'ACTIVE',
  expiryDate: '28 October 2026',
  daysTrained: 14,
  balanceKobo: 0,
  deviceToken: 'dev_tok_sec_99a8',
  linkedAt: new Date().toISOString(),
  consentedAt: new Date().toISOString(),
  pinHash: '1234',
  isEmailVerified: true,
};

export const DEMO_ACTIVATION_CODES: Record<string, Partial<MemberSession>> = {
  '849201': {
    id: 'mem_demo_01',
    fullName: 'Tunde Bakare',
    phone: '+234 801 234 5678',
    tier: 'PREMIUM',
    status: 'ACTIVE',
    expiryDate: '28 October 2026',
    daysTrained: 14,
    balanceKobo: 0,
  },
  '123456': {
    id: 'mem_demo_02',
    fullName: 'Amina Bello',
    phone: '+234 802 987 6543',
    tier: 'BASIC',
    status: 'ACTIVE',
    expiryDate: '15 November 2026',
    daysTrained: 6,
    balanceKobo: 500000, // 5,000 naira
  },
};

const STORAGE_SESSION_KEY = 'spotter_auth_session';
const STORAGE_REGISTERED_MEMBERS_KEY = 'spotter_registered_members';
const STORAGE_FAILED_PINS_KEY = 'spotter_failed_pin_tries';
const STORAGE_LOCKOUT_UNTIL_KEY = 'spotter_pin_lockout_until';
const MAX_FAILED_PINS = 5;
const LOCKOUT_DURATION_SECONDS = 30 * 60; // 30 minutes (FR-8)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalInitialTab, setAuthModalInitialTab] = useState<AuthViewMode>('create');
  const [lockoutRemainingSeconds, setLockoutRemainingSeconds] = useState<number>(0);

  // Initialize session and lockout state from storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_SESSION_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
      }

      const lockoutUntil = localStorage.getItem(STORAGE_LOCKOUT_UNTIL_KEY);
      if (lockoutUntil) {
        const remaining = Math.max(0, Math.floor((parseInt(lockoutUntil, 10) - Date.now()) / 1000));
        setLockoutRemainingSeconds(remaining);
      }
    } catch {
      // Storage unavailable or invalid JSON fallback
    }
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutRemainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setLockoutRemainingSeconds((prev) => {
        if (prev <= 1) {
          localStorage.removeItem(STORAGE_LOCKOUT_UNTIL_KEY);
          localStorage.removeItem(STORAGE_FAILED_PINS_KEY);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutRemainingSeconds]);

  const openAuthModal = (tab: AuthViewMode = 'create') => {
    setAuthModalInitialTab(tab);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const loginWithPin = async (pin: string): Promise<{ success: boolean; error?: string }> => {
    if (lockoutRemainingSeconds > 0) {
      const mins = Math.ceil(lockoutRemainingSeconds / 60);
      return {
        success: false,
        error: `Too many tries. Device locked for ${mins} more minute(s). The desk is open 06:00 - 21:00.`,
      };
    }

    // Default pin for demo member is '1234'
    const storedFailed = parseInt(localStorage.getItem(STORAGE_FAILED_PINS_KEY) || '0', 10);
    const validPin = DEMO_MEMBER.pinHash;

    if (pin === validPin) {
      // Success
      localStorage.removeItem(STORAGE_FAILED_PINS_KEY);
      localStorage.removeItem(STORAGE_LOCKOUT_UNTIL_KEY);
      const sessionData: AuthUser = { type: 'member', member: DEMO_MEMBER };
      setUser(sessionData);
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(sessionData));
      setIsAuthModalOpen(false);
      return { success: true };
    } else {
      const newFailed = storedFailed + 1;
      localStorage.setItem(STORAGE_FAILED_PINS_KEY, newFailed.toString());

      if (newFailed >= MAX_FAILED_PINS) {
        const lockoutUntil = Date.now() + LOCKOUT_DURATION_SECONDS * 1000;
        localStorage.setItem(STORAGE_LOCKOUT_UNTIL_KEY, lockoutUntil.toString());
        setLockoutRemainingSeconds(LOCKOUT_DURATION_SECONDS);
        return {
          success: false,
          error: 'Too many tries. Get a new code at the desk. The desk is open 06:00 - 21:00.',
        };
      }

      return {
        success: false,
        error: `Invalid PIN. ${MAX_FAILED_PINS - newFailed} attempt(s) remaining before device lockout.`,
      };
    }
  };

  const activateMember = async (
    code: string,
    pin: string,
    consent: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    if (!consent) {
      return {
        success: false,
        error: 'You must agree to the NDPA 2023 Data Protection notice to link this device.',
      };
    }

    const cleanCode = code.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      return {
        success: false,
        error: 'That code is not right. Please enter a 6-digit code from the gym desk.',
      };
    }

    if (!/^\d{4}$/.test(pin)) {
      return {
        success: false,
        error: 'PIN must be exactly 4 digits.',
      };
    }

    const memberDetails = DEMO_ACTIVATION_CODES[cleanCode];
    if (!memberDetails) {
      return {
        success: false,
        error: 'That code is not right or has expired. Check with the desk.',
      };
    }

    const newMember: MemberSession = {
      id: memberDetails.id || 'mem_new',
      fullName: memberDetails.fullName || 'Gym Member',
      phone: memberDetails.phone || '+234 800 000 0000',
      tier: memberDetails.tier || 'PREMIUM',
      status: memberDetails.status || 'ACTIVE',
      expiryDate: memberDetails.expiryDate || '28 October 2026',
      daysTrained: memberDetails.daysTrained || 0,
      balanceKobo: memberDetails.balanceKobo || 0,
      deviceToken: `dev_tok_${Math.random().toString(36).slice(2, 10)}`,
      linkedAt: new Date().toISOString(),
      consentedAt: new Date().toISOString(),
      pinHash: pin,
    };

    const sessionData: AuthUser = { type: 'member', member: newMember };
    setUser(sessionData);
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(sessionData));
    localStorage.removeItem(STORAGE_FAILED_PINS_KEY);
    localStorage.removeItem(STORAGE_LOCKOUT_UNTIL_KEY);
    setIsAuthModalOpen(false);

    return { success: true };
  };

  const loginStaff = async (email: string, password: string): Promise<{ success: boolean; error?: string; user?: AuthUser }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      return { success: false, error: 'Email and password are required.' };
    }

    try {
      const res = await loginWithCredentials(cleanEmail, cleanPassword);
      if (res.success && res.user && res.user.type === 'staff') {
        return { success: true, user: res.user };
      }
      if (!res.success && res.error) {
        return { success: false, error: res.error };
      }
    } catch {
      // Fallback to static check below
    }

    if (cleanEmail === 'owner@spottergym.com' && cleanPassword === 'ownerpassword') {
      const staffData: AuthUser = {
        type: 'staff',
        staff: {
          id: 'staff_owner_01',
          fullName: 'Emeka Eze (Owner)',
          email: 'owner@spottergym.com',
          role: 'OWNER',
          whatsapp: '+234 803 111 2222',
        },
      };
      setUser(staffData);
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(staffData));
      setIsAuthModalOpen(false);
      return { success: true, user: staffData };
    }

    if (
      cleanEmail === 'desk@spottergym.com' &&
      (cleanPassword === 'deskpassword' || cleanPassword === 'SpotterDesk#2026!')
    ) {
      const staffData: AuthUser = {
        type: 'staff',
        staff: {
          id: 'staff_desk_01',
          fullName: 'Chioma Okeke (Desk Staff)',
          email: 'desk@spottergym.com',
          role: 'STAFF',
          whatsapp: '+234 803 333 4444',
        },
      };
      setUser(staffData);
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(staffData));
      setIsAuthModalOpen(false);
      return { success: true, user: staffData };
    }

    return {
      success: false,
      error: 'Invalid credentials. Please verify your staff email and password.',
    };
  };

  const createAccount = async (data: {
    fullName: string;
    email: string;
    memberNumber: string;
    password: string;
    hasConsented: boolean;
  }): Promise<{ success: boolean; error?: string }> => {
    const fullName = data.fullName.trim();
    const email = data.email.trim().toLowerCase();
    const memberNumber = data.memberNumber.trim();
    const password = data.password.trim();

    if (!fullName) {
      return { success: false, error: 'Full name is required.' };
    }
    if (fullName.length < 2) {
      return { success: false, error: 'Full name must be at least 2 characters.' };
    }
    const nameWords = fullName.split(/\s+/).filter(Boolean);
    if (nameWords.length < 2) {
      return { success: false, error: 'Please enter at least 2 words or names separated by a space.' };
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!memberNumber) {
      return { success: false, error: 'Please enter the member number on your gym card.' };
    }
    if (!/^\d{6}$/.test(memberNumber)) {
      return { success: false, error: 'Member number must be exactly 6 digits.' };
    }
    if (password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long.' };
    }
    if (!data.hasConsented) {
      return {
        success: false,
        error: 'You must accept the check-in history and email storage notice to create an account.',
      };
    }

    try {
      const apiRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          memberNumber,
          password,
          hasConsented: data.hasConsented,
        }),
      });

      const resData = await apiRes.json();

      if (!apiRes.ok || !resData.success) {
        return {
          success: false,
          error: resData.error || 'Failed to create account.',
        };
      }

      const sessionData: AuthUser = { type: 'member', member: resData.member };
      setUser(sessionData);
      try {
        localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(sessionData));
      } catch {}
      setIsAuthModalOpen(false);
      return { success: true };
    } catch {
      return {
        success: false,
        error: 'Unable to connect to server. Please check your internet connection.',
      };
    }
  };

  const loginWithCredentials = async (
    identifier: string,
    password: string
  ): Promise<{ success: boolean; error?: string; user?: AuthUser }> => {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPassword = password.trim();
    if (!cleanId || !cleanPassword) {
      return { success: false, error: 'Email or Member Number and password are required.' };
    }

    try {
      const apiRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: cleanId, password: cleanPassword }),
      });

      const resData = await apiRes.json();

      if (apiRes.ok && resData.success && resData.user) {
        setUser(resData.user);
        try {
          localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(resData.user));
        } catch {}
        setIsAuthModalOpen(false);
        return { success: true, user: resData.user };
      }

      if (resData.error) {
        return { success: false, error: resData.error };
      }
    } catch {
      // Fallback below if server request fails
    }

    // 1. Staff / Owner check
    if (cleanId === 'owner@spottergym.com' && cleanPassword === 'ownerpassword') {
      const staffData: AuthUser = {
        type: 'staff',
        staff: {
          id: 'staff_owner_01',
          fullName: 'Emeka Eze (Owner)',
          email: 'owner@spottergym.com',
          role: 'OWNER',
          whatsapp: '+234 803 111 2222',
        },
      };
      setUser(staffData);
      try {
        localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(staffData));
      } catch {}
      setIsAuthModalOpen(false);
      return { success: true, user: staffData };
    }

    if (
      cleanId === 'desk@spottergym.com' &&
      (cleanPassword === 'deskpassword' || cleanPassword === 'SpotterDesk#2026!')
    ) {
      const staffData: AuthUser = {
        type: 'staff',
        staff: {
          id: 'staff_desk_01',
          fullName: 'Chioma Okeke (Desk Staff)',
          email: 'desk@spottergym.com',
          role: 'STAFF',
          whatsapp: '+234 803 333 4444',
        },
      };
      setUser(staffData);
      try {
        localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(staffData));
      } catch {}
      setIsAuthModalOpen(false);
      return { success: true, user: staffData };
    }

    // 2. Demo accounts
    if (
      (cleanId === '1042' || cleanId === 'chioma@example.com') &&
      (cleanPassword === 'password123' || cleanPassword.length >= 8)
    ) {
      const sessionData: AuthUser = { type: 'member', member: DEMO_MEMBER_CHIOMA };
      setUser(sessionData);
      try {
        localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(sessionData));
      } catch {}
      setIsAuthModalOpen(false);
      return { success: true };
    }

    if (
      (cleanId === 'tunde@example.com' || cleanId === 'mem_demo_01' || cleanId === '849201') &&
      (cleanPassword === '1234' || cleanPassword === 'password123' || cleanPassword.length >= 8)
    ) {
      const sessionData: AuthUser = { type: 'member', member: DEMO_MEMBER };
      setUser(sessionData);
      try {
        localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(sessionData));
      } catch {}
      setIsAuthModalOpen(false);
      return { success: true };
    }

    return {
      success: false,
      error: 'Invalid credentials. Please verify your member number/email and password.',
    };
  };

  const verifyEmail = async (code: string): Promise<{ success: boolean; error?: string }> => {
    if (!user || user.type !== 'member' || !user.member.email) {
      return { success: false, error: 'No active member session found.' };
    }
    const cleanCode = code.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      return { success: false, error: 'Verification code must be exactly 6 digits.' };
    }
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.member.email,
          code: cleanCode,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to verify email.' };
      }
      const updatedMember: MemberSession = { ...user.member, isEmailVerified: true };
      const updatedUser: AuthUser = { type: 'member', member: updatedMember };
      setUser(updatedUser);
      try {
        localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(updatedUser));
      } catch {}
      return { success: true };
    } catch {
      return { success: false, error: 'Unable to connect to server. Please check your internet connection.' };
    }
  };

  const resendVerificationEmail = async (): Promise<{ success: boolean; error?: string; message?: string }> => {
    if (!user || user.type !== 'member' || !user.member.email) {
      return { success: false, error: 'No active member session found.' };
    }
    try {
      const res = await fetch('/api/auth/verify-email/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.member.email,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to resend verification code.' };
      }
      return { success: true, message: data.message };
    } catch {
      return { success: false, error: 'Unable to connect to server. Please check your internet connection.' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_SESSION_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        lockoutRemainingSeconds,
        isAuthModalOpen,
        authModalInitialTab,
        openAuthModal,
        closeAuthModal,
        createAccount,
        loginWithCredentials,
        loginWithPin,
        activateMember,
        loginStaff,
        verifyEmail,
        resendVerificationEmail,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
