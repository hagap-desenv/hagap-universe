-- Disparador: recebimento — dedup, opt-out SAIR/PARAR, leitura pelo produto e isolamento. Dados fictícios.
-- Assinaturas: disparador.webhook_instance(p_name text) returns table(instance_id uuid, webhook_key_hash text)
--              disparador.record_inbound(p_instance_id uuid, p_sender_e164 text, p_body text,
--                p_provider_message_id text, p_provider_ts timestamptz default null) returns boolean
--              disparador.fetch_inbound(p_instance_id uuid, p_since timestamptz) returns setof inbound_messages
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

select has_function('disparador', 'webhook_instance', array['text'], 'webhook_instance existe');
select has_function('disparador', 'record_inbound',
  array['uuid', 'text', 'text', 'text', 'timestamp with time zone'], 'record_inbound existe');
select has_function('disparador', 'fetch_inbound', array['uuid', 'timestamp with time zone'],
  'fetch_inbound existe');

insert into public.tenants (id, name, cnpj, slug) values
  ('24000000-0000-0000-0000-00000000000a', 'Igreja Inbound A', '11222333000181', 'igreja-inbound-a'),
  ('24000000-0000-0000-0000-00000000000b', 'Igreja Inbound B', '11444777000161', 'igreja-inbound-b');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000004a1', 'inbound.admin.a@teste.invalid'),
  ('00000000-0000-0000-0000-0000000004b1', 'inbound.admin.b@teste.invalid');
insert into public.tenant_memberships (tenant_id, user_id, role) values
  ('24000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000004a1', 'admin'),
  ('24000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000004b1', 'admin');
insert into disparador.instances (id, tenant_id, name, phone_e164, webhook_key_hash) values
  ('44000000-0000-0000-0000-00000000000a', '24000000-0000-0000-0000-00000000000a', 'inbound-a', '+5511973000000',
   encode(extensions.digest('chave-teste-a', 'sha256'), 'hex')),
  ('44000000-0000-0000-0000-00000000000b', '24000000-0000-0000-0000-00000000000b', 'inbound-b', '+5511974000000',
   encode(extensions.digest('chave-teste-b', 'sha256'), 'hex'));
-- Mesmo número com opt-in nas duas igrejas: opt-out na A não afeta a B
insert into disparador.contacts (tenant_id, phone_e164, name, opted_in_at) values
  ('24000000-0000-0000-0000-00000000000a', '+5511975000001', 'Ana Teste', now() - interval '1 day'),
  ('24000000-0000-0000-0000-00000000000b', '+5511975000001', 'Ana Teste', now() - interval '1 day'),
  ('24000000-0000-0000-0000-00000000000a', '+5511975000002', 'Beto Teste', now() - interval '1 day');

-- Motor (service_role)
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select is((select webhook_key_hash from disparador.webhook_instance('inbound-a')),
  encode(extensions.digest('chave-teste-a', 'sha256'), 'hex'), 'webhook resolve a instância pelo nome');
select is_empty($$ select 1 from disparador.webhook_instance('inexistente') $$, 'instância desconhecida: nada');

select is(disparador.record_inbound('44000000-0000-0000-0000-00000000000a', '+5511975000002', 'Tudo bem',
  'WA-1', now()), true, 'mensagem nova devolve true');
select is(disparador.record_inbound('44000000-0000-0000-0000-00000000000a', '+5511975000002', 'Tudo bem',
  'WA-1', now()), false, 'mensagem duplicada devolve false');
select is((select count(*)::int from disparador.inbound_messages where provider_message_id = 'WA-1'), 1,
  'duplicada não é gravada de novo');
select is((select tenant_id from disparador.inbound_messages where provider_message_id = 'WA-1'),
  '24000000-0000-0000-0000-00000000000a'::uuid, 'tenant vem da instância');
select is(disparador.record_inbound('44000000-0000-0000-0000-00000000000b', '+5511975000002', 'Oi',
  'WA-1', now()), true, 'mesmo id do provedor noutra instância é outra mensagem');

-- Opt-out
select is(disparador.record_inbound('44000000-0000-0000-0000-00000000000a', '+5511975000001', ' Sair. ',
  'WA-2', now()), true, 'SAIR gravado');
select ok((select opted_out_at is not null from disparador.contacts
            where tenant_id = '24000000-0000-0000-0000-00000000000a' and phone_e164 = '+5511975000001'),
  'SAIR aplica opt-out ao contato da igreja');
select is((select opted_out_at from disparador.contacts
           where tenant_id = '24000000-0000-0000-0000-00000000000b' and phone_e164 = '+5511975000001'),
  null, 'opt-out na igreja A não afeta a igreja B');
select is(disparador.record_inbound('44000000-0000-0000-0000-00000000000a', '+5511975000003', 'PARAR',
  'WA-3', now()), true, 'PARAR gravado');
select is((select source from disparador.contacts
           where tenant_id = '24000000-0000-0000-0000-00000000000a' and phone_e164 = '+5511975000003'
             and opted_out_at is not null),
  'webhook-optout', 'PARAR de número desconhecido cria contato já com opt-out');
select is(disparador.record_inbound('44000000-0000-0000-0000-00000000000a', '+5511975000002',
  'não quero sair agora', 'WA-4', now()), true, 'frase com "sair" gravada');
select is((select opted_out_at from disparador.contacts
           where tenant_id = '24000000-0000-0000-0000-00000000000a' and phone_e164 = '+5511975000002'),
  null, 'frase que só contém "sair" não é opt-out');

select throws_ok($$ select disparador.record_inbound('44000000-0000-0000-0000-0000000000ff', '+5511975000002',
  'x', 'WA-9') $$, '22023', null, 'instância inexistente é recusada');

-- Leitura pelo produto: só da instância pedida
select is((select count(*)::int from disparador.fetch_inbound('44000000-0000-0000-0000-00000000000a',
  now() - interval '1 hour')), 4, 'fetch_inbound devolve as respostas da instância');
select is((select count(*)::int from disparador.fetch_inbound('44000000-0000-0000-0000-00000000000b',
  now() - interval '1 hour')), 1, 'fetch_inbound não mistura instâncias/igrejas');

-- Cliente autenticado: não usa as RPCs do motor; RLS isola a leitura por igreja
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000004b1","role":"authenticated"}', true);
select throws_ok($$ select disparador.record_inbound('44000000-0000-0000-0000-00000000000b', '+5511975000002',
  'x', 'WA-X') $$, '42501', null, 'authenticated não grava mensagens recebidas');
select throws_ok($$ select * from disparador.fetch_inbound('44000000-0000-0000-0000-00000000000a', now() - interval '1 hour') $$,
  '42501', null, 'authenticated não usa fetch_inbound');
select throws_ok($$ select * from disparador.webhook_instance('inbound-a') $$, '42501', null,
  'authenticated não lê a chave do webhook');
select results_eq($$ select provider_message_id from disparador.inbound_messages $$, array['WA-1'::text],
  'admin B só vê as mensagens recebidas da igreja B');
reset role;

select * from finish();
rollback;
