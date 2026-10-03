-- Disparador: claim_next aplica janela local, cap diário, intervalo e 1 envio por vez por instância.
-- Assinaturas: disparador.claim_next(p_instance_id uuid) returns disparador.outbound_messages (null = nada a enviar)
--              disparador.mark_sent(p_message_id uuid, p_provider_message_id text) returns void
--              disparador.mark_failed(p_message_id uuid, p_error text) returns void
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select has_function('disparador', 'claim_next', array['uuid'], 'claim_next existe');
select has_function('disparador', 'mark_sent', array['uuid', 'text'], 'mark_sent existe');
select has_function('disparador', 'mark_failed', array['uuid', 'text'], 'mark_failed existe');

-- Fuso escolhido para que "agora" esteja dentro da janela 06–22 (teste estável a qualquer hora do CI)
insert into public.tenants (id, name, cnpj, slug, timezone) values
  ('22000000-0000-0000-0000-00000000000a', 'Igreja Claim A', '11222333000181', 'igreja-claim-a',
   (select name from pg_timezone_names
    where name like 'Etc/GMT%' and extract(hour from now() at time zone name) between 9 and 19
    order by name limit 1));
insert into disparador.instances (id, tenant_id, name, phone_e164, status, daily_cap, next_allowed_at) values
  ('42000000-0000-0000-0000-00000000000a', '22000000-0000-0000-0000-00000000000a', 'claim-a', '+5511980000000',
   'open', 2, now() - interval '1 minute');
insert into disparador.outbound_messages (id, tenant_id, instance_id, product, recipient_e164, recipient_name, body, created_at) values
  ('62000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-00000000000a', '42000000-0000-0000-0000-00000000000a',
   'pai', '+5511981000001', 'Um', 'Olá Um', now() - interval '3 minutes'),
  ('62000000-0000-0000-0000-000000000002', '22000000-0000-0000-0000-00000000000a', '42000000-0000-0000-0000-00000000000a',
   'pai', '+5511981000002', 'Dois', 'Olá Dois', now() - interval '2 minutes'),
  ('62000000-0000-0000-0000-000000000003', '22000000-0000-0000-0000-00000000000a', '42000000-0000-0000-0000-00000000000a',
   'pai', '+5511981000003', 'Tres', 'Olá Tres', now() - interval '1 minute');

select set_config('request.jwt.claims', '{"role":"service_role"}', true);

-- 1º claim: mais antiga, marca sending, agenda próximo envio 45–90s à frente
select is((select id from disparador.claim_next('42000000-0000-0000-0000-00000000000a')),
  '62000000-0000-0000-0000-000000000001'::uuid, 'claim devolve a mensagem mais antiga');
select is((select status::text from disparador.outbound_messages where id = '62000000-0000-0000-0000-000000000001'),
  'sending', 'mensagem reclamada fica sending');
select ok(
  (select next_allowed_at between now() + interval '45 seconds' and now() + interval '90 seconds'
   from disparador.instances where id = '42000000-0000-0000-0000-00000000000a'),
  'próximo envio agendado entre 45 e 90 segundos');

-- 2º claim imediato: bloqueado pelo intervalo (1 por vez por instância)
select is((select id from disparador.claim_next('42000000-0000-0000-0000-00000000000a')), null::uuid,
  'claim imediato não devolve nada (intervalo)');

select lives_ok($$ select disparador.mark_sent('62000000-0000-0000-0000-000000000001', 'prov-1') $$, 'mark_sent');
select is((select status::text || ':' || provider_message_id from disparador.outbound_messages
           where id = '62000000-0000-0000-0000-000000000001'), 'sent:prov-1', 'mensagem marcada como sent com id do provedor');

-- Cap diário = 2: depois do 2º claim, nada mais hoje
update disparador.instances set next_allowed_at = now() - interval '1 second' where id = '42000000-0000-0000-0000-00000000000a';
select is((select id from disparador.claim_next('42000000-0000-0000-0000-00000000000a')),
  '62000000-0000-0000-0000-000000000002'::uuid, '2º claim após o intervalo');
update disparador.instances set next_allowed_at = now() - interval '1 second' where id = '42000000-0000-0000-0000-00000000000a';
select is((select id from disparador.claim_next('42000000-0000-0000-0000-00000000000a')), null::uuid,
  'cap diário atingido: nada mais é enviado hoje');

-- Fora da janela local: nada é enviado
update disparador.instances set daily_cap = 50, next_allowed_at = now() - interval '1 second',
  window_start = case when extract(hour from now() at time zone (select timezone from public.tenants
                       where id = '22000000-0000-0000-0000-00000000000a')) < 14 then '20:00'::time else '06:00'::time end,
  window_end   = case when extract(hour from now() at time zone (select timezone from public.tenants
                       where id = '22000000-0000-0000-0000-00000000000a')) < 14 then '22:00'::time else '08:00'::time end
  where id = '42000000-0000-0000-0000-00000000000a';
select is((select id from disparador.claim_next('42000000-0000-0000-0000-00000000000a')), null::uuid,
  'fora da janela local nada é enviado');

-- Instância desligada: nada é enviado
update disparador.instances set status = 'disconnected', window_start = '06:00', window_end = '22:00'
  where id = '42000000-0000-0000-0000-00000000000a';
select is((select id from disparador.claim_next('42000000-0000-0000-0000-00000000000a')), null::uuid,
  'instância desligada não envia');

select * from finish();
rollback;
