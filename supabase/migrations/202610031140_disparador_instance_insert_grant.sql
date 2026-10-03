-- Disparador (QA Q6): grant mínimo de INSERT em instances para o cliente — só colunas de configuração.
-- Estado, chave do webhook e agenda de envio ficam com o motor (defaults na criação).
revoke insert on disparador.instances from authenticated;
grant insert (tenant_id, name, phone_e164, daily_cap, window_start, window_end, min_delay_s, max_delay_s)
  on disparador.instances to authenticated;
