import "server-only";
import { createAccess } from "@hagap/core/access";
import { paiPermissions } from "./permissions";

// Tenant ativo do PAI: cookie `pai_tenant`, sempre validado contra as memberships no servidor
export const TENANT_COOKIE = "pai_tenant";

export const access = createAccess({ cookieName: TENANT_COOKIE, permissions: paiPermissions });
