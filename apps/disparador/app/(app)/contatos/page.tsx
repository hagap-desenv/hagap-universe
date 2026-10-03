import type { Metadata } from "next";
import { PermissionGate } from "@hagap/core/ui/permission-gate";
import { StatusBadge } from "@hagap/core/ui/status-badge";
import { access } from "@/lib/access";
import { createServerSupabase } from "@/lib/supabase/server";
import { ContactForm } from "../_components/contact-form";
import { setContactConsentAction } from "../actions";

export const metadata: Metadata = { title: "Contatos · Disparador HAGAP" };

type Contact = {
  id: string;
  name: string;
  phone_e164: string;
  opted_in_at: string | null;
  opted_out_at: string | null;
};

function consent(c: Contact) {
  if (c.opted_out_at) return <StatusBadge tone="critico" label="Saiu (opt-out)" />;
  if (c.opted_in_at) return <StatusBadge tone="bem" label="Opt-in registrado" />;
  return <StatusBadge tone="neutro" label="Sem opt-in" />;
}

export default async function ContactsPage() {
  const { active } = await access.requirePermission("contatos.view");
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .schema("disparador")
    .from("contacts")
    .select("id, name, phone_e164, opted_in_at, opted_out_at")
    .eq("tenant_id", active.tenantId)
    .order("name");
  const contacts = (data ?? []) as Contact[];

  return (
    <>
      <h1>Contatos</h1>
      <p className="hg-muted">
        Campanhas só alcançam contatos com opt-in registrado e sem opt-out. Quem responder SAIR ou PARAR sai
        automaticamente.
      </p>
      <PermissionGate permission="contatos.manage">
        <section className="hg-card" aria-labelledby="novo-contato-titulo">
          <h2 id="novo-contato-titulo">Novo contato</h2>
          <ContactForm />
        </section>
      </PermissionGate>
      {contacts.length === 0 ? (
        <p>Nenhum contato cadastrado nesta igreja.</p>
      ) : (
        <table className="hg-table">
          <caption>Contatos da igreja</caption>
          <thead>
            <tr>
              <th scope="col">Nome</th>
              <th scope="col">Número</th>
              <th scope="col">Consentimento</th>
              <PermissionGate permission="contatos.manage">
                <th scope="col">Ações</th>
              </PermissionGate>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id}>
                <th scope="row">{c.name}</th>
                <td>{c.phone_e164}</td>
                <td>{consent(c)}</td>
                <PermissionGate permission="contatos.manage">
                  <td>
                    <form action={setContactConsentAction}>
                      <input type="hidden" name="contact_id" value={c.id} />
                      {c.opted_in_at && !c.opted_out_at ? (
                        <button type="submit" name="consent" value="opt_out" className="hg-button hg-button--secondary">
                          Registrar opt-out<span className="hg-visually-hidden"> de {c.name}</span>
                        </button>
                      ) : (
                        <button type="submit" name="consent" value="opt_in" className="hg-button hg-button--secondary">
                          Registrar opt-in<span className="hg-visually-hidden"> de {c.name}</span>
                        </button>
                      )}
                    </form>
                  </td>
                </PermissionGate>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
