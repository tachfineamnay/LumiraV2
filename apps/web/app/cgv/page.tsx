import type { Metadata } from 'next';
import { LegalPage } from '../../components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Conditions Générales de Vente | Oracle Lumira',
  description: 'Conditions générales de vente Oracle Lumira.',
  robots: { index: false },
};

export default function CgvPage() {
  return (
    <LegalPage
      title="Conditions Générales de Vente"
      updatedAt="21 juillet 2026"
      sections={[
        {
          title: "1. Objet de l'offre",
          paragraphs: [
            'Oracle Lumira propose le « Cercle des Initiés » (offre early) : une lecture personnalisée (dossier sécurisé, PDF privé, narration audio) révisée par un expert humain, avec un accès au Sanctuaire pendant 3 mois.',
            "Le prix affiché au moment de la commande est de 17 € TTC, en paiement unique. Il ne s'agit pas d'un abonnement : aucun prélèvement récurrent n'est effectué. L'accès Sanctuaire early dure 3 mois à compter du paiement.",
          ],
        },
        {
          title: '2. Commande et accès',
          paragraphs: [
            'Après confirmation du paiement par Stripe, votre accès au Sanctuaire est ouvert immédiatement. Vous complétez ensuite votre dossier (informations de naissance, questionnaire, photos facultatives) pour permettre la production de votre lecture.',
            'Votre lecture est livrée dans votre Sanctuaire après validation par un expert, en principe sous 24 à 48 heures après scellement de votre dossier.',
          ],
        },
        {
          title: '3. Nature du service',
          paragraphs: [
            "Les lectures et guidances sont des contenus interprétatifs, symboliques et d'accompagnement personnel. Elles ne constituent ni un avis médical, ni un avis juridique ou financier, ni une prédiction certaine d'événements. Elles ne remplacent pas la consultation d'un professionnel qualifié.",
          ],
        },
        {
          title: '4. Droit de rétractation et garantie',
          paragraphs: [
            "Vous bénéficiez d'une garantie « satisfait ou remboursé » de 14 jours à compter de votre achat. La demande s'effectue par email à contact@oraclelumira.com, sans justification requise.",
            "En validant la commande, vous demandez expressément l'exécution immédiate du service. En cas de remboursement, l'accès au Sanctuaire et aux contenus livrés est révoqué.",
          ],
        },
        {
          title: '5. Paiement',
          paragraphs: [
            'Le paiement est exigible immédiatement à la commande et traité de manière sécurisée par Stripe (carte bancaire). Oracle Lumira ne stocke aucune donnée bancaire.',
          ],
        },
        {
          title: '6. Responsabilité',
          paragraphs: [
            "Oracle Lumira s'engage à fournir le service avec diligence. Sa responsabilité ne saurait être engagée pour les décisions prises par le client sur la base des contenus interprétatifs fournis.",
          ],
        },
        {
          title: '7. Droit applicable',
          paragraphs: [
            'Les présentes conditions sont soumises au droit français. En cas de litige, une solution amiable sera recherchée avant toute action judiciaire. Le client peut recourir à une médiation de la consommation.',
          ],
        },
      ]}
    />
  );
}
