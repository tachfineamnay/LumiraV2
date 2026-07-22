import React from 'react';
import { cn } from '@/lib/utils';

type MaxWidth = 'max-w-xl' | 'max-w-4xl' | 'max-w-5xl' | 'max-w-none';

/** Outer page frame — sits on the cosmic shell. */
export function SanctuairePage({
  children,
  className,
  maxWidth = 'max-w-5xl',
}: {
  children: React.ReactNode;
  className?: string;
  maxWidth?: MaxWidth;
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 py-8 pb-28 sm:px-6 sm:py-12 lg:pb-12',
        maxWidth,
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Dark intro block above a paper stage (greeting, page title). */
export function SanctuaireShellIntro({
  eyebrow = 'Sanctuaire Lumira',
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}
    >
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-horizon-300">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-2 font-playfair text-3xl italic text-stellar-100 sm:text-4xl">{title}</h1>
        {description ? (
          <p className="mt-3 text-base leading-7 text-stellar-400">{description}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}

/**
 * Warm paper stage — primary reading/content surface inside the cosmic shell.
 * Use for home situation, lectures, synthèse, dossier, settings panels.
 */
export function SanctuaireStage({
  children,
  className,
  padded = true,
  elevated = false,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
  elevated?: boolean;
}) {
  return (
    <div
      className={cn(
        'sanctuaire-stage relative overflow-hidden rounded-[1.75rem] border border-paper-line text-paper-ink shadow-paper',
        elevated ? 'bg-paper-elevated' : 'bg-paper',
        padded && 'p-5 sm:p-7',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-horizon-400/[0.07] to-transparent"
        aria-hidden
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/** Nested panel inside a paper stage. */
export function PaperPanel({
  children,
  className,
  tone = 'default',
  role,
}: {
  children: React.ReactNode;
  className?: string;
  tone?: 'default' | 'accent' | 'calm' | 'success' | 'warn';
  role?: React.AriaRole;
}) {
  const tones = {
    default: 'border-paper-line bg-paper-elevated',
    accent: 'border-horizon-500/25 bg-horizon-400/10',
    calm: 'border-serenity-300/30 bg-serenity-200/15',
    success: 'border-emerald-600/20 bg-emerald-500/10',
    warn: 'border-horizon-600/25 bg-horizon-500/10',
  } as const;

  return (
    <div role={role} className={cn('rounded-2xl border p-4 sm:p-5', tones[tone], className)}>
      {children}
    </div>
  );
}

export function paperBtnPrimary(className?: string) {
  return cn(
    'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-horizon-400 px-5 py-3 text-sm font-semibold text-abyss-900 hover:bg-horizon-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-500',
    className,
  );
}

export function paperBtnSecondary(className?: string) {
  return cn(
    'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-paper-ink/15 bg-paper-elevated px-5 py-3 text-sm font-medium text-paper-soft hover:bg-paper-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400',
    className,
  );
}

export function shellBtnGhost(className?: string) {
  return cn(
    'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-4 py-2 text-sm text-stellar-300 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400 disabled:cursor-wait disabled:opacity-60',
    className,
  );
}
