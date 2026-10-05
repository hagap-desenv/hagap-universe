import { AppShell, NoTenant } from "@hagap/core/ui/app-shell";
import { PermissionsProvider } from "@hagap/core/ui/permission-gate";
import { access } from "@/lib/access";
import { PAI_NAV, paiPermissions } from "@/lib/permissions";
import { signOutAction, switchTenantAction } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Defesa em profundidade: o proxy já redireciona; aqui valida-se de novo no servidor
  const ctx = await access.requireAccess();
  if (!ctx.active) return <NoTenant appName="PAI Cuidado" signOutAction={signOutAction} />;

  const active = ctx.active;
  const nav = PAI_NAV.filter(
    (item) =>
      paiPermissions.can(active.role, item.permission) && (!item.module || active.modules.includes(item.module)),
  ).map(({ href, label }) => ({ href, label }));

  return (
    <AppShell
      appName="PAI Cuidado"
      nav={nav}
      userEmail={ctx.user.email}
      active={active}
      tenants={ctx.memberships.map(({ tenantId, name }) => ({ tenantId, name }))}
      switchTenantAction={switchTenantAction}
      signOutAction={signOutAction}
      homeUrl={process.env.NEXT_PUBLIC_HUB_URL || undefined}
    >
      <PermissionsProvider permissions={ctx.permissions}>{children}</PermissionsProvider>
    </AppShell>
  );
}
