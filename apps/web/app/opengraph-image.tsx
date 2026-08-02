import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Oracle Lumira — Lecture personnalisée révisée par un expert';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: 'center',
        background: 'radial-gradient(circle at 50% 0%, #1f3557 0%, #080d1d 45%, #040610 100%)',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        justifyContent: 'center',
        padding: '72px',
        width: '100%',
      }}
    >
      <div
        style={{ color: '#f4c65d', fontFamily: 'Georgia, serif', fontSize: 36, letterSpacing: 8 }}
      >
        ORACLE LUMIRA
      </div>
      <div
        style={{
          fontFamily: 'Georgia, serif',
          fontSize: 76,
          fontStyle: 'italic',
          lineHeight: 1.15,
          marginTop: 42,
          maxWidth: 940,
          textAlign: 'center',
        }}
      >
        Lecture personnalisée révisée par un expert
      </div>
      <div style={{ color: '#cbd5e1', fontSize: 28, marginTop: 42 }}>
        Approche interprétative · IA · Révision humaine
      </div>
    </div>,
    size,
  );
}
