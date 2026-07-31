import { ImageResponse } from 'next/og';
import { OFFER, SITE_NAME } from '../lib/site';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const runtime = 'edge';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '68px',
        color: '#f8fafc',
        background:
          'radial-gradient(circle at 75% 20%, rgba(232,168,56,.32), transparent 24%), linear-gradient(135deg, #040610, #10254a)',
      }}
    >
      <div style={{ display: 'flex', fontSize: 34, color: '#f3cf79' }}>{SITE_NAME}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 880 }}>
        <div style={{ display: 'flex', fontSize: 68, lineHeight: 1.05, fontFamily: 'serif' }}>
          Votre lecture personnalisée
        </div>
        <div style={{ display: 'flex', fontSize: 30, color: '#dbeafe' }}>
          Préparée avec l’IA, révisée par un expert humain.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 28, fontSize: 26, color: '#f3cf79' }}>
        <span>
          {OFFER.priceEuros} € · {OFFER.paymentLabel}
        </span>
        <span>Accès Sanctuaire {OFFER.accessDurationMonths} mois</span>
      </div>
    </div>,
    size,
  );
}
