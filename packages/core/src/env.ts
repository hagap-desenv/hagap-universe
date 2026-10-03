// Variáveis públicas do Supabase. Lidas sob demanda (build e lint passam sem env).
// NEXT_PUBLIC_SUPABASE_ANON_KEY = publishable key. SUPABASE_SERVICE_ROLE_KEY nunca é lida aqui:
// os apps não usam service role (tudo passa por RLS/RPC com o JWT do usuário).
export function getSupabasePublicEnv(): { url: string; anonKey: string } {
  // Referências literais: o Next embute NEXT_PUBLIC_* no bundle em tempo de build
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórias");
  }
  return { url, anonKey };
}
