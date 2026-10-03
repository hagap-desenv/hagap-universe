-- Disparador (QA Q5): eventos de queda/conexão da instância (alerta de queda no app).
-- set_instance_status regista 'disconnected' (open → disconnected) e 'connected' (→ open);
-- instance_overview expõe down_since (queda mais recente que a última conexão). Leitura por membros; escrita só motor.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select has_table('disparador', 'instance_events', 'tabela instance_events');
select ok((select relrowsecurity from pg_class where oid = 'disparador.instance_events'::regclass),
  'instance_events com RLS ativa');
select has_column('disparador', 'instance_events', 'kind', 'evento tem kind');

insert into public.tenants (id, name, cnpj, slug) values
  ('2a000000-0000-0000-0000-00000000000a', 'Igreja Eventos A', '11222333000181', 'igreja-eventos-a'),
  ('2a000000-0000-0000-0000-00000000000b', 'Igreja Eventos B', '11444777000161', 'igreja-eventos-b');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000aa1', 'eventos.mentor.a@teste.invalid'),
  ('00000000-0000-0000-0000-000000000ab1', 'eventos.admin.b@teste.invalid');
insert into public.tenant_memberships (tenant_id, user_id, role) values
  ('2a000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000aa1', 'mentor'),
  ('2a000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000ab1', 'admin');
insert into disparador.instances (id, tenant_id, name, phone_e164, status) values
  ('4a000000-0000-0000-0000-00000000000a', '2a000000-0000-0000-0000-00000000000a', 'eventos-a', '+5511979700000', 'open');

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select disparador.set_instance_status('4a000000-0000-0000-0000-00000000000a', 'disconnected');
select is((select string_agg(kind, ',') from disparador.instance_events
           where instance_id = '4a000000-0000-0000-0000-00000000000a'),
  'disconnected', 'open → disconnected regista evento de queda');
select is((select tenant_id from disparador.instance_events where instance_id = '4a000000-0000-0000-0000-00000000000a'),
  '2a000000-0000-0000-0000-00000000000a'::uuid, 'evento herda o tenant da instância');
select disparador.set_instance_status('4a000000-0000-0000-0000-00000000000a', 'disconnected');
select is((select count(*)::int from disparador.instance_events where instance_id = '4a000000-0000-0000-0000-00000000000a'),
  1, 'disconnected → disconnected não duplica o evento');

-- Membro da igreja A vê o alerta no painel
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000aa1","role":"authenticated"}', true);
select ok((select down_since is not null from disparador.instance_overview('2a000000-0000-0000-0000-00000000000a')),
  'painel mostra queda (down_since) para membro da igreja');
select is((select count(*)::int from disparador.instance_events), 1, 'membro da igreja lê os eventos');
select throws_ok(
  $$ insert into disparador.instance_events (tenant_id, instance_id, kind)
     values ('2a000000-0000-0000-0000-00000000000a', '4a000000-0000-0000-0000-00000000000a', 'connected') $$,
  '42501', null, 'cliente não escreve eventos');

-- Admin da igreja B não vê eventos da A
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000ab1","role":"authenticated"}', true);
select is_empty($$ select 1 from disparador.instance_events $$, 'eventos da igreja A invisíveis para a B');
reset role;

-- Reconexão: evento 'connected' e o alerta some
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
-- garante ordem temporal dentro da mesma transação
update disparador.instance_events set created_at = now() - interval '1 minute'
  where instance_id = '4a000000-0000-0000-0000-00000000000a';
select disparador.set_instance_status('4a000000-0000-0000-0000-00000000000a', 'open');
select is((select kind from disparador.instance_events where instance_id = '4a000000-0000-0000-0000-00000000000a'
           order by created_at desc limit 1),
  'connected', '→ open regista evento de conexão');
select ok((select down_since is null from disparador.instance_overview('2a000000-0000-0000-0000-00000000000a')),
  'após reconectar o alerta de queda some');

-- connecting não é queda
select disparador.set_instance_status('4a000000-0000-0000-0000-00000000000a', 'connecting');
select is((select count(*)::int from disparador.instance_events
           where instance_id = '4a000000-0000-0000-0000-00000000000a' and kind = 'disconnected'), 1,
  'open → connecting não regista queda');

select * from finish();
rollback;
