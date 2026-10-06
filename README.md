# Hagap Universe

Monorepo dos produtos HAGAP.

| Pasta | App |
|-------|-----|
| `apps/hub` | **Painel principal** — portal Hangap: login e escolha dos apps |
| `apps/disparador` | **Disparador** — comunicação e relacionamento via WhatsApp |
| `apps/pai` | **PAI — Cuidado** — cuidado pastoral e mentoria |
| `packages/core` | Código compartilhado (Supabase, permissões, UI) |
| `supabase/` | Migrations, testes pgTAP e Edge Functions |
| `infra/` | Infraestrutura (Evolution API) |

Fluxo de branches (regra 12): código só no `dev` → `hom` (cópia de um commit do `dev`, validação) →
`main` (o mesmo commit validado em `hom`). Ver `AGENTS.md`.
