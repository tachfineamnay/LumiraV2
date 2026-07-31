import type { Metadata } from 'next';
import { PRIVATE_ROBOTS } from '../../lib/seo';

export const metadata: Metadata = {
  title: 'Commande',
  robots: PRIVATE_ROBOTS,
};

export default function CommandeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
