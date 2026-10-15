'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import MarketingPage from './MarketingPage';
import MemberApp from '../member/MemberApp';
import PrivacyView from '../legal/PrivacyView';
import TermsView from '../legal/TermsView';

export type ActiveHomeView = 'marketing' | 'member' | 'privacy' | 'terms';

export default function HomePageClient() {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState<ActiveHomeView>('marketing');

  // Initialize view from URL if navigating directly to /privacy or /terms, or ?view=...
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');
      const pathname = window.location.pathname;
      if (viewParam === 'privacy' || pathname === '/privacy') {
        setActiveView('privacy');
      } else if (viewParam === 'terms' || pathname === '/terms') {
        setActiveView('terms');
      } else if (viewParam === 'member') {
        setActiveView('member');
      }
    }
  }, []);

  // Update dynamic document title according to the active view
  useEffect(() => {
    if (activeView === 'member') {
      document.title = 'Member Portal | Spotter';
    } else if (activeView === 'privacy') {
      document.title = 'Privacy Policy | Spotter';
    } else if (activeView === 'terms') {
      document.title = 'Terms of Service | Spotter';
    } else {
      document.title = 'Spotter | Approved Gym Records';
    }
  }, [activeView]);

  const handleSelectView = (view: ActiveHomeView) => {
    if (typeof window !== 'undefined') {
      if (view === 'marketing') {
        if (window.location.search || window.location.pathname !== '/') {
          history.replaceState(null, '', '/');
        }
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setActiveView(view);
  };

  if (activeView === 'member') {
    return <MemberApp onBackToMarketing={() => handleSelectView('marketing')} />;
  }

  if (activeView === 'privacy') {
    return (
      <PrivacyView
        onBackToHome={() => handleSelectView('marketing')}
        onSelectTerms={() => handleSelectView('terms')}
      />
    );
  }

  if (activeView === 'terms') {
    return (
      <TermsView
        onBackToHome={() => handleSelectView('marketing')}
        onSelectPrivacy={() => handleSelectView('privacy')}
      />
    );
  }

  return (
    <MarketingPage
      onOpenApp={() => handleSelectView('member')}
      onViewPrivacy={() => handleSelectView('privacy')}
      onViewTerms={() => handleSelectView('terms')}
    />
  );
}
