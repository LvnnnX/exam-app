export type EditorTheme = 'light' | 'dark';
export type EditorDensity = 'compact' | 'comfortable';

export type RichTextEditorProps = {
  label?: string;
  value: string;
  onChange: (html: string) => void;
  description?: string;
  density?: EditorDensity;
  theme?: EditorTheme;
  placeholder?: string;
  compactToolbar?: boolean; // For option fields A-E
};

// 6 mobile-safe fonts per PRD BS-03
export const FONT_FAMILIES = [
  { label: 'Default (Jakarta)', value: 'var(--font-jakarta), sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
] as const;

// 10-36 pt sizes per PRD BS-03
export const FONT_SIZES = [
  { label: '10 pt', value: '10pt' },
  { label: '11 pt', value: '11pt' },
  { label: '12 pt (Standar)', value: '12pt' },
  { label: '14 pt', value: '14pt' },
  { label: '16 pt (Besar)', value: '16pt' },
  { label: '18 pt', value: '18pt' },
  { label: '24 pt', value: '24pt' },
  { label: '36 pt', value: '36pt' },
] as const;

export const LINE_HEIGHTS = [
  { label: '1.0 (Rapat)', value: '1' },
  { label: '1.15 (Normal)', value: '1.15' },
  { label: '1.5 (Sedang)', value: '1.5' },
  { label: '2.0 (Ganda)', value: '2' },
] as const;

export const TEXT_COLORS = [
  { label: 'Default', value: '' },
  { label: 'Hitam', value: '#182023' },
  { label: 'Putih', value: '#ffffff' },
  { label: 'Pine (Hijau)', value: '#2a6858' },
  { label: 'Brick (Merah)', value: '#c4503c' },
  { label: 'Amber (Kuning)', value: '#df9a3f' },
  { label: 'Biru', value: '#1d4ed8' },
  { label: 'Abu-abu', value: '#5f6f72' },
] as const;

export const HIGHLIGHT_COLORS = [
  { label: 'Tanpa Stabilo', value: '' },
  { label: 'Kuning', value: '#fef08a' },
  { label: 'Hijau', value: '#bbf7d0' },
  { label: 'Biru', value: '#bfdbfe' },
  { label: 'Merah Muda', value: '#fbcfe8' },
  { label: 'Oranye', value: '#fed7aa' },
] as const;
