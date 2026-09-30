<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# PAI Cuidado — cérebro do projeto

Este repositório contém só o código. O cérebro do projeto (regras, contexto, workers, specs,
mudanças e handoff entre IAs) vive em `G:\Meu Drive\CDEV\HAGAP\Pai\AGENTS.md`.
Antes de qualquer trabalho, ler esse `AGENTS.md` e `memory/handoff.md` dessa pasta, e trabalhar
apenas dentro do lote aprovado da mudança ativa (`changes/<ativa>/tasks.md`).

## REGRA CANÓNICA — fluxo de branches (inviolável)

> Resumo da regra 12 do `AGENTS.md` canónico. Em conflito, vale o canónico.

- `dev` = **só código**, sem dados. É o **único** branch onde se escreve e commita código.
- `hom` = cópia exata de um commit do `dev` (fast-forward) para validação com **dados fictícios**.
  Os dados vivem no Supabase HOM, nunca no código.
- `main` = recebe **do `dev` o mesmo commit validado em `hom`** (tag `hom-validado-YYYY-MM-DD`).
  Nunca `hom → main`; nunca um commit do `dev` que não foi validado.
- Proibido: commit, merge ou PR com código novo em `hom` ou `main`; diferenças entre ambientes no
  código (usar só variáveis de ambiente). Promover para `main` exige aprovação humana explícita.
- **Enforcement obrigatório** (GitHub Free não protege branch privado):
  - Hook `.githooks/pre-push`, ativado por `npm install` (script `prepare`): bloqueia commit fora do
    `dev`, push não fast-forward, apagar `hom`/`main` e `main` sem tag `hom-validado-*`.
  - Workflow `branch-guard`: fica vermelho se a regra for violada no GitHub.
  - **Proibido** desativar o hook, usar `git push --no-verify` ou alterar `core.hooksPath`.
    `branch-guard` vermelho → parar e avisar o humano.

```
dev ──(fast-forward para SHA X)──► hom ──► validação (dados fictícios)
 └───(o MESMO SHA X, vindo do dev)──► main   ← só após validação humana
```
