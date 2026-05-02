/**
 * Auth abstraction layer.
 *
 * Current flow: email OTP (6-digit code sent to inbox).
 * Works for teachers (invited by admin) and students (added to CRM).
 * No passwords — Supabase creates the account on first OTP if it doesn't exist.
 *
 * Supabase dashboard requirement:
 *   Auth → Sign In / Up → Email → enable "Email OTP" (not magic link)
 *
 * Phase 3 (later): WhatsApp / SMS OTP — swap sendOtp/verifyOtp internals here.
 */

import { supabase } from "./supabase";

// ─── Email OTP ────────────────────────────────────────────────────────────────

/**
 * Send a 6-digit OTP to the given email address.
 * Creates the Supabase user if it doesn't exist yet (shouldCreateUser: true).
 */
export async function sendEmailOtp(email: string) {
  return supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  });
}

/**
 * Verify the 6-digit code the user typed.
 * On success Supabase sets the session — AppNavigator's auth listener fires.
 */
export async function verifyEmailOtp(email: string, token: string) {
  return supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: "email",
  });
}

// ─── Sign out ────────────────────────────────────────────────────────────────

export async function signOut() {
  return supabase.auth.signOut();
}

// ─── Session ─────────────────────────────────────────────────────────────────

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session?.access_token ?? null;
}
