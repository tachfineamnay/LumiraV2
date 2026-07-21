import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface LegalSection {
  title: string;
  paragraphs: string[];
}

interface LegalPageProps {
  title: string;
  updatedAt: string;
  sections: LegalSection[];
}

export function LegalPage({ title, updatedAt, sections }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-void text-white">
      <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-white/50 hover:text-cosmic-gold transition-colors text-sm mb-12"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à l&apos;accueil
        </Link>

        <h1 className="font-playfair italic text-4xl md:text-5xl mb-3">{title}</h1>
        <p className="text-white/30 text-xs uppercase tracking-widest mb-12">
          Dernière mise à jour : {updatedAt}
        </p>

        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold text-cosmic-gold/90 mb-4">{section.title}</h2>
              <div className="space-y-3">
                {section.paragraphs.map((paragraph, i) => (
                  <p key={i} className="text-white/60 text-sm leading-relaxed font-light">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-white/10 text-white/40 text-sm">
          Une question ?{' '}
          <a
            href="mailto:contact@oraclelumira.com"
            className="text-cosmic-gold/80 hover:text-cosmic-gold transition-colors"
          >
            contact@oraclelumira.com
          </a>
        </div>
      </div>
    </div>
  );
}
