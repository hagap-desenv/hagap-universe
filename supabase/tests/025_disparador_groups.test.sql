-- Disparador: grupos de contatos (listas da igreja) e envio para grupo (enqueue_group). Dados fictícios.
-- Envio para grupo = campanha com 1 mensagem individual por membro, só com opt-in; opt-out e sem opt-in
-- são ignorados (contados), nunca abortam o lote.
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

select has_table('disparador', 'contact_groups', 'tabela contact_groups');
select has_table('disparador', 'contact_group_members', 'tabela contact_group_members');
select col_is_unique('disparador', 'contact_groups', array['tenant_id', 'name'], 'nome do grupo único por igreja');
select col_is_pk('disparador', 'contact_group_members', array['group_id', 'contact_id'], 'contato 1x por grupo');
select has_function('disparador', 'enqueue_group', array['uuid', 'uuid', 'uuid', 'timestamp with time zone'],
  'enqueue_group existe');

insert into public.tenants (id, name, cnpj, slug) values
  ('28000000-0000-0000-0000-00000000000a', 'Igreja Grupos A', '11222333000181', 'igreja-grupos-a'),
  ('28000000-0000-0000-0000-00000000000b', 'Igreja Grupos B', '11444777000161', 'igreja-grupos-b');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000008a1', 'grp.admin.a@teste.invalid'),
  ('00000000-0000-0000-0000-0000000008a2', 'grp.coord.a@teste.invalid'),
  ('00000000-0000-0000-0000-0000000008a3', 'grp.mentor.a@teste.invalid'),
  ('00000000-0000-0000-0000-0000000008b1', 'grp.admin.b@teste.invalid');
insert into public.tenant_memberships (tenant_id, user_id, role) values
  ('28000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000008a1', 'admin'),
  ('28000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000008a2', 'coordenador'),
  ('28000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000008a3', 'mentor'),
  ('28000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000008b1', 'admin');
insert into disparador.instances (id, tenant_id, name, phone_e164, status) values
  ('48000000-0000-0000-0000-00000000000a', '28000000-0000-0000-0000-00000000000a', 'grupos-a', '+5511979000000', 'open'),
  ('48000000-0000-0000-0000-00000000000b', '28000000-0000-0000-0000-00000000000b', 'grupos-b', '+5511979100000', 'open');
insert into disparador.contacts (id, tenant_id, phone_e164, name, opted_in_at, opted_out_at) values
  ('58000000-0000-0000-0000-0000000000a1', '28000000-0000-0000-0000-00000000000a', '+5511979200001', 'Ana Grupo', now() - interval '1 day', null),
  ('58000000-0000-0000-0000-0000000000a2', '28000000-0000-0000-0000-00000000000a', '+5511979200002', 'Bia Grupo', null, null),
  ('58000000-0000-0000-0000-0000000000a3', '28000000-0000-0000-0000-00000000000a', '+5511979200003', 'Caio Grupo', now() - interval '2 days', now()),
  ('58000000-0000-0000-0000-0000000000a4', '28000000-0000-0000-0000-00000000000a', '+5511979200004', 'Davi Grupo', now() - interval '1 day', null),
  ('58000000-0000-0000-0000-0000000000b1', '28000000-0000-0000-0000-00000000000b', '+5511979200005', 'Eva Grupo', now() - interval '1 day', null);
insert into disparador.variant_groups (id, tenant_id, name) values
  ('38000000-0000-0000-0000-0000000000a3', '28000000-0000-0000-0000-00000000000a', 'aviso-3'),
  ('38000000-0000-0000-0000-0000000000a2', '28000000-0000-0000-0000-00000000000a', 'aviso-2'),
  ('38000000-0000-0000-0000-0000000000b3', '28000000-0000-0000-0000-00000000000b', 'aviso-b');
insert into disparador.variants (tenant_id, group_id, template) values
  ('28000000-0000-0000-0000-00000000000a', '38000000-0000-0000-0000-0000000000a3', 'Olá {nome}, encontro sábado.'),
  ('28000000-0000-0000-0000-00000000000a', '38000000-0000-0000-0000-0000000000a3', 'Oi {nome}! Sábado tem encontro.'),
  ('28000000-0000-0000-0000-00000000000a', '38000000-0000-0000-0000-0000000000a3', '{nome}, te esperamos sábado.'),
  ('28000000-0000-0000-0000-00000000000a', '38000000-0000-0000-0000-0000000000a2', 'Olá {nome}'),
  ('28000000-0000-0000-0000-00000000000a', '38000000-0000-0000-0000-0000000000a2', 'Oi {nome}'),
  ('28000000-0000-0000-0000-00000000000b', '38000000-0000-0000-0000-0000000000b3', 'Olá {nome} B'),
  ('28000000-0000-0000-0000-00000000000b', '38000000-0000-0000-0000-0000000000b3', 'Oi {nome} B'),
  ('28000000-0000-0000-0000-00000000000b', '38000000-0000-0000-0000-0000000000b3', 'Ei {nome} B');
insert into disparador.contact_groups (id, tenant_id, name) values
  ('68000000-0000-0000-0000-00000000000a', '28000000-0000-0000-0000-00000000000a', 'Jovens A'),
  ('68000000-0000-0000-0000-00000000000b', '28000000-0000-0000-0000-00000000000b', 'Liderança B');
insert into disparador.contact_group_members (tenant_id, group_id, contact_id) values
  ('28000000-0000-0000-0000-00000000000a', '68000000-0000-0000-0000-00000000000a', '58000000-0000-0000-0000-0000000000a1'),
  ('28000000-0000-0000-0000-00000000000a', '68000000-0000-0000-0000-00000000000a', '58000000-0000-0000-0000-0000000000a2'),
  ('28000000-0000-0000-0000-00000000000a', '68000000-0000-0000-0000-00000000000a', '58000000-0000-0000-0000-0000000000a3'),
  ('28000000-0000-0000-0000-00000000000a', '68000000-0000-0000-0000-00000000000a', '58000000-0000-0000-0000-0000000000a4'),
  ('28000000-0000-0000-0000-00000000000b', '68000000-0000-0000-0000-00000000000b', '58000000-0000-0000-0000-0000000000b1');

-- Mesmo tenant garantido pelas FKs compostas (mesmo para o dono do banco)
select throws_ok(
  $$ insert into disparador.contact_group_members (tenant_id, group_id, contact_id) values
     ('28000000-0000-0000-0000-00000000000a', '68000000-0000-0000-0000-00000000000a', '58000000-0000-0000-0000-0000000000b1') $$,
  '23503', null, 'contato da igreja B não entra em grupo da igreja A');
select throws_ok(
  $$ insert into disparador.contact_group_members (tenant_id, group_id, contact_id) values
     ('28000000-0000-0000-0000-00000000000b', '68000000-0000-0000-0000-00000000000a', '58000000-0000-0000-0000-0000000000b1') $$,
  '23503', null, 'membro com tenant diferente do grupo é recusado');

-- ===== Admin da igreja A =====
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000008a1","role":"authenticated"}', true);
select results_eq($$ select name from disparador.contact_groups $$, array['Jovens A'::text],
  'admin A só vê os grupos da igreja A');
select is_empty($$ select 1 from disparador.contact_group_members where group_id = '68000000-0000-0000-0000-00000000000b' $$,
  'admin A não vê membros de grupo da igreja B');
select throws_ok(
  $$ insert into disparador.contact_groups (tenant_id, name) values ('28000000-0000-0000-0000-00000000000b', 'Intruso') $$,
  '42501', null, 'admin A não cria grupo na igreja B');
select throws_ok(
  $$ insert into disparador.contact_group_members (tenant_id, group_id, contact_id) values
     ('28000000-0000-0000-0000-00000000000b', '68000000-0000-0000-0000-00000000000b', '58000000-0000-0000-0000-0000000000b1') $$,
  '42501', null, 'admin A não mexe nos membros de grupo da igreja B');
select lives_ok(
  $$ insert into disparador.contact_groups (tenant_id, name, description) values
     ('28000000-0000-0000-0000-00000000000a', 'Casais A', 'grupo fictício') $$,
  'admin A cria grupo na própria igreja');

-- ===== Mentor da igreja A =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000008a3","role":"authenticated"}', true);
select is((select count(*)::int from disparador.contact_group_members
           where group_id = '68000000-0000-0000-0000-00000000000a'), 4, 'mentor lê os membros do grupo');
select throws_ok(
  $$ insert into disparador.contact_groups (tenant_id, name) values ('28000000-0000-0000-0000-00000000000a', 'Mentor') $$,
  '42501', null, 'mentor não cria grupo');
select throws_ok(
  $$ select * from disparador.enqueue_group('68000000-0000-0000-0000-00000000000a',
       '48000000-0000-0000-0000-00000000000a', '38000000-0000-0000-0000-0000000000a3') $$,
  '42501', null, 'mentor não envia para grupo');

-- ===== Admin da igreja B =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000008b1","role":"authenticated"}', true);
select throws_ok(
  $$ select * from disparador.enqueue_group('68000000-0000-0000-0000-00000000000a',
       '48000000-0000-0000-0000-00000000000a', '38000000-0000-0000-0000-0000000000a3') $$,
  '42501', null, 'admin B não envia para grupo da igreja A');
select throws_ok(
  $$ select * from disparador.enqueue_group('68000000-0000-0000-0000-00000000000b',
       '48000000-0000-0000-0000-00000000000a', '38000000-0000-0000-0000-0000000000b3') $$,
  '42501', null, 'admin B não usa instância da igreja A');
select throws_ok(
  $$ select * from disparador.enqueue_group('68000000-0000-0000-0000-0000000000ff',
       '48000000-0000-0000-0000-00000000000b', '38000000-0000-0000-0000-0000000000b3') $$,
  '42501', null, 'grupo inexistente: mesma resposta (não revela existência)');

-- ===== Coordenador da igreja A =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000008a2","role":"authenticated"}', true);
select throws_ok(
  $$ select * from disparador.enqueue_group('68000000-0000-0000-0000-00000000000a',
       '48000000-0000-0000-0000-00000000000a', '38000000-0000-0000-0000-0000000000a2') $$,
  'DS003', null, 'grupo de variações com menos de 3 é recusado');
select throws_ok(
  $$ select * from disparador.enqueue_group('68000000-0000-0000-0000-00000000000a',
       '48000000-0000-0000-0000-00000000000a', '38000000-0000-0000-0000-0000000000b3') $$,
  '22023', null, 'grupo de variações de outra igreja é recusado');

select set_config('test.campaign', (
  select campaign_id::text from disparador.enqueue_group('68000000-0000-0000-0000-00000000000a',
    '48000000-0000-0000-0000-00000000000a', '38000000-0000-0000-0000-0000000000a3')), true);
select results_eq(
  $$ select enfileiradas, ignoradas_sem_optin, ignoradas_optout, ignoradas_outros
     from disparador.campaign_progress(current_setting('test.campaign')::uuid) $$,
  $$ values (2, 1, 1, 0) $$,
  'resumo: 2 enfileiradas (opt-in), 1 sem opt-in e 1 opt-out ignorados');
select results_eq(
  $$ select recipient_e164 from disparador.outbound_messages
     where campaign_id = current_setting('test.campaign')::uuid order by recipient_e164 $$,
  array['+5511979200001'::text, '+5511979200004'::text],
  'uma mensagem individual por membro com opt-in (Ana e Davi)');
select ok(
  (select bool_and(position(recipient_name in body) > 0 and body not like '%{nome}%')
   from disparador.outbound_messages where campaign_id = current_setting('test.campaign')::uuid),
  'cada mensagem é personalizada com o nome do membro');
select is_empty(
  $$ select 1 from disparador.outbound_messages where recipient_e164 in ('+5511979200002', '+5511979200003') $$,
  'sem opt-in e opt-out não recebem nada');
select results_eq(
  $$ select tenant_id, variant_group_id, contact_group_id, status::text from disparador.campaigns
     where id = current_setting('test.campaign')::uuid $$,
  $$ values ('28000000-0000-0000-0000-00000000000a'::uuid, '38000000-0000-0000-0000-0000000000a3'::uuid,
             '68000000-0000-0000-0000-00000000000a'::uuid, 'running'::text) $$,
  'campanha registrada na igreja, com o grupo de variações e o grupo de contatos');
select results_eq(
  $$ select queued, sent, failed from disparador.campaign_progress(current_setting('test.campaign')::uuid) $$,
  $$ values (2::bigint, 0::bigint, 0::bigint) $$,
  'acompanhamento: 2 na fila, 0 enviadas, 0 falhas');

-- Agendamento: not_before respeitado
select set_config('test.campaign2', (
  select campaign_id::text from disparador.enqueue_group('68000000-0000-0000-0000-00000000000a',
    '48000000-0000-0000-0000-00000000000a', '38000000-0000-0000-0000-0000000000a3',
    date_trunc('minute', now()) + interval '1 day')), true);
select is(
  (select min(not_before) from disparador.outbound_messages where campaign_id = current_setting('test.campaign2')::uuid),
  date_trunc('minute', now()) + interval '1 day', 'agendamento vira not_before das mensagens');

-- Admin A não vê o acompanhamento de campanha alheia (RLS)
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000008b1","role":"authenticated"}', true);
select is_empty($$ select 1 from disparador.campaign_progress(current_setting('test.campaign')::uuid) $$,
  'admin B não vê o acompanhamento da campanha da igreja A');

-- ===== Popup "Adicionar número": cria contato novo ou só vincula o existente =====
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000008a2","role":"authenticated"}', true);
select results_eq(
  $$ select existed from disparador.add_group_member('68000000-0000-0000-0000-00000000000a', 'Fábio Grupo', '+5511979200006', true) $$,
  array[false], 'número novo vira contato (com opt-in) e membro');
select results_eq(
  $$ select existed from disparador.add_group_member('68000000-0000-0000-0000-00000000000a', 'Outro Nome', '+5511979200003', true) $$,
  array[true], 'número já cadastrado só é vinculado');
select results_eq(
  $$ select name, opted_out_at is not null from disparador.contacts where phone_e164 = '+5511979200003' $$,
  $$ values ('Caio Grupo'::text, true) $$, 'vincular não altera nome nem desfaz opt-out do contato existente');
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000008a3","role":"authenticated"}', true);
select throws_ok(
  $$ select * from disparador.add_group_member('68000000-0000-0000-0000-00000000000a', 'Mentor', '+5511979200007', false) $$,
  '42501', null, 'mentor não adiciona número ao grupo');

-- ===== Anónimo =====
reset role;
set local role anon;
select throws_ok(
  $$ select * from disparador.enqueue_group('68000000-0000-0000-0000-00000000000a',
       '48000000-0000-0000-0000-00000000000a', '38000000-0000-0000-0000-0000000000a3') $$,
  '42501', null, 'anónimo não envia para grupo');
reset role;

select * from finish();
rollback;
