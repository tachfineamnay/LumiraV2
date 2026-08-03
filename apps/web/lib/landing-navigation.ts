export const LANDING_NAV_ITEMS = [
  { name: "L'Offre", id: 'niveaux' },
  { name: 'Comment ça marche', id: 'comment-ca-marche' },
  { name: 'Témoignages', id: 'temoignages' },
] as const;

export type LandingSectionId = (typeof LANDING_NAV_ITEMS)[number]['id'];

export function isLandingSectionId(value: string): value is LandingSectionId {
  return LANDING_NAV_ITEMS.some((item) => item.id === value);
}

export function getLandingSectionHref(pathname: string, id: LandingSectionId) {
  return pathname === '/' ? `#${id}` : `/#${id}`;
}
