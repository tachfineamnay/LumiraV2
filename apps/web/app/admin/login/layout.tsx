import type { Metadata } from 'next';
import { PRIVATE_ROBOTS } from '../../../lib/seo';

export const metadata: Metadata = {
  title: 'Connexion Expert Desk',
  robots: PRIVATE_ROBOTS,
};

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
