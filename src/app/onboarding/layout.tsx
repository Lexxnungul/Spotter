import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Member Orientation | Spotter',
  description: 'New member orientation and guide for Spotter Gym approved records',
  robots: {
    index: false,
    follow: false,
  },
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
