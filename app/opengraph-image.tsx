import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site';

// The site's own typeface, read at build time when the image is generated.
const fontFile = (weight: number) =>
  readFile(join(process.cwd(), `node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-${weight}-normal.woff`));

export const alt = `${SITE_NAME}: ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Share card for chats and social posts. Colors are the DESIGN.md light
// canvas, Ink text, and a Pine accent on the facts the site actually offers.
const FACTS = ['Soal acak per mapel dan bab', 'Ujian terjadwal', 'Kuis live bersama guru'];

export default async function OpengraphImage() {
  const host = new URL(SITE_URL).host;
  const [regular, semibold, bold] = await Promise.all([fontFile(400), fontFile(600), fontFile(700)]);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: '#e9efee',
          color: '#182023',
          fontFamily: 'Plus Jakarta Sans',
        }}
      >
        <div style={{ display: 'flex', fontSize: 28, fontWeight: 600, color: '#2a6858' }}>{host}</div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 84, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>
            {SITE_NAME}
          </div>
          <div style={{ display: 'flex', marginTop: 20, fontSize: 38, color: '#4f5f63' }}>{SITE_TAGLINE}</div>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          {FACTS.map((fact) => (
            <div
              key={fact}
              style={{
                display: 'flex',
                padding: '14px 24px',
                borderRadius: 16,
                background: '#d5ebe3',
                color: '#1d443a',
                fontSize: 26,
                fontWeight: 600,
              }}
            >
              {fact}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Plus Jakarta Sans', data: regular, weight: 400, style: 'normal' },
        { name: 'Plus Jakarta Sans', data: semibold, weight: 600, style: 'normal' },
        { name: 'Plus Jakarta Sans', data: bold, weight: 700, style: 'normal' },
      ],
    },
  );
}
