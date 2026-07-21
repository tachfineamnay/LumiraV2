import type { Metadata } from 'next';
import { LegalPage } from '../../components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Politique de confidentialité | Oracle Lumira',
  description: 'Politique de confidentialité et protection des données personnelles Oracle Lumira.',
  robots: { index: false },
};

export default function ConfidentialitePage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      updatedAt="21 juillet 2026"
      sections={[
        {
          title: 'Données collectées',
          paragraphs: [
            'Lors de votre commande : email, prénom, nom et téléphone (facultatif).',
            'Lors de la préparation de votre lecture : date, heure et lieu de naissance, vos réponses au questionnaire, et les photos que vous choisissez de transmettre (visage, paume). Ces éléments servent exclusivement à produire votre lecture personnalisée.',
            'Données techniques : journaux de connexion nécessaires à la sécurité du service.',
          ],
        },
        {
          title: 'Utilisation des données',
          paragraphs: [
            'Vos données sont utilisées pour : produire et livrer votre lecture personnalisée, vous donner accès à votre Sanctuaire, vous envoyer les emails liés à votre commande (confirmation, lien de connexion), et respecter nos obligations légales.',
            "Vos photos sont stockées de manière privée et chiffrée, accessibles uniquement pour la production de votre lecture. Elles ne sont jamais partagées ni utilisées à d'autres fins.",
          ],
        },
        {
          title: 'Sous-traitants',
          paragraphs: [
            "Stripe (paiement sécurisé), Amazon Web Services (stockage chiffré, région Paris), et des fournisseurs d'intelligence artificielle pour la génération de votre lecture, chacun dans le cadre strict de sa mission.",
          ],
        },
        {
          title: 'Conservation',
          paragraphs: [
            'Vos données sont conservées pendant la durée de votre accès au Sanctuaire, puis archivées ou supprimées conformément aux obligations légales (notamment comptables).',
          ],
        },
        {
          title: 'Vos droits',
          paragraphs: [
            "Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation et de portabilité de vos données.",
            'Pour exercer vos droits : contact@oraclelumira.com. Vous pouvez également saisir la CNIL (cnil.fr).',
          ],
        },
        {
          title: 'Cookies',
          paragraphs: [
            "Le site utilise uniquement des cookies strictement nécessaires au fonctionnement (session sécurisée de votre Sanctuaire). Aucun cookie publicitaire n'est déposé sans votre consentement.",
          ],
        },
      ]}
    />
  );
}
