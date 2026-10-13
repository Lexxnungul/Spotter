'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import MemberApp from '../../components/member/MemberApp';

export default function MemberRoutePage() {
  const router = useRouter();

  return (
    <MemberApp onBackToMarketing={() => router.push('/')} />
  );
}
