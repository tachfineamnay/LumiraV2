import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  ClipboardCheck,
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

export const HOME_NAV_ITEM: SanctuaireNavItem = {
  key: 'accueil',
  label: 'Accueil',
  icon: Home,
  route: '/sanctuaire',
};

export const DOSSIER_NAV_ITEM: SanctuaireNavItem = {
  key: 'dossier',
  label: 'Mon dossier',
  shortLabel: 'Dossier',
  sublabel: 'Les éléments transmis pour votre lecture',
  icon: ClipboardCheck,
  route: '/sanctuaire/dossier',
};

export const READINGS_NAV_ITEM: SanctuaireNavItem = {
  key: 'lectures',
  label: 'Mes lectures',
  shortLabel: 'Lectures',
  icon: BookOpen,
  route: '/sanctuaire/draws',
};

export const SYNTHESIS_NAV_ITEM: SanctuaireNavItem = {
  key: 'synthese',
  label: 'Ma synthèse',
  shortLabel: 'Synthèse',
  icon: Layers,
  route: '/sanctuaire/synthesis',
};

export const GUIDANCE_NAV_ITEM: SanctuaireNavItem = {
  key: 'eclairage',
  label: 'Demander un éclairage',
  shortLabel: 'Éclairage',
  icon: MessageCircle,
  route: '/sanctuaire/chat',
};

/** Full desktop navigation. The dossier remains visible where space is available. */
export const PRIMARY_NAV: SanctuaireNavItem[] = [
  HOME_NAV_ITEM,
  DOSSIER_NAV_ITEM,
  READINGS_NAV_ITEM,
  SYNTHESIS_NAV_ITEM,
  GUIDANCE_NAV_ITEM,
];

export const SIDEBAR_NAV = PRIMARY_NAV;

/**
 * Four essential destinations only on phone. The dossier stays available from
 * the contextual home CTA, empty states and the avatar menu.
 */
export const MOBILE_NAV: SanctuaireNavItem[] = [
  HOME_NAV_ITEM,
  READINGS_NAV_ITEM,
  SYNTHESIS_NAV_ITEM,
  GUIDANCE_NAV_ITEM,
];

export const PROFILE_NAV_ITEM: SanctuaireNavItem = {
  key: 'profil',
  label: 'Mon profil',
  icon: User,
  route: '/sanctuaire/profile',
};

/** The avatar menu intentionally contains no purchase, subscription level or upgrade UX. */
export const PROFILE_MENU_NAV: SanctuaireNavItem[] = [
  DOSSIER_NAV_ITEM,
  PROFILE_NAV_ITEM,
  {
    key: 'reglages',
    label: 'Réglages',
    sublabel: 'Préférences et confidentialité',
    icon: Settings,
    route: '/sanctuaire/settings/preferences',
  },
];

export function isNavActive(pathname: string | null | undefined, route: string): boolean {
  if (!pathname) return false;
  if (route === '/sanctuaire') return pathname === '/sanctuaire';
  return pathname === route || pathname.startsWith(`${route}/`);
}
