import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  ClipboardCheck,
  Compass,
  Home,
  Layers,
  MessageCircle,
  Settings,
  User,
} from 'lucide-react';

export interface SanctuaireNavItem {
  key: 'accueil' | 'dossier' | 'lectures' | 'synthese' | 'eclairage' | 'profil' | 'reglages';
  label: string;
  shortLabel?: string;
  sublabel?: string;
  icon: LucideIcon;
  route: string;
}

/** Permanent-access destinations exposed to paid clients. */
export const PRIMARY_NAV: SanctuaireNavItem[] = [
  { key: 'accueil', label: 'Accueil', icon: Home, route: '/sanctuaire' },
  {
    key: 'dossier',
    label: 'Mon dossier',
    shortLabel: 'Dossier',
    icon: ClipboardCheck,
    route: '/sanctuaire/dossier',
  },
  {
    key: 'lectures',
    label: 'Mes lectures',
    shortLabel: 'Lectures',
    icon: BookOpen,
    route: '/sanctuaire/draws',
  },
  {
    key: 'synthese',
    label: 'Ma synthèse',
    shortLabel: 'Synthèse',
    icon: Layers,
    route: '/sanctuaire/synthesis',
  },
  {
    key: 'eclairage',
    label: 'Demander un éclairage',
    shortLabel: 'Éclairage',
    icon: MessageCircle,
    route: '/sanctuaire/chat',
  },
];

export const SIDEBAR_NAV = PRIMARY_NAV;

export const PROFILE_NAV_ITEM: SanctuaireNavItem = {
  key: 'profil',
  label: 'Mon profil',
  icon: User,
  route: '/sanctuaire/profile',
};

/** The avatar menu intentionally contains no purchase, subscription, or level UX. */
export const PROFILE_MENU_NAV: SanctuaireNavItem[] = [
  PROFILE_NAV_ITEM,
  {
    key: 'reglages',
    label: 'Réglages',
    sublabel: 'Préférences et confidentialité',
    icon: Settings,
    route: '/sanctuaire/settings/preferences',
  },
];

/** @deprecated Legacy-only data for the archived MandalaNav component. */
export const MANDALA_NAV = [
  {
    key: 'chemin',
    label: 'Chemin',
    sublabel: 'spirituel',
    icon: Compass,
    route: '/sanctuaire/path',
    angle: -72,
  },
  { key: 'lectures', label: 'Lectures', icon: BookOpen, route: '/sanctuaire/draws', angle: 0 },
  { key: 'synthese', label: 'Synthèse', icon: Layers, route: '/sanctuaire/synthesis', angle: 72 },
  {
    key: 'eclairage',
    label: 'Éclairage',
    icon: MessageCircle,
    route: '/sanctuaire/chat',
    angle: 144,
  },
  { key: 'profil', label: 'Profil', icon: User, route: '/sanctuaire/profile', angle: 216 },
];

export function isNavActive(pathname: string | null | undefined, route: string): boolean {
  if (!pathname) return false;
  if (route === '/sanctuaire') return pathname === '/sanctuaire';
  return pathname === route || pathname.startsWith(`${route}/`);
}
