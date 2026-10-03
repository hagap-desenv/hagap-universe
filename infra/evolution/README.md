# Evolution API — HOM

Motor WhatsApp usado pelo Disparador (`DISPARADOR_PROVIDER=evolution`). Regras anti-ban: `context/whatsapp-seguranca.md` no cérebro.

| Item | HOM |
|------|-----|
| Servidor | `srv1996676.hstgr.cloud` (alias SSH `hagap-srv`) — compartilhado com outros projetos, isolado por compose próprio |
| Pasta | `/opt/hagap/evolution-hom` (compose + `.env` com permissão 600) |
| URL | `https://evolution-hom.2-24-84-38.sslip.io` (via Traefik existente; trocar por subdomínio próprio quando houver DNS) |
| Dados | Postgres e Redis exclusivos; a Evolution **não** guarda conteúdo de conversas (LGPD) |

## Operar
```sh
ssh hagap-srv
cd /opt/hagap/evolution-hom
docker compose --env-file .env ps
docker compose --env-file .env logs --tail=100 evolution
docker compose --env-file .env pull && docker compose --env-file .env up -d   # atualizar
```

## Ligação com o Supabase
Segredos das Edge Functions (`supabase secrets set`): `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `DISPARADOR_PROVIDER=evolution`.
Cada instância (1 por número) aponta o webhook para `…/functions/v1/disparador-webhook?instance=<nome>` com o header `x-disparador-key`.
