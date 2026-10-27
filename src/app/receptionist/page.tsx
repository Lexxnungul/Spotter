import type { Metadata } from 'next';
import ReceptionistDashboard from '../../components/receptionist/ReceptionistDashboard';

export const metadata: Metadata = {
  title: 'Receptionist Terminal | Spotter Front Desk',
  description: 'Protected front-desk member intake and secure member number generator for Spotter Gym receptionists.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ReceptionistPage() {
  return <ReceptionistDashboard />;
}
