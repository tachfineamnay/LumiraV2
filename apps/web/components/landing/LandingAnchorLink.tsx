'use client';

import type { ComponentProps, MouseEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  getLandingSectionHref,
  isLandingSectionId,
  type LandingSectionId,
} from '../../lib/landing-navigation';

type HistoryMode = 'none' | 'push' | 'replace';

type LandingAnchorLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  sectionId: LandingSectionId;
  beforeNavigate?: () => void;
};

let activeFrame: number | null = null;

function cancelActiveScroll() {
  if (activeFrame !== null) {
    window.cancelAnimationFrame(activeFrame);
    activeFrame = null;
  }
}

function getHeaderOffset() {
  const header = document.querySelector<HTMLElement>('[data-landing-header]');
  return Math.ceil(header?.getBoundingClientRect().height ?? 0) + 16;
}

function updateHash(id: LandingSectionId, mode: HistoryMode) {
  if (mode === 'none' || window.location.hash === `#${id}`) return;

  const nextUrl = `${window.location.pathname}${window.location.search}#${id}`;
  if (mode === 'replace') {
    window.history.replaceState(null, '', nextUrl);
  } else {
    window.history.pushState(null, '', nextUrl);
  }
}

export function scrollToLandingSection(id: LandingSectionId, historyMode: HistoryMode = 'push') {
  const target = document.getElementById(id);
  if (!target) return false;

  cancelActiveScroll();

  let frameCount = 0;
  let stableFrames = 0;
  let previousTop: number | null = null;
  const maxFrames = 12;

  const settle = () => {
    const absoluteTop = window.scrollY + target.getBoundingClientRect().top - getHeaderOffset();
    window.scrollTo({ top: Math.max(0, absoluteTop), behavior: 'auto' });

    const currentTop = target.getBoundingClientRect().top;
    if (previousTop !== null && Math.abs(currentTop - previousTop) < 1) {
      stableFrames += 1;
    } else {
      stableFrames = 0;
    }

    previousTop = currentTop;
    frameCount += 1;

    if (frameCount < maxFrames && stableFrames < 2) {
      activeFrame = window.requestAnimationFrame(settle);
      return;
    }

    activeFrame = null;
    updateHash(id, historyMode);
  };

  activeFrame = window.requestAnimationFrame(settle);
  return true;
}

export function readLandingSectionFromHash(): LandingSectionId | null {
  const rawHash = window.location.hash.slice(1);
  if (!rawHash) return null;

  try {
    const decoded = decodeURIComponent(rawHash);
    return isLandingSectionId(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

export function LandingAnchorLink({
  sectionId,
  beforeNavigate,
  onClick,
  ...props
}: LandingAnchorLinkProps) {
  const pathname = usePathname();
  const href = getLandingSectionHref(pathname, sectionId);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;

    const isModifiedClick =
      event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (isModifiedClick) return;

    beforeNavigate?.();

    if (pathname !== '/') return;

    event.preventDefault();
    if (!document.getElementById(sectionId)) {
      window.location.assign(`/#${sectionId}`);
      return;
    }

    // One frame lets React remove a mobile overlay and restore body scrolling.
    window.requestAnimationFrame(() => scrollToLandingSection(sectionId, 'push'));
  };

  return <Link {...props} href={href} onClick={handleClick} />;
}
