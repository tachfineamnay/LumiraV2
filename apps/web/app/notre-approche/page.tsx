import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '../../components/seo/Breadcrumbs';
import { JsonLd } from '../../components/seo/JsonLd';
import { Footer } from '../../components/landing/Footer';
import { Header } from '../../components/landing/Header';
import { pageMetadata } from '../../lib/seo';
import { OFFER, PUBLIC_CONTENT_LAST_MODIFIED, absoluteUrl } from '../../lib/site';

export const metadata: Metadata = pageMetadata({
  path: '/notre-approche',
  title: 'Notre approche',
  description:
    'Comprendre la démarche Lumira : dossier scellé, préparation par IA, révision humaine et limites claires d’une lecture interprétative.',
});

const steps = [
  {
    title: 'Vous constituez votre dossier',
    body: 'Après votre achat, vous accédez à un espace privé pour transmettre les informations nécessaires. Vous gardez la main sur votre dossier jusqu’à son scellement.',
  },
  {
    title: 'La lecture est préparée puis relue',
    body: 'L’IA participe à la préparation du contenu à partir du dossier scellé. Un expert humain relit et valide la lecture avant sa mise à disposition.',
  },
  {
    title: 'Vos livrables restent privés',
    body: 'La lecture écrite et sa narration audio sont accessibles depuis le Sanctuaire. Elles ne constituent pas une page publique ni une ressource indexable.',
  },
] as const;

export default function NotreApprochePage() {
  return (
    <main className="min-h-screen bg-cosmic-void text-white starfield">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${absoluteUrl('/notre-approche')}#webpage`,
          url: absoluteUrl('/notre-approche'),
          name: 'Notre approche',
          description:
            'Dossier scellé, préparation par IA, révision humaine et limites d’une lecture interprétative.',
          inLanguage: 'fr-FR',
          dateModified: PUBLIC_CONTENT_LAST_MODIFIED.toISOString(),
          isPartOf: { '@id': `${absoluteUrl('/')}#website` },
          breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Accueil', item: absoluteUrl('/') },
              {
                '@type': 'ListItem',
                position: 2,
                name: 'Notre approche',
                item: absoluteUrl('/notre-approche'),
              },
            ],
          },
        }}
      />
      <Header />
      <article className="relative z-10 mx-auto max-w-4xl px-6 pb-24 pt-32 md:pt-40">
        <Breadcrumbs current="Notre approche" />
        <header className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-cosmic-gold">
            La démarche Lumira
          </p>
          <h1 className="mt-5 text-4xl font-playfair italic leading-tight text-white md:text-6xl">
            Une lecture interprétative, avec une place claire pour l&apos;IA et l&apos;humain.
          </h1>
          <p className="mt-7 text-lg leading-8 text-white/70">
            Lumira propose un contenu d&apos;accompagnement personnel. Il ne pose aucun diagnostic,
            ne remplace pas un professionnel qualifié et ne formule pas de prédiction certaine.
          </p>
        </header>

        <section className="mt-16" aria-labelledby="etapes-title">
          <h2 id="etapes-title" className="text-3xl font-playfair italic text-white">
            Comment se déroule la lecture
          </h2>
          <ol className="mt-8 grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <span className="text-sm font-bold text-cosmic-gold">0{index + 1}</span>
                <h3 className="mt-4 text-xl text-white">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/65">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16 max-w-3xl" aria-labelledby="offre-title">
          <h2 id="offre-title" className="text-3xl font-playfair italic text-white">
            Ce que comprend l&apos;offre early
          </h2>
          <p className="mt-5 leading-7 text-white/70">
            Le {OFFER.publicName} est proposé à {OFFER.priceEuros} {OFFER.currencySymbol}, en{' '}
            {OFFER.paymentLabel}, avec un accès Sanctuaire de {OFFER.accessDurationMonths} mois. La
            livraison est annoncée sous {OFFER.deliveryLabel}.
          </p>
          <ul className="mt-6 grid gap-3 text-white/75 sm:grid-cols-2">
            <li>Lecture personnalisée</li>
            <li>Révision par un expert humain</li>
            <li>PDF privé</li>
            <li>Narration audio privée</li>
            <li>Accès Sanctuaire {OFFER.accessDurationMonths} mois</li>
            <li>Dossier client sécurisé</li>
          </ul>
          <p className="mt-7 text-sm leading-6 text-white/55">
            L&apos;offre ne garantit ni mandala, ni chat illimité, ni accompagnement de 30 jours.
          </p>
        </section>

        <section
          className="mt-16 max-w-3xl rounded-2xl border border-cosmic-gold/25 bg-cosmic-gold/[0.06] p-7"
          aria-labelledby="confidentialite-title"
        >
          <h2 id="confidentialite-title" className="text-2xl font-playfair italic text-white">
            Vos données et vos limites
          </h2>
          <p className="mt-4 leading-7 text-white/70">
            Les informations et médias transmis servent à préparer votre lecture dans l&apos;espace
            privé. Retrouvez les règles de traitement, vos droits et les moyens de nous contacter
            dans notre{' '}
            <Link href="/confidentialite" className="text-cosmic-gold underline underline-offset-4">
              politique de confidentialité
            </Link>
            .
          </p>
        </section>
      </article>
      <Footer />
    </main>
  );
}
