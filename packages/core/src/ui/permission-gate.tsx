"use client";
// <PermissionGate>: esconde UI sem a permissão. É só conveniência visual — a autorização real
// fica no servidor (requirePermission) e no banco (RLS).
import { createContext, useContext } from "react";

const PermissionsContext = createContext<readonly string[]>([]);

export function PermissionsProvider({
  permissions,
  children,
}: {
  permissions: readonly string[];
  children: React.ReactNode;
}) {
  return <PermissionsContext.Provider value={permissions}>{children}</PermissionsContext.Provider>;
}

export function usePermissions(): readonly string[] {
  return useContext(PermissionsContext);
}

export function PermissionGate({
  permission,
  children,
  fallback = null,
}: {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const permissions = usePermissions();
  return <>{permissions.includes(permission) ? children : fallback}</>;
}
