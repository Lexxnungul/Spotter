'use client';

import React from 'react';
import { AuthProvider } from '../../context/AuthContext';
import AuthModal from '../auth/AuthModal';

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <AuthModal />
    </AuthProvider>
  );
}
