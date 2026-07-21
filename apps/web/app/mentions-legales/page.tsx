import type { Metadata } from 'next';
import { LegalPage } from '../../components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Mentions légales | Oracle Lumira',
  description: 'Mentions légales du site Oracle Lumira.',
  robots: { index: false },
};

export default function MentionsLegalesPage() {
  return (
    <LegalPage
      title="Mentions légales"
      updatedAt="21 juillet 2026"
      sections={[
        {
          title: 'Éditeur du site',
          paragraphs: [
            'Le site oraclelumira.com est édité par Oracle Lumira.',
            'Contact : contact@oraclelumira.com',
            'Directeur de la publication : Oracle Lumira.',
          ],
        },
        {
          title: 'Hébergement',
          paragraphs: [
            "Le site est hébergé sur une infrastructure cloud sécurisée située dans l'Union européenne. Les fichiers clients sont stockés sur Amazon Web Services (AWS), région eu-west-3 (Paris).",
          ],
        },
        {
          title: 'Propriété intellectuelle',
          paragraphs: [
            "L'ensemble des contenus du site (textes, visuels, logo, lectures générées, mandalas, audio) est protégé par le droit de la propriété intellectuelle. Toute reproduction non autorisée est interdite.",
            'Les lectures et contenus livrés à un client sont destinés à son usage personnel exclusif.',
          ],
        },
        {
          title: 'Nature des contenus',
          paragraphs: [
            "Les lectures, guidances et contenus proposés par Oracle Lumira sont de nature interprétative, symbolique et d'accompagnement personnel. Ils ne constituent en aucun cas un avis médical, psychologique, juridique ou financier et ne remplacent pas la consultation d'un professionnel qualifié.",
          ],
        },
        {
          title: 'Paiements',
          paragraphs: [
            "Les paiements sont traités de manière sécurisée par Stripe. Aucune donnée bancaire ne transite ni n'est stockée sur nos serveurs.",
          ],
        },
      ]}
    />
  );
}
