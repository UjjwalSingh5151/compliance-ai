/**
 * Auth abstraction layer.
 * All screens call these functions — never touch supabase.auth directly.
 *
 * Phase 1 (now):  email + password
 * Phase 2 (soon): phone OTP — swap signIn/signUp internals here, zero screen changes
 * Phase 3 (later): WhatsApp OTP via gateway — swap here again
 */

import { supabase } from "./supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthMethod = "email" | "phone";

export interface SignInParams {
  method: AuthMethod;
  email?: string;
  password?: string;
  phone?: string;   // e.g. "+919876543210"
  otp?: string;     // for phone OTP verify step
}

// ─── Sign in ─────────────────────────────────────────────────────────────────

export async function signIn(params: SignInParams) {
  if (params.method === "phone") {
    if (params.otp) {
      // Phase 2: verify OTP
      return supabase.auth.verifyOtp({
        phone: params.phone!,
        token: params.otp,
        type: "sms",
      });
    }
    // Phase 2: send OTP
    return supabase.auth.signInWithOtp({ phone: params.phone! });
  }

  // Phase 1: email + password (current)
  return supabase.auth.signInWithPassword({
    email: params.email!,
    password: params.password!,
  });
}

// ─── Sign up ─────────────────────────────────────────────────────────────────

export async function signUp(params: { email: string; password: string }) {
  return supabase.auth.signUp({
    email: params.email,
    password: params.password,
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
