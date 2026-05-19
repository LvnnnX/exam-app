"use client";

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentAdminProfileAction, resolveAdminLoginIdentifierAction } from '@/app/actions/admin/access';
import { type AdminProfile } from '@/lib/admin-permissions';

type UseAdminAuthArgs = {
  authVersion: string;
  onAuthenticated: () => Promise<void>;
};

export default function useAdminAuth({ authVersion, onAuthenticated }: UseAdminAuthArgs) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const onAuthenticatedRef = useRef(onAuthenticated);

  useEffect(() => {
    onAuthenticatedRef.current = onAuthenticated;
  }, [onAuthenticated]);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        setIsAuthenticated(false);
        return;
      }

      const localAuthVersion = localStorage.getItem('admin_auth_version');
      if (localAuthVersion === authVersion) {
        try {
          const profile = await getCurrentAdminProfileAction(session.access_token);
          setAdminProfile(profile);
          setAdminEmail(profile.email || session.user.email || '');
          setIsAuthenticated(true);
          await onAuthenticatedRef.current();
        } catch {
          await supabase.auth.signOut();
          localStorage.removeItem('admin_auth_version');
          setAdminProfile(null);
          setAdminEmail('');
          setIsAuthenticated(false);
        }
      } else {
        await supabase.auth.signOut();
        localStorage.removeItem('admin_auth_version');
        setIsAuthenticated(false);
      }
    };

    void checkSession();
  }, [authVersion]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      const resolvedEmail = await resolveAdminLoginIdentifierAction(email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password,
      });

      if (error) throw error;

      if (data.session) {
        const profile = await getCurrentAdminProfileAction(data.session.access_token);
        localStorage.setItem('admin_auth_version', authVersion);
        setAdminProfile(profile);
        setAdminEmail(profile.email || data.session.user.email || '');
        setIsAuthenticated(true);
        await onAuthenticatedRef.current();
      }
    } catch (err: unknown) {
      const message = err instanceof Error && err.message === 'Forbidden'
        ? 'Admin access pending approval or not granted.'
        : err instanceof Error && err.message === 'Invalid credentials' ? 'Invalid username/email or password.' : err instanceof Error ? err.message : 'Login failed';
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout failed:', err);
    }
    setIsAuthenticated(false);
    setAdminEmail('');
    setAdminProfile(null);
    localStorage.removeItem('admin_auth_version');
  };

  return {
    isAuthenticated,
    email,
    password,
    authError,
    authLoading,
    adminEmail,
    adminProfile,
    setEmail,
    setPassword,
    handleLogin,
    handleLogout,
  };
}
