import { ImageResponse } from 'next/og';
import { HOME_TITLE, SCHOOL_NAME, SITE_URL } from '@/src/lib/site';

export const alt = HOME_TITLE;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Share card. Colors from DESIGN.md: canvas #e9efee, Ink 900 text, Ink 500 muted, Pine 600/100/800 accent.
// Chips list only features the app actually has.
// ponytail: uses the ImageResponse built-in font (Geist), not Plus Jakarta Sans. Add
// @fontsource/plus-jakarta-sans and pass `fonts` if the card must match the site typeface.
const FEATURES = ['Kuis live dengan kode', 'Latihan mandiri Exam & Survival', 'Soal acak per sub-bab'];

export default function OpengraphImage() {
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
        }}
      >
        <div style={{ display: 'flex', fontSize: 28, fontWeight: 600, color: '#2a6858' }}>
          {new URL(SITE_URL).host}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 80, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>
            Kuis & Latihan Soal OSN
          </div>
          <div style={{ display: 'flex', marginTop: 20, fontSize: 40, color: '#4f5f63' }}>{SCHOOL_NAME}</div>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          {FEATURES.map((f) => (
            <div
              key={f}
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
              {f}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
