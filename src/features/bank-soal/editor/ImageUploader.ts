import { supabase } from '@/src/lib/supabase-client';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB per PRD BS-07
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export async function uploadQuestionImage(file: File): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Format gambar tidak didukung. Gunakan PNG, JPG, WebP, atau GIF.');
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Ukuran gambar melebihi batas maksimal 2 MB.');
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  const fileName = `images/${Date.now()}_${randomSuffix}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('exam-images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    throw new Error(`Gagal mengunggah gambar: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from('exam-images').getPublicUrl(fileName);
  if (!data?.publicUrl) {
    throw new Error('Gagal mendapatkan URL publik gambar.');
  }

  return data.publicUrl;
}
