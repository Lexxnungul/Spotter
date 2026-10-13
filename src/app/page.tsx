import type { Metadata } from 'next';
import HomePageClient from '../components/marketing/HomePageClient';

export const metadata: Metadata = {
  title: 'Spotter | Approved Gym Records',
  description: 'Approved gym member records',
  keywords: ['gym records', 'member balance', 'gym attendance', 'spotter', 'instant check-in'],
  alternates: {
    canonical: 'https://spottergym.app/',
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    url: 'https://spottergym.app/',
    siteName: 'Spotter',
    title: 'Spotter | Approved Gym Records',
    description: 'Approved gym member records',
    locale: 'en_NG',
  },
  twitter: {
    card: 'summary',
    title: 'Spotter | Approved Gym Records',
    description: 'Approved gym member records',
  },
};

export default function HomePage() {
  return <HomePageClient />;
}
