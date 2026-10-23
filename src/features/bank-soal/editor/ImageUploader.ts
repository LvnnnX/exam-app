import { supabase } from '@/src/lib/supabase-client';
import { validateImage } from './image-validation';

export async function uploadQuestionImage(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const head = new Uint8Array(arrayBuffer, 0, Math.min(12, arrayBuffer.byteLength));
  const ext = validateImage(file.type, file.size, head);
  const fileName = `images/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('exam-images')
    .upload(fileName, arrayBuffer, {
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
