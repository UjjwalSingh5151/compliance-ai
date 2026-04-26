import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// If env vars aren't set, supabase is null and the app works without auth
export const supabase = url && key ? createClient(url, key) : null;
export const authEnabled = !!(url && key);
