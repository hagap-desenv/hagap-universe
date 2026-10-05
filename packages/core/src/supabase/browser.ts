// Cliente Supabase do navegador: só publishable key; nunca service role.
import { createBrowserClient } from "@supabase/ssr";
import { sharedCookieDomain } from "../cookies";
import { getSupabasePublicEnv } from "../env";

export function createBrowserSupabase() {
  const { url, anonKey } = getSupabasePublicEnv();
  const domain = sharedCookieDomain();
  return createBrowserClient(url, anonKey, domain ? { cookieOptions: { domain } } : undefined);
}
