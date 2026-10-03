-- Disparador: enqueue_message aplica as regras anti-ban na entrada da fila. Dados fictícios.
-- Assinatura: disparador.enqueue_message(p_instance_id uuid, p_recipient_e164 text, p_recipient_name text,
--   p_product text, p_body text default null, p_variant_group_id uuid default null,
--   p_campaign_id uuid default null, p_not_before timestamptz default null) returns uuid
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select has_function('disparador', 'enqueue_message',
  array['uuid', 'text', 'text', 'text', 'text', 'uuid', 'uuid', 'timestamp with time zone'],
  'enqueue_message existe');

insert into public.tenants (id, name, cnpj, slug) values
  ('21000000-0000-0000-0000-00000000000a', 'Igreja Enq A', '11222333000181', 'igreja-enq-a');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000002a1', 'enq.mentor.a@teste.invalid');
insert into public.tenant_memberships (tenant_id, user_id, role) values
  ('21000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000002a1', 'mentor');
insert into disparador.instances (id, tenant_id, name, phone_e164) values
  ('41000000-0000-0000-0000-00000000000a', '21000000-0000-0000-0000-00000000000a', 'enq-a', '+5511955550000');
insert into disparador.variant_groups (id, tenant_id, name) values
  ('31000000-0000-0000-0000-000000000003', '21000000-0000-0000-0000-00000000000a', 'abertura-3'),
  ('31000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-00000000000a', 'abertura-2');
insert into disparador.variants (tenant_id, group_id, template) values
  ('21000000-0000-0000-0000-00000000000a', '31000000-0000-0000-0000-000000000003', 'Olá {nome}, tudo bem?'),
  ('21000000-0000-0000-0000-00000000000a', '31000000-0000-0000-0000-000000000003', 'Oi {nome}! Como você está?'),
  ('21000000-0000-0000-0000-00000000000a', '31000000-0000-0000-0000-000000000003', '{nome}, bom dia! Tudo certo?'),
  ('21000000-0000-0000-0000-00000000000a', '31000000-0000-0000-0000-000000000002', 'Olá {nome}'),
  ('21000000-0000-0000-0000-00000000000a', '31000000-0000-0000-0000-000000000002', 'Oi {nome}');
insert into disparador.campaigns (id, tenant_id, name, variant_group_id) values
  ('51000000-0000-0000-0000-00000000000a', '21000000-0000-0000-0000-00000000000a', 'Campanha teste',
   '31000000-0000-0000-0000-000000000003');
insert into disparador.contacts (tenant_id, phone_e164, name, opted_in_at, opted_out_at) values
  ('21000000-0000-0000-0000-00000000000a', '+5511960000001', 'Ana Optin', now(), null),
  ('21000000-0000-0000-0000-00000000000a', '+5511960000002', 'Bia Semoptin', null, null),
  ('21000000-0000-0000-0000-00000000000a', '+5511960000003', 'Caio Saiu', now() - interval '2 days', now());

-- Motor/servidor do produto chama como service_role
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select throws_ok(
  $$ select disparador.enqueue_message('41000000-0000-0000-0000-00000000000a', '+5511970000001', '  ', 'pai', 'Olá') $$,
  '22023', null, 'nome do destinatário é obrigatório');
select throws_ok(
  $$ select disparador.enqueue_message('41000000-0000-0000-0000-00000000000a', '+5511970000001', 'Davi', 'pai',
       'Olá Davi', '31000000-0000-0000-0000-000000000003') $$,
  '22023', null, 'corpo livre e grupo de variações juntos é recusado');
select throws_ok(
  $$ select disparador.enqueue_message('41000000-0000-0000-0000-00000000000a', '+5511970000001', 'Davi', 'pai',
       null, '31000000-0000-0000-0000-000000000002') $$,
  'DS003', null, 'grupo com menos de 3 variações é recusado');

select lives_ok(
  $$ select disparador.enqueue_message('41000000-0000-0000-0000-00000000000a', '+5511970000001', 'Davi Teste', 'pai',
       null, '31000000-0000-0000-0000-000000000003') $$,
  'abertura com 3 variações é enfileirada');
select ok(
  (select body like '%Davi Teste%' and body not like '%{nome}%'
   from disparador.outbound_messages where recipient_e164 = '+5511970000001'),
  'variação renderizada com o nome do destinatário');
select is(
  (select status::text from disparador.outbound_messages where recipient_e164 = '+5511970000001'),
  'queued', 'mensagem entra na fila como queued');

-- Anti-broadcast: mesmo corpo para outro número em 24h
select lives_ok(
  $$ select disparador.enqueue_message('41000000-0000-0000-0000-00000000000a', '+5511970000002', 'Eva', 'pai',
       'Pergunta 2/14: como está a sua semana?') $$,
  'primeiro envio de um corpo é aceito');
select throws_ok(
  $$ select disparador.enqueue_message('41000000-0000-0000-0000-00000000000a', '+5511970000003', 'Fábio', 'pai',
       'Pergunta 2/14: como está a sua semana?') $$,
  'DS001', null, 'mesmo corpo para outro número em 24h é recusado (broadcast)');

-- Campanhas só para opt-in
select lives_ok(
  $$ select disparador.enqueue_message('41000000-0000-0000-0000-00000000000a', '+5511960000001', 'Ana Optin', 'campanha',
       null, '31000000-0000-0000-0000-000000000003', '51000000-0000-0000-0000-00000000000a') $$,
  'campanha para contato com opt-in é aceita');
select throws_ok(
  $$ select disparador.enqueue_message('41000000-0000-0000-0000-00000000000a', '+5511960000002', 'Bia Semoptin', 'campanha',
       null, '31000000-0000-0000-0000-000000000003', '51000000-0000-0000-0000-00000000000a') $$,
  'DS002', null, 'campanha para contato sem opt-in é recusada');
select throws_ok(
  $$ select disparador.enqueue_message('41000000-0000-0000-0000-00000000000a', '+5511960000003', 'Caio Saiu', 'campanha',
       null, '31000000-0000-0000-0000-000000000003', '51000000-0000-0000-0000-00000000000a') $$,
  'DS002', null, 'campanha para contato com opt-out é recusada');

-- Mentor não enfileira (só admin/coordenador da igreja ou service_role)
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000002a1","role":"authenticated"}', true);
select throws_ok(
  $$ select disparador.enqueue_message('41000000-0000-0000-0000-00000000000a', '+5511970000009', 'Gil', 'pai', 'Olá Gil') $$,
  '42501', null, 'mentor não enfileira mensagens');
reset role;

select * from finish();
rollback;
