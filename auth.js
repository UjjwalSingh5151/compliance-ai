// ── Supabase config ──────────────────────────────────────────────────────────
// Replace these two values after creating your free project at supabase.com
const SUPABASE_URL  = 'https://ltrazquxguhmyuvefghe.supabase.co';
const SUPABASE_ANON = 'sb_publishable_aum6fius54OQsRXaOQbPDQ_UKDyD2ce';

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Redirect to login if no active session */
export async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = '/login.html'; return null; }
  return session;
}

/** Redirect to dashboard if already logged in */
export async function redirectIfAuthed() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) window.location.href = '/dashboard.html';
}

/** Sign up with email + password + full name */
export async function signUp(name, email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } }
  });
  return { data, error };
}

/** Sign in with email + password */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

/** Sign out */
export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = '/login.html';
}

/** Get current user (null if not logged in) */
export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
