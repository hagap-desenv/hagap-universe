-- Disparador (QA Q1): opt-out respeitado no envio — enqueue recusa (DS004), claim_next cancela,
-- SAIR/PARAR cancela a fila do número na igreja. Opt-out na igreja A não afeta a B. Dados fictícios.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- Fuso com "agora" dentro da janela 06–22 (estável a qualquer hora do CI)
insert into public.tenants (id, name, cnpj, slug, timezone) values
  ('27000000-0000-0000-0000-00000000000a', 'Igreja Optout A', '11222333000181', 'igreja-optout-a',
   (select name from pg_timezone_names
    where name like 'Etc/GMT%' and extract(hour from now() at time zone name) between 9 and 19
    order by name limit 1)),
  ('27000000-0000-0000-0000-00000000000b', 'Igreja Optout B', '11444777000161', 'igreja-optout-b',
   (select name from pg_timezone_names
    where name like 'Etc/GMT%' and extract(hour from now() at time zone name) between 9 and 19
    order by name limit 1));
insert into disparador.instances (id, tenant_id, name, phone_e164, status, next_allowed_at) values
  ('47000000-0000-0000-0000-00000000000a', '27000000-0000-0000-0000-00000000000a', 'optout-a', '+5511976000000',
   'open', now() - interval '1 minute'),
  ('47000000-0000-0000-0000-00000000000b', '27000000-0000-0000-0000-00000000000b', 'optout-b', '+5511977000000',
   'open', now() - interval '1 minute');
-- Mesmo número com opt-in nas duas igrejas
insert into disparador.contacts (tenant_id, phone_e164, name, opted_in_at) values
  ('27000000-0000-0000-0000-00000000000a', '+5511978000001', 'Xavier Teste', now() - interval '1 day'),
  ('27000000-0000-0000-0000-00000000000b', '+5511978000001', 'Xavier Teste', now() - interval '1 day');

select set_config('request.jwt.claims', '{"role":"service_role"}', true);

create temporary table q1_ids (k text primary key, id uuid);
insert into q1_ids values
  ('a', disparador.enqueue_message('47000000-0000-0000-0000-00000000000a', '+5511978000001', 'Xavier Teste', 'pai',
     p_body => 'Olá Xavier, lembrete A')),
  ('b', disparador.enqueue_message('47000000-0000-0000-0000-00000000000b', '+5511978000001', 'Xavier Teste', 'pai',
     p_body => 'Olá Xavier, lembrete B'));

-- SAIR na igreja A
select is(disparador.record_inbound('47000000-0000-0000-0000-00000000000a', '+5511978000001', 'SAIR', 'Q1-SAIR', now()),
  true, 'SAIR gravado');
select is((select status::text from disparador.outbound_messages where id = (select id from q1_ids where k = 'a')),
  'cancelled', 'após SAIR a mensagem queued do número fica cancelled');
select is((select status::text from disparador.outbound_messages where id = (select id from q1_ids where k = 'b')),
  'queued', 'opt-out na igreja A não cancela a fila da igreja B');
select is((select id from disparador.claim_next('47000000-0000-0000-0000-00000000000a')), null::uuid,
  'claim_next não devolve nada para quem saiu');

select throws_ok(
  $$ select disparador.enqueue_message('47000000-0000-0000-0000-00000000000a', '+5511978000001', 'Xavier Teste', 'pai',
       p_body => 'Olá Xavier, outro lembrete') $$,
  'DS004', null, 'enqueue sem campanha para contato com opt-out é recusado (DS004)');
select lives_ok(
  $$ select disparador.enqueue_message('47000000-0000-0000-0000-00000000000b', '+5511978000001', 'Xavier Teste', 'pai',
       p_body => 'Olá Xavier, mais um lembrete B') $$,
  'na igreja B o mesmo número continua a receber');

-- claim_next: opt-out registado depois de enfileirar → cancela e segue para a próxima elegível
insert into disparador.outbound_messages (id, tenant_id, instance_id, product, recipient_e164, recipient_name, body, created_at) values
  ('67000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-00000000000a', '47000000-0000-0000-0000-00000000000a',
   'pai', '+5511978000002', 'Yara', 'Olá Yara', now() - interval '2 minutes'),
  ('67000000-0000-0000-0000-000000000002', '27000000-0000-0000-0000-00000000000a', '47000000-0000-0000-0000-00000000000a',
   'pai', '+5511978000003', 'Zeca', 'Olá Zeca', now() - interval '1 minute');
insert into disparador.contacts (tenant_id, phone_e164, name, opted_out_at) values
  ('27000000-0000-0000-0000-00000000000a', '+5511978000002', 'Yara', now());

select is((select id from disparador.claim_next('47000000-0000-0000-0000-00000000000a')),
  '67000000-0000-0000-0000-000000000002'::uuid, 'claim_next pula quem saiu e devolve a próxima elegível');
select is((select status::text from disparador.outbound_messages where id = '67000000-0000-0000-0000-000000000001'),
  'cancelled', 'mensagem de quem saiu fica cancelled ao ser reclamada');

-- Só opt-out na fila: claim devolve nulo e cancela
update disparador.instances set next_allowed_at = now() - interval '1 second'
  where id = '47000000-0000-0000-0000-00000000000a';
insert into disparador.outbound_messages (id, tenant_id, instance_id, product, recipient_e164, recipient_name, body) values
  ('67000000-0000-0000-0000-000000000003', '27000000-0000-0000-0000-00000000000a', '47000000-0000-0000-0000-00000000000a',
   'pai', '+5511978000002', 'Yara', 'Olá de novo Yara');
select is((select id from disparador.claim_next('47000000-0000-0000-0000-00000000000a')), null::uuid,
  'fila só com opt-out: claim_next devolve nulo');
select is((select status::text from disparador.outbound_messages where id = '67000000-0000-0000-0000-000000000003'),
  'cancelled', 'e a mensagem fica cancelled');
select is((select coalesce(sum(sent), 0)::int from disparador.daily_usage
           where instance_id = '47000000-0000-0000-0000-00000000000a'), 1,
  'mensagens canceladas não contam no uso diário');

select * from finish();
rollback;
