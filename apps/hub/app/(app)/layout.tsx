import { HangapLogo } from "@hagap/core/ui/hangap-logo";
import { AppShell, NoTenant } from "@hagap/core/ui/app-shell";
import { access } from "@/lib/access";
import { BRAND_LOGO_SRC, BRAND_MOTTO } from "@/lib/brand";
import { signOutAction, switchTenantAction } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await access.requireAccess();
  if (!ctx.active) return <NoTenant appName="Hangap" signOutAction={signOutAction} />;

  return (
    <div className="hub-app">
      <AppShell
        appName="Hangap"
        brand={<HangapLogo size={32} tone="dark" src={BRAND_LOGO_SRC} />}
        nav={[{ href: "/", label: "Apps" }]}
        userEmail={ctx.user.email}
        active={ctx.active}
        tenants={ctx.memberships.map(({ tenantId, name }) => ({ tenantId, name }))}
        switchTenantAction={switchTenantAction}
        signOutAction={signOutAction}
      >
        {children}
      </AppShell>
      <footer className="hub-footer">
        <p>Hangap · {BRAND_MOTTO}</p>
      </footer>
    </div>
  );
}
