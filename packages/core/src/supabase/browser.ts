// Cliente Supabase do navegador: só publishable key; nunca service role.
import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "../env";

export function createBrowserSupabase() {
  const { url, anonKey } = getSupabasePublicEnv();
  return createBrowserClient(url, anonKey);
}
