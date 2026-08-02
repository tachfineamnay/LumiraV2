import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '../../components/seo/Breadcrumbs';
import { JsonLd } from '../../components/seo/JsonLd';
import { Footer } from '../../components/landing/Footer';
import { Header } from '../../components/landing/Header';
import { pageMetadata } from '../../lib/seo';
import { OFFER, PUBLIC_CONTENT_LAST_MODIFIED, absoluteUrl } from '../../lib/site';

export const metadata: Metadata = pageMetadata({
  path: '/faq',
  title: 'Questions fréquentes',
  description:
    'Réponses claires sur le prix, les livrables, le délai, la confidentialité et les limites de la lecture personnalisée Lumira.',
});

const questions = [
  {
    question: 'Quel est le prix de la lecture ?',
    answer: `L’offre early est proposée à ${OFFER.priceEuros} ${OFFER.currencySymbol}, en paiement unique. Il ne s’agit pas d’un abonnement ni d’un renouvellement automatique.`,
  },
  {
    question: 'Que comprend l’offre ?',
    answer: `Elle comprend une lecture personnalisée, une révision humaine, un PDF privé, une narration audio privée et un accès au Sanctuaire pendant ${OFFER.accessDurationMonths} mois.`,
  },
  {
    question: 'Quand ma lecture est-elle livrée ?',
    answer: `Le délai annoncé est de ${OFFER.deliveryLabel}.`,
  },
  {
    question: 'L’IA remplace-t-elle l’expert ?',
    answer:
      'Non. L’IA intervient dans la préparation du contenu. Un expert humain relit et valide la lecture avant sa mise à disposition.',
  },
  {
    question: 'Lumira apporte-t-il un conseil médical, juridique ou financier ?',
    answer:
      'Non. Les contenus sont interprétatifs et destinés à l’accompagnement personnel. Ils ne constituent ni un diagnostic, ni un avis médical, juridique ou financier, ni une prédiction certaine.',
  },
  {
    question: 'Comment sont protégées mes informations ?',
    answer:
      'Votre dossier et vos livrables sont accessibles dans un espace privé. Les informations détaillées sur le traitement des données et vos droits figurent dans la politique de confidentialité.',
  },
] as const;

export default function FaqPage() {
  return (
    <main className="min-h-screen bg-cosmic-void text-white starfield">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${absoluteUrl('/faq')}#webpage`,
          url: absoluteUrl('/faq'),
          name: 'Questions fréquentes',
          description: 'Questions fréquentes sur l’offre Lumira.',
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
                name: 'Questions fréquentes',
                item: absoluteUrl('/faq'),
              },
            ],
          },
        }}
      />
      <Header />
      <article className="relative z-10 mx-auto max-w-3xl px-6 pb-24 pt-32 md:pt-40">
        <Breadcrumbs current="Questions fréquentes" />
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-cosmic-gold">
            Informations utiles
          </p>
          <h1 className="mt-5 text-4xl font-playfair italic text-white md:text-6xl">
            Questions fréquentes
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/70">
            Les réponses ci-dessous décrivent l&apos;offre actuellement disponible. Pour les règles
            contractuelles, consultez les{' '}
            <Link href="/cgv" className="text-cosmic-gold underline underline-offset-4">
              conditions générales de vente
            </Link>
            .
          </p>
        </header>
        <dl className="mt-14 space-y-5">
          {questions.map(({ question, answer }) => (
            <div key={question} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <dt className="text-xl font-medium text-white">{question}</dt>
              <dd className="mt-3 leading-7 text-white/65">{answer}</dd>
            </div>
          ))}
        </dl>
      </article>
      <Footer />
    </main>
  );
}
