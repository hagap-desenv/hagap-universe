-- Disparador: RPCs do app (chave do webhook, alvo do QR, painel e grupos de variações). Dados fictícios.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

select has_function('disparador', 'rotate_webhook_key', array['uuid'], 'rotate_webhook_key existe');
select has_function('disparador', 'connect_target', array['uuid'], 'connect_target existe');
select has_function('disparador', 'instance_overview', array['uuid'], 'instance_overview existe');
select has_function('disparador', 'create_variant_group', array['uuid', 'text', 'text[]'],
  'create_variant_group existe');

insert into public.tenants (id, name, cnpj, slug) values
  ('25000000-0000-0000-0000-00000000000a', 'Igreja App A', '55566677000183', 'igreja-app-a'),
  ('25000000-0000-0000-0000-00000000000b', 'Igreja App B', '33344455000183', 'igreja-app-b');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000005a1', 'app.admin.a@teste.invalid'),
  ('00000000-0000-0000-0000-0000000005a2', 'app.mentor.a@teste.invalid'),
  ('00000000-0000-0000-0000-0000000005b1', 'app.admin.b@teste.invalid');
insert into public.tenant_memberships (tenant_id, user_id, role) values
  ('25000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000005a1', 'admin'),
  ('25000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000005a2', 'mentor'),
  ('25000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000005b1', 'admin');
insert into disparador.instances (id, tenant_id, name, phone_e164) values
  ('45000000-0000-0000-0000-00000000000a', '25000000-0000-0000-0000-00000000000a', 'disp-app-a', '+5511976000001'),
  ('45000000-0000-0000-0000-00000000000b', '25000000-0000-0000-0000-00000000000b', 'disp-app-b', '+5511976000002');
insert into disparador.outbound_messages (tenant_id, instance_id, product, recipient_e164, recipient_name, body, status) values
  ('25000000-0000-0000-0000-00000000000a', '45000000-0000-0000-0000-00000000000a', 'pai', '+5511977000001', 'Um', 'Olá Um', 'queued'),
  ('25000000-0000-0000-0000-00000000000a', '45000000-0000-0000-0000-00000000000a', 'pai', '+5511977000002', 'Dois', 'Olá Dois', 'queued'),
  ('25000000-0000-0000-0000-00000000000a', '45000000-0000-0000-0000-00000000000a', 'pai', '+5511977000003', 'Tres', 'Olá Tres', 'sent');
insert into disparador.daily_usage (instance_id, day, sent) values
  ('45000000-0000-0000-0000-00000000000a', (now() at time zone 'America/Sao_Paulo')::date, 1);

-- ===== Admin da igreja A =====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000005a1","role":"authenticated"}', true);

select set_config('test.key1', disparador.rotate_webhook_key('45000000-0000-0000-0000-00000000000a'), true);
select set_config('test.key2', disparador.rotate_webhook_key('45000000-0000-0000-0000-00000000000a'), true);
select ok(length(current_setting('test.key2')) >= 40, 'admin gera chave longa (devolvida uma única vez)');
select isnt(current_setting('test.key1'), current_setting('test.key2'), 'rotacionar gera chave nova');

select is(disparador.connect_target('45000000-0000-0000-0000-00000000000a'), 'disp-app-a',
  'admin obtém a instância a ligar por QR');

select results_eq(
  $$ select name, queued, sending, sent, failed, sent_today, daily_cap, has_webhook_key
     from disparador.instance_overview('25000000-0000-0000-0000-00000000000a') $$,
  $$ values ('disp-app-a'::text, 2::bigint, 0::bigint, 1::bigint, 0::bigint, 1, 30, true) $$,
  'painel: fila por estado e uso diário vs cap da instância');
select is_empty($$ select 1 from disparador.instance_overview('25000000-0000-0000-0000-00000000000b') $$,
  'painel da igreja B invisível para o admin da A');

select throws_ok(
  $$ select disparador.create_variant_group('25000000-0000-0000-0000-00000000000a', 'poucas',
       array['Olá {nome}', 'Oi {nome}']) $$,
  '22023', null, 'grupo com menos de 3 variações é recusado');
select isnt(
  disparador.create_variant_group('25000000-0000-0000-0000-00000000000a', 'abertura',
    array['Olá {nome}, tudo bem?', 'Oi {nome}! Como vai?', '{nome}, bom dia!']),
  null, 'grupo com 3 variações personalizadas é criado');
select is((select count(*)::int from disparador.variants v
           join disparador.variant_groups g on g.id = v.group_id where g.name = 'abertura'), 3,
  'as 3 variações ficam gravadas no grupo');
select throws_ok(
  $$ select disparador.create_variant_group('25000000-0000-0000-0000-00000000000a', 'sem-nome',
       array['Olá {nome}', 'Oi {nome}', 'Bom dia!']) $$,
  '23514', null, 'variação sem {nome} é recusada');

-- ===== Mentor da igreja A =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000005a2","role":"authenticated"}', true);
select throws_ok($$ select disparador.rotate_webhook_key('45000000-0000-0000-0000-00000000000a') $$,
  '42501', null, 'mentor não gera chave do webhook');
select throws_ok($$ select disparador.connect_target('45000000-0000-0000-0000-00000000000a') $$,
  '42501', null, 'mentor não liga instância');
select throws_ok(
  $$ select disparador.create_variant_group('25000000-0000-0000-0000-00000000000a', 'mentor',
       array['Olá {nome}', 'Oi {nome}', 'Ei {nome}']) $$,
  '42501', null, 'mentor não cria grupo de variações');

-- ===== Admin da igreja B =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000005b1","role":"authenticated"}', true);
select throws_ok($$ select disparador.rotate_webhook_key('45000000-0000-0000-0000-00000000000a') $$,
  '42501', null, 'admin de outra igreja não gera chave');
select throws_ok($$ select disparador.connect_target('45000000-0000-0000-0000-00000000000a') $$,
  '42501', null, 'admin de outra igreja não liga a instância');
select throws_ok($$ select disparador.rotate_webhook_key('45000000-0000-0000-0000-0000000000ff') $$,
  '42501', null, 'instância inexistente: mesma resposta (não revela existência)');
select throws_ok(
  $$ select disparador.create_variant_group('25000000-0000-0000-0000-00000000000a', 'intrusa',
       array['Olá {nome}', 'Oi {nome}', 'Ei {nome}']) $$,
  '42501', null, 'admin de outra igreja não cria grupo na igreja A');

-- ===== Anónimo =====
reset role;
set local role anon;
select throws_ok($$ select disparador.rotate_webhook_key('45000000-0000-0000-0000-00000000000a') $$,
  '42501', null, 'anónimo não executa rotate_webhook_key');

-- ===== Verificação como dono: só o hash fica guardado =====
reset role;
select is(
  (select webhook_key_hash from disparador.instances where id = '45000000-0000-0000-0000-00000000000a'),
  encode(sha256(convert_to(current_setting('test.key2'), 'UTF8')), 'hex'),
  'banco guarda só o sha256 hex da chave atual');
select isnt(
  (select webhook_key_hash from disparador.instances where id = '45000000-0000-0000-0000-00000000000a'),
  current_setting('test.key2'), 'chave nunca fica em texto no banco');
select is(
  (select webhook_key_hash from disparador.instances where id = '45000000-0000-0000-0000-00000000000b'),
  null, 'instância da igreja B intacta');

select * from finish();
rollback;
