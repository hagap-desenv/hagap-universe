import "server-only";
import { createAccess } from "@hagap/core/access";
import { disparadorPermissions } from "./permissions";

// Tenant ativo do Disparador (cookie próprio; validado contra as memberships no servidor)
export const TENANT_COOKIE = "disparador_tenant";

export const access = createAccess({ cookieName: TENANT_COOKIE, permissions: disparadorPermissions });
