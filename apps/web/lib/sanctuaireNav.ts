import type { LucideIcon } from 'lucide-react';
import {
  Home,
  BookOpen,
  Compass,
  MessageCircle,
  Layers,
  Moon,
  CreditCard,
  User,
  Settings,
  ShoppingBag,
} from 'lucide-react';

export interface SanctuaireNavItem {
  key: string;
  label: string;
  shortLabel?: string;
  sublabel?: string;
  icon: LucideIcon;
  route: string;
  /** Angle on Mandala (degrees) — only for MANDALA_NAV */
  angle?: number;
}

/** Primary destinations — bottom bar (without Plus) + sidebar top */
export const PRIMARY_NAV: SanctuaireNavItem[] = [
  { key: 'accueil', label: 'Accueil', icon: Home, route: '/sanctuaire' },
  { key: 'lectures', label: 'Lectures', icon: BookOpen, route: '/sanctuaire/draws' },
  {
    key: 'chemin',
    label: 'Chemin',
    shortLabel: 'Chemin',
    icon: Compass,
    route: '/sanctuaire/path',
  },
  { key: 'oracle', label: 'Oracle', icon: MessageCircle, route: '/sanctuaire/chat' },
];

/** Extra destinations in sidebar (after primary) before profile footer */
export const SIDEBAR_SECONDARY_NAV: SanctuaireNavItem[] = [
  { key: 'synthese', label: 'Synthèse', icon: Layers, route: '/sanctuaire/synthesis' },
  { key: 'reves', label: 'Rêves', icon: Moon, route: '/sanctuaire/reves' },
  {
    key: 'abonnement',
    label: 'Abonnement',
    sublabel: 'Gérer',
    icon: CreditCard,
    route: '/sanctuaire/abonnement',
  },
];

/** Mobile "Plus" sheet + profile-adjacent links */
export const MORE_NAV: SanctuaireNavItem[] = [
  { key: 'synthese', label: 'Synthèse', icon: Layers, route: '/sanctuaire/synthesis' },
  { key: 'reves', label: 'Rêves', icon: Moon, route: '/sanctuaire/reves' },
  { key: 'abonnement', label: 'Abonnement', icon: CreditCard, route: '/sanctuaire/abonnement' },
  { key: 'profil', label: 'Profil', icon: User, route: '/sanctuaire/profile' },
  { key: 'reglages', label: 'Réglages', icon: Settings, route: '/sanctuaire/settings/preferences' },
];

/** Full desktop sidebar list (primary + secondary) */
export const SIDEBAR_NAV: SanctuaireNavItem[] = [...PRIMARY_NAV, ...SIDEBAR_SECONDARY_NAV];

/** Profile footer link on desktop sidebar */
export const PROFILE_NAV_ITEM: SanctuaireNavItem = {
  key: 'profil',
  label: 'Profil',
  icon: User,
  route: '/sanctuaire/profile',
};

/** Mandala home hub — primaries + synthèse + profil */
export const MANDALA_NAV: SanctuaireNavItem[] = [
  {
    key: 'chemin',
    label: 'Chemin',
    sublabel: 'spirituel',
    icon: Compass,
    route: '/sanctuaire/path',
    angle: -72,
  },
  {
    key: 'lectures',
    label: 'Lectures',
    icon: BookOpen,
    route: '/sanctuaire/draws',
    angle: 0,
  },
  {
    key: 'synthese',
    label: 'Synthèse',
    icon: Layers,
    route: '/sanctuaire/synthesis',
    angle: 72,
  },
  {
    key: 'oracle',
    label: 'Oracle',
    icon: MessageCircle,
    route: '/sanctuaire/chat',
    angle: 144,
  },
  {
    key: 'profil',
    label: 'Profil',
    icon: User,
    route: '/sanctuaire/profile',
    angle: 216,
  },
];

/** Header profile dropdown */
export const PROFILE_MENU_NAV: SanctuaireNavItem[] = [
  {
    key: 'profil',
    label: 'Mon Profil',
    sublabel: 'Gérer mon identité',
    icon: User,
    route: '/sanctuaire/profile',
  },
  {
    key: 'lectures',
    label: 'Mes Lectures',
    sublabel: 'Historique des tirages',
    icon: BookOpen,
    route: '/sanctuaire/draws',
  },
  {
    key: 'abonnement',
    label: 'Abonnement',
    sublabel: 'Gérer mon offre',
    icon: CreditCard,
    route: '/sanctuaire/abonnement',
  },
  {
    key: 'reglages',
    label: 'Réglages',
    sublabel: 'Préférences',
    icon: Settings,
    route: '/sanctuaire/settings/preferences',
  },
  {
    key: 'commande',
    label: 'Nouvelle Lecture',
    sublabel: 'Commander maintenant',
    icon: ShoppingBag,
    route: '/commande',
  },
];

/** Routes that should highlight the "Plus" tab on mobile */
export const MORE_NAV_ROUTES = MORE_NAV.map((i) => i.route);

export function isNavActive(pathname: string | null | undefined, route: string): boolean {
  if (!pathname) return false;
  if (route === '/sanctuaire') return pathname === '/sanctuaire';
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function isMoreNavActive(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return MORE_NAV.some((item) => isNavActive(pathname, item.route));
}
