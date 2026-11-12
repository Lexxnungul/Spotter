'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface MemberSession {
  id: string;
  fullName: string;
  phone: string;
  tier: 'BASIC' | 'PREMIUM' | 'DIAMOND';
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
  loginStaff: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: AuthUser }>;
  verifyEmail: (code: string) => Promise<{ success: boolean; error?: string }>;
  resendVerificationEmail: () => Promise<{ success: boolean; error?: string; message?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_SESSION_KEY = 'spotter_auth_session';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalInitialTab, setAuthModalInitialTab] = useState<AuthViewMode>('create');

  // Initialize session from browser storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_SESSION_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      // Storage unavailable or invalid JSON fallback
    }
  }, []);

  const openAuthModal = (tab: AuthViewMode = 'create') => {
    setAuthModalInitialTab(tab);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const loginStaff = async (email: string, password: string): Promise<{ success: boolean; error?: string; user?: AuthUser }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      return { success: false, error: 'Email and password are required.' };
    }

    const res = await loginWithCredentials(cleanEmail, cleanPassword);
    if (res.success && res.user?.type === 'staff') {
      return { success: true, user: res.user };
    }
    if (res.success) {
      return {
        success: false,
        error: 'Staff permission required. Please sign in with a staff account.',
      };
    }

    return {
      success: false,
      error: res.error || 'Invalid credentials. Please verify your staff email and password.',
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

      return {
        success: false,
        error: 'Invalid credentials. Please verify your member number/email and password.',
      };
    } catch {
      return {
        success: false,
        error: 'Unable to connect to server. Please check your internet connection.',
      };
    }
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

  const logout = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_SESSION_KEY);
      fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    } catch {}
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAuthModalOpen,
        authModalInitialTab,
        openAuthModal,
        closeAuthModal,
        createAccount,
        loginWithCredentials,
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
