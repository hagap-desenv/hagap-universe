"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { type CampaignProgress, campaignSignature } from "@/lib/groups";
import { createBrowserSupabase } from "@/lib/supabase/client";

// Mesmo padrão do StatusAutoRefresh: acompanha os envios do grupo (group_campaigns, SECURITY INVOKER → RLS)
// e atualiza a tela quando algo muda (enviada, falha, novo envio) — sem recarregar. Pausa em segundo plano.
const INTERVAL_MS = 5_000;

export function CampaignAutoRefresh({ groupId, signatures }: { groupId: string; signatures: Record<string, string> }) {
  const router = useRouter();
  const key = JSON.stringify(signatures);

  useEffect(() => {
    const known: Record<string, string> = JSON.parse(key);
    const supabase = createBrowserSupabase();
    let stopped = false;

    const timer = setInterval(async () => {
      if (stopped || document.visibilityState !== "visible") return;
      const { data } = await supabase.schema("disparador").rpc("group_campaigns", { p_group_id: groupId });
      if (stopped || !Array.isArray(data)) return;
      const rows = data as CampaignProgress[];
      const changed =
        rows.length !== Object.keys(known).length || rows.some((r) => known[r.campaign_id] !== campaignSignature(r));
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
  }, [key, groupId, router]);

  return null;
}
