// Cliente Supabase do servidor (Server Components, Server Actions, Route Handlers).
// Usa sempre a publishable key + JWT do usuário (cookies): RLS decide o que se vê.
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "../env";

export async function createServerSupabase() {
  // cookies() primeiro: no build marca a rota como dinâmica antes de exigir as env vars
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabasePublicEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component não grava cookies; o proxy renova a sessão a cada request.
        }
      },
    },
  });
}

export type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;
