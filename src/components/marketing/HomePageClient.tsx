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

  // Sync view with URL hash (e.g., #privacy, #terms, #member)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'privacy') {
        setActiveView('privacy');
      } else if (hash === 'terms') {
        setActiveView('terms');
      } else if (hash === 'member') {
        setActiveView('member');
      } else if (!hash) {
        setActiveView('marketing');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
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
    if (view === 'marketing') {
      if (window.location.hash) {
        history.pushState(null, '', window.location.pathname);
      }
    } else {
      window.location.hash = view;
    }
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
