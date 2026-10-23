import { supabase } from '@/lib/supabase';

export default async function getAdminAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) {
    throw new Error('Admin session expired. Please log in again.');
  }
  return token;
}
