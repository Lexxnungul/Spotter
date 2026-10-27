'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import OnboardingFlow from '../../components/onboarding/OnboardingFlow';

export default function OnboardingPage() {
  const router = useRouter();

  const handleComplete = () => {
    router.push('/member');
  };

  return <OnboardingFlow onComplete={handleComplete} />;
}
