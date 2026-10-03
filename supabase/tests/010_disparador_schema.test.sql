-- Disparador: estrutura do schema, limites anti-ban nas restrições e isolamento por tenant. Dados fictícios.
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

select has_schema('disparador', 'schema disparador existe');
select has_table('disparador', 'instances', 'tabela instances');
select has_table('disparador', 'contacts', 'tabela contacts');
select has_table('disparador', 'campaigns', 'tabela campaigns');
select has_table('disparador', 'variant_groups', 'tabela variant_groups');
select has_table('disparador', 'variants', 'tabela variants');
select has_table('disparador', 'outbound_messages', 'tabela outbound_messages');
select has_table('disparador', 'inbound_messages', 'tabela inbound_messages');
select has_table('disparador', 'daily_usage', 'tabela daily_usage');
select col_is_unique('disparador', 'instances', 'phone_e164', '1 instância por número');
select col_is_unique('disparador', 'inbound_messages', array['instance_id', 'provider_message_id'],
  'inbound deduplicado por instância + id do provedor');
select col_is_unique('disparador', 'contacts', array['tenant_id', 'phone_e164'], 'contato único por igreja');

-- Dados fictícios
insert into public.tenants (id, name, cnpj, slug) values
  ('20000000-0000-0000-0000-00000000000a', 'Igreja Disp A', '11222333000181', 'igreja-disp-a'),
  ('20000000-0000-0000-0000-00000000000b', 'Igreja Disp B', '11444777000161', 'igreja-disp-b');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000001a1', 'disp.admin.a@teste.invalid');
insert into public.tenant_memberships (tenant_id, user_id, role) values
  ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000001a1', 'admin');

-- Limites anti-ban garantidos pelo banco
select throws_ok(
  $$ insert into disparador.instances (tenant_id, name, phone_e164, daily_cap)
     values ('20000000-0000-0000-0000-00000000000a', 'cap-alto', '+5511900000001', 51) $$,
  '23514', null, 'cap diário acima de 50 é recusado');
select throws_ok(
  $$ insert into disparador.instances (tenant_id, name, phone_e164, min_delay_s)
     values ('20000000-0000-0000-0000-00000000000a', 'delay-baixo', '+5511900000002', 30) $$,
  '23514', null, 'intervalo mínimo abaixo de 45s é recusado');
select throws_ok(
  $$ insert into disparador.instances (tenant_id, name, phone_e164, window_end)
     values ('20000000-0000-0000-0000-00000000000a', 'janela-tarde', '+5511900000003', '23:00') $$,
  '23514', null, 'janela além das 22h é recusada');
select throws_ok(
  $$ insert into disparador.instances (tenant_id, name, phone_e164)
     values ('20000000-0000-0000-0000-00000000000a', 'fone-ruim', '11900000004') $$,
  '23514', null, 'telefone fora do formato E.164 é recusado');
select throws_ok(
  $$ insert into disparador.variant_groups (id, tenant_id, name)
     values ('30000000-0000-0000-0000-0000000000a9', '20000000-0000-0000-0000-00000000000a', 'g');
     insert into disparador.variants (tenant_id, group_id, template)
     values ('20000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-0000000000a9', 'Olá, tudo bem?') $$,
  '23514', null, 'variação sem {nome} é recusada');

insert into disparador.instances (id, tenant_id, name, phone_e164) values
  ('40000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'inst-a', '+5511911110000'),
  ('40000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-00000000000b', 'inst-b', '+5511922220000');
insert into disparador.contacts (tenant_id, phone_e164, name, opted_in_at) values
  ('20000000-0000-0000-0000-00000000000b', '+5511933330000', 'Contato B', now());
insert into disparador.outbound_messages (tenant_id, instance_id, product, recipient_e164, recipient_name, body) values
  ('20000000-0000-0000-0000-00000000000b', '40000000-0000-0000-0000-00000000000b', 'pai', '+5511933330000', 'Contato B', 'Olá Contato B');

select throws_ok(
  $$ insert into disparador.instances (tenant_id, name, phone_e164)
     values ('20000000-0000-0000-0000-00000000000b', 'dup', '+5511911110000') $$,
  '23505', null, 'mesmo número em duas instâncias é recusado');

-- Isolamento: admin da igreja A
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000001a1","role":"authenticated"}', true);

select results_eq($$ select name from disparador.instances $$, array['inst-a'::text],
  'admin A só vê a instância da igreja A');
select is_empty($$ select 1 from disparador.contacts $$, 'admin A não vê contatos da igreja B');
select is_empty($$ select 1 from disparador.outbound_messages $$, 'admin A não vê a fila da igreja B');
select throws_ok(
  $$ insert into disparador.outbound_messages (tenant_id, instance_id, product, recipient_e164, recipient_name, body)
     values ('20000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-00000000000a', 'pai', '+5511944440000', 'X', 'Olá X') $$,
  '42501', null, 'cliente não escreve direto na fila (só via enqueue_message)');
update disparador.instances set daily_cap = 50 where id = '40000000-0000-0000-0000-00000000000b';
reset role;
select is((select daily_cap from disparador.instances where id = '40000000-0000-0000-0000-00000000000b'), 30,
  'admin A não altera instância da igreja B');

select * from finish();
rollback;
