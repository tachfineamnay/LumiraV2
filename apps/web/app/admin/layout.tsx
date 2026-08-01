import type { Metadata } from 'next';
import { PRIVATE_ROBOTS } from '../../lib/seo';
import AdminLayoutClient from './AdminLayoutClient';

export const metadata: Metadata = {
  title: 'Desk expert',
  robots: PRIVATE_ROBOTS,
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
