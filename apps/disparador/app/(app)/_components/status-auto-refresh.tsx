"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { type InstanceOverview, overviewSignature } from "@/lib/instances";
import { createBrowserSupabase } from "@/lib/supabase/client";

// Acompanha estado e fila das instâncias exibidas (instance_overview, SECURITY INVOKER → RLS) e atualiza a
// tela quando algo muda (conectou, caiu, mensagem enviada/falhou) — sem recarregar. Pausa em segundo plano.
const INTERVAL_MS = 5_000;


export function StatusAutoRefresh({ tenantId, signatures }: { tenantId: string; signatures: Record<string, string> }) {
  const router = useRouter();
  const key = JSON.stringify(signatures);

  useEffect(() => {
    const known: Record<string, string> = JSON.parse(key);
    if (Object.keys(known).length === 0) return;
    const supabase = createBrowserSupabase();
    let stopped = false;

    const timer = setInterval(async () => {
      if (stopped || document.visibilityState !== "visible") return;
      const { data } = await supabase.schema("disparador").rpc("instance_overview", { p_tenant_id: tenantId });
      if (stopped || !Array.isArray(data)) return;
      const changed = (data as InstanceOverview[]).some((r) => known[r.id] !== undefined && known[r.id] !== overviewSignature(r));
      if (changed) {
        stopped = true;
        clearInterval(timer);
        router.refresh();
      }
    }, INTERVAL_MS);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [key, tenantId, router]);

  return null;
}
