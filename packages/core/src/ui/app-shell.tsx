// Shell dos apps: link "pular para o conteúdo", cabeçalho com igreja ativa + seletor, sidebar
// (itens já filtrados por permissão/módulo no servidor) e área principal.
import { ROLE_LABELS, type AppRole } from "../roles";
import { formatCnpj } from "../tenant";
import { NavLinks, type NavItem } from "./nav-links";

export type { NavItem };

type ServerAction = (formData: FormData) => void | Promise<void>;

export type ShellTenant = { tenantId: string; name: string };

export function AppShell({
  appName,
  nav,
  userEmail,
  active,
  tenants,
  switchTenantAction,
  signOutAction,
  children,
}: {
  appName: string;
  nav: readonly NavItem[];
  userEmail: string | null;
  active: { tenantId: string; name: string; cnpj: string; role: AppRole } | null;
  tenants: readonly ShellTenant[];
  switchTenantAction: ServerAction;
  signOutAction: ServerAction;
  children: React.ReactNode;
}) {
  return (
    <div className="hg-shell">
      <a className="hg-skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="hg-header">
        <p className="hg-header__brand">{appName}</p>
        <div className="hg-header__tenant">
          {active ? (
            <p className="hg-header__active" data-testid="active-tenant">
              <span className="hg-visually-hidden">Igreja ativa: </span>
              <strong>{active.name}</strong>{" "}
              <span className="hg-muted">
                CNPJ {formatCnpj(active.cnpj)} · {ROLE_LABELS[active.role]}
              </span>
            </p>
          ) : null}
          {tenants.length > 1 ? (
            <form action={switchTenantAction} className="hg-tenant-switch">
              <label htmlFor="tenant-select">Trocar igreja</label>
              <select id="tenant-select" name="tenantId" defaultValue={active?.tenantId}>
                {tenants.map((t) => (
                  <option key={t.tenantId} value={t.tenantId}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="hg-button hg-button--secondary">
                Trocar
              </button>
            </form>
          ) : null}
        </div>
        <form action={signOutAction} className="hg-header__user">
          {userEmail ? <span className="hg-muted">{userEmail}</span> : null}
          <button type="submit" className="hg-button hg-button--ghost">
            Sair
          </button>
        </form>
      </header>
      <div className="hg-body">
        <nav className="hg-nav" aria-label="Navegação principal">
          <NavLinks items={nav} />
        </nav>
        <main id="conteudo" className="hg-main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}

export function NoTenant({ appName, signOutAction }: { appName: string; signOutAction: ServerAction }) {
  return (
    <main id="conteudo" className="hg-auth">
      <div className="hg-auth__card">
        <p className="hg-auth__brand">{appName}</p>
        <h1 className="hg-auth__title">Sem igreja vinculada</h1>
        <p>Sua conta ainda não está vinculada a nenhuma igreja. Fale com o administrador da sua igreja.</p>
        <form action={signOutAction}>
          <button type="submit" className="hg-button">
            Sair
          </button>
        </form>
      </div>
    </main>
  );
}
