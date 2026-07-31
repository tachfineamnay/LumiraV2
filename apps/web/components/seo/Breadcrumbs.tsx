import Link from 'next/link';

export function Breadcrumbs({ current }: { current: string }) {
  return (
    <nav aria-label="Fil d’Ariane" className="mb-10 text-sm text-white/50">
      <ol className="flex flex-wrap items-center gap-2">
        <li>
          <Link href="/" className="hover:text-cosmic-gold">
            Accueil
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li aria-current="page" className="text-white/80">
          {current}
        </li>
      </ol>
    </nav>
  );
}
