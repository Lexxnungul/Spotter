'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import MarketingPage from './MarketingPage';
import MemberApp from '../member/MemberApp';

export default function HomePageClient() {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState<'marketing' | 'member'>('marketing');

  // Update dynamic document title according to the view a user visits
  useEffect(() => {
    if (activeView === 'member') {
      document.title = 'Member Portal | Spotter';
    } else {
      document.title = 'Spotter | Approved Gym Records';
    }
  }, [activeView]);

  if (activeView === 'member') {
    return <MemberApp onBackToMarketing={() => setActiveView('marketing')} />;
  }

  return (
    <MarketingPage
      onOpenApp={() => setActiveView('member')}
    />
  );
}
