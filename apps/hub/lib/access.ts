import "server-only";
import { createAccess } from "@hagap/core/access";
import { hubPermissions } from "./permissions";

// Igreja ativa do hub (cookie próprio; sempre validado contra as memberships no servidor)
export const TENANT_COOKIE = "hub_tenant";

export const access = createAccess({ cookieName: TENANT_COOKIE, permissions: hubPermissions });
