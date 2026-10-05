import { AppShell, NoTenant } from "@hagap/core/ui/app-shell";
import { PermissionsProvider } from "@hagap/core/ui/permission-gate";
import { access } from "@/lib/access";
import { DISPARADOR_NAV, disparadorPermissions } from "@/lib/permissions";
import { signOutAction, switchTenantAction } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await access.requireAccess();
  if (!ctx.active) return <NoTenant appName="Disparador HAGAP" signOutAction={signOutAction} />;

  const active = ctx.active;
  const nav = DISPARADOR_NAV.filter((item) => disparadorPermissions.can(active.role, item.permission)).map(
    ({ href, label }) => ({ href, label }),
  );

  return (
    <AppShell
      appName="Disparador HAGAP"
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
