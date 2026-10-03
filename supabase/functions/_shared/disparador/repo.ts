// Repositório do motor sobre as RPCs engine-only do schema `disparador`.
import type { RpcClient } from "./rpc.ts";
import type { ClaimedMessage, DispatchableInstance, InstanceStatus, TickRepo } from "./tick.ts";
import type { HeartbeatRepo } from "./tick_handler.ts";

function firstRow(data: unknown): Record<string, unknown> | null {
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === "object" ? row as Record<string, unknown> : null;
}

export function createDisparadorRepo(rpc: RpcClient): TickRepo & HeartbeatRepo {
  return {
    async listDispatchableInstances(): Promise<DispatchableInstance[]> {
      const rows = (await rpc("list_dispatchable_instances")) as
        | { instance_id: string; instance_name: string }[]
        | null;
      return (rows ?? []).map((r) => ({ id: r.instance_id, name: r.instance_name }));
    },
    async setInstanceStatus(instanceId: string, status: InstanceStatus): Promise<void> {
      await rpc("set_instance_status", { p_instance_id: instanceId, p_status: status });
    },
    async claimNext(instanceId: string): Promise<ClaimedMessage | null> {
      // claim_next devolve um registo nulo (null ou todos os campos nulos) quando não há envio
      const row = firstRow(await rpc("claim_next", { p_instance_id: instanceId }));
      if (!row || row.id == null) return null;
      return {
        id: String(row.id),
        recipient_e164: String(row.recipient_e164),
        body: String(row.body),
      };
    },
    async markSent(messageId: string, providerMessageId: string): Promise<void> {
      await rpc("mark_sent", { p_message_id: messageId, p_provider_message_id: providerMessageId });
    },
    async markFailed(messageId: string, error: string): Promise<void> {
      await rpc("mark_failed", { p_message_id: messageId, p_error: error });
    },
    async touchHeartbeat(job: string, status: string, detail: Record<string, unknown>) {
      await rpc("touch_heartbeat", { p_job: job, p_status: status, p_detail: detail });
    },
  };
}
