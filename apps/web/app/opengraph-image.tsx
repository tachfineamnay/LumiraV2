import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Oracle Lumira | Lecture personnalisée révisée par un expert';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Image Open Graph générée dynamiquement par Next.js (ImageResponse).
 * Utilisée pour les prévisualisations sur les réseaux sociaux et les messageries.
 */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(160deg, #040610 0%, #0C1225 45%, #101830 100%)',
          fontFamily: 'Georgia, serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Halo doré central */}
        <div
          style={{
            position: 'absolute',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(232,168,56,0.18) 0%, rgba(232,168,56,0.06) 40%, transparent 70%)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />

        {/* Nom */}
        <div
          style={{
            fontSize: '72px',
            fontWeight: '700',
            color: '#E8A838',
            letterSpacing: '-1px',
            marginBottom: '18px',
            textAlign: 'center',
          }}
        >
          Oracle Lumira
        </div>

        {/* Séparateur */}
        <div
          style={{
            width: '56px',
            height: '1px',
            background: 'rgba(232,168,56,0.45)',
            marginBottom: '22px',
          }}
        />

        {/* Accroche */}
        <div
          style={{
            fontSize: '26px',
            color: 'rgba(248,250,252,0.72)',
            textAlign: 'center',
            maxWidth: '720px',
            lineHeight: '1.45',
            marginBottom: '32px',
          }}
        >
          Lecture personnalisée révisée par un expert
        </div>

        {/* URL */}
        <div
          style={{
            fontSize: '17px',
            color: 'rgba(248,250,252,0.28)',
            letterSpacing: '3px',
            textTransform: 'uppercase',
          }}
        >
          oraclelumira.com
        </div>
      </div>
    ),
    { ...size },
  );
}
