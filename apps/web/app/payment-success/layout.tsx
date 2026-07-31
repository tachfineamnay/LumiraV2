import type { Metadata } from 'next';
import { PRIVATE_ROBOTS } from '../../lib/seo';

export const metadata: Metadata = {
  title: 'Vérification du paiement',
  robots: PRIVATE_ROBOTS,
};

export default function PaymentSuccessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
