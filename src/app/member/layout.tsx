import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Member Portal',
  description: 'Private gym member records and check-in portal',
  robots: {
    index: false,
    follow: false,
  },
};

export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
