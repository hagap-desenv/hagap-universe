"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

// Acompanha o estado das instâncias exibidas (leitura via RLS) e atualiza a tela quando algum muda
// (conectou, caiu, aguardando QR) — sem o usuário recarregar. Pausa com a aba em segundo plano.
const INTERVAL_MS = 5_000;

export function StatusAutoRefresh({ statuses }: { statuses: Record<string, string> }) {
  const router = useRouter();
  const key = JSON.stringify(statuses);

  useEffect(() => {
    const known: Record<string, string> = JSON.parse(key);
    const ids = Object.keys(known);
    if (ids.length === 0) return;
    const supabase = createBrowserSupabase();
    let stopped = false;

    const timer = setInterval(async () => {
      if (stopped || document.visibilityState !== "visible") return;
      const { data } = await supabase.schema("disparador").from("instances").select("id, status").in("id", ids);
      if (stopped || !data) return;
      if (data.some((row) => known[row.id] !== undefined && known[row.id] !== row.status)) {
        stopped = true;
        clearInterval(timer);
        router.refresh();
      }
    }, INTERVAL_MS);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [key, router]);

  return null;
}
