-- Seed LOCAL/CI apenas: SÓ DADOS FICTÍCIOS (nenhuma pessoa, igreja, telefone ou CNPJ real).
-- HOM tem seed próprio (tarefa 18), sem esta senha documentada.
-- CNPJs válidos mas fictícios; e-mails em @teste.invalid (domínio reservado, nunca entrega);
-- senha de teste óbvia para todos: Teste@1234. Nunca rodar em produção.
-- Valores distintos dos usados nos testes pgTAP (CNPJ, slug, nomes e números de instância).

-- ===== Igrejas =====
insert into public.tenants (id, name, cnpj, slug, timezone) values
  ('a1000000-0000-4000-8000-00000000000a', 'Igreja Fictícia Esperança', '12345678000195', 'igreja-ficticia-esperanca', 'America/Sao_Paulo'),
  ('b1000000-0000-4000-8000-00000000000b', 'Igreja Fictícia Bom Pastor', '98765432000198', 'igreja-ficticia-bom-pastor', 'America/Manaus');

-- Módulo "cuidado" (criado ligado pelo trigger) desligado na B: o menu do PAI segue tenant_modules
update public.tenant_modules set enabled = false
where tenant_id = 'b1000000-0000-4000-8000-00000000000b' and module_key = 'cuidado';

-- ===== Usuários (Auth local) =====
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('Teste@1234', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', u.full_name),
  now(), now(), '', '', '', ''
from (values
  ('a2000000-0000-4000-8000-000000000001'::uuid, 'admin.a@teste.invalid', 'Admin Fictício A'),
  ('a2000000-0000-4000-8000-000000000002'::uuid, 'coord.a@teste.invalid', 'Coordenadora Fictícia A'),
  ('a2000000-0000-4000-8000-000000000003'::uuid, 'mentor.a@teste.invalid', 'Mentor Fictício A'),
  ('b2000000-0000-4000-8000-000000000001'::uuid, 'admin.b@teste.invalid', 'Admin Fictícia B'),
  ('b2000000-0000-4000-8000-000000000002'::uuid, 'coord.b@teste.invalid', 'Coordenador Fictício B'),
  ('b2000000-0000-4000-8000-000000000003'::uuid, 'mentor.b@teste.invalid', 'Mentora Fictícia B'),
  ('c2000000-0000-4000-8000-000000000001'::uuid, 'multi@teste.invalid', 'Admin Fictício das Duas Igrejas'),
  ('d2000000-0000-4000-8000-000000000001'::uuid, 'super@teste.invalid', 'Super Admin Fictício da Plataforma')
) as u(id, email, full_name);

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(), now(), now()
from auth.users u
where u.email like '%@teste.invalid'
  and not exists (select 1 from auth.identities i where i.user_id = u.id);

-- super_admin da plataforma: role global no perfil, sem membership de igreja
update public.profiles set global_role = 'super_admin' where id = 'd2000000-0000-4000-8000-000000000001';

-- ===== Memberships (perfis criados pelo trigger handle_new_user) =====
insert into public.tenant_memberships (tenant_id, user_id, role) values
  ('a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-000000000001', 'admin'),
  ('a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-000000000002', 'coordenador'),
  ('a1000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-000000000003', 'mentor'),
  ('b1000000-0000-4000-8000-00000000000b', 'b2000000-0000-4000-8000-000000000001', 'admin'),
  ('b1000000-0000-4000-8000-00000000000b', 'b2000000-0000-4000-8000-000000000002', 'coordenador'),
  ('b1000000-0000-4000-8000-00000000000b', 'b2000000-0000-4000-8000-000000000003', 'mentor'),
  ('a1000000-0000-4000-8000-00000000000a', 'c2000000-0000-4000-8000-000000000001', 'admin'),
  ('b1000000-0000-4000-8000-00000000000b', 'c2000000-0000-4000-8000-000000000001', 'admin');

-- ===== Disparador: 1 instância fake por igreja (números fictícios) =====
insert into disparador.instances (id, tenant_id, name, phone_e164) values
  ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-00000000000a', 'seed-esperanca-01', '+5511990000101'),
  ('b3000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-00000000000b', 'seed-bompastor-01', '+5592990000202');

insert into disparador.contacts (tenant_id, phone_e164, name, opted_in_at, source) values
  ('a1000000-0000-4000-8000-00000000000a', '+5511990001001', 'Ana Fictícia', now(), 'seed'),
  ('a1000000-0000-4000-8000-00000000000a', '+5511990001002', 'Bruno Fictício', null, 'seed'),
  ('b1000000-0000-4000-8000-00000000000b', '+5592990002001', 'Carla Fictícia', now(), 'seed');

insert into disparador.variant_groups (id, tenant_id, name) values
  ('a4000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-00000000000a', 'boas-vindas');
insert into disparador.variants (tenant_id, group_id, template) values
  ('a1000000-0000-4000-8000-00000000000a', 'a4000000-0000-4000-8000-000000000001', 'Olá {nome}, que bom ter você por aqui!'),
  ('a1000000-0000-4000-8000-00000000000a', 'a4000000-0000-4000-8000-000000000001', 'Oi {nome}! Seja bem-vindo(a).'),
  ('a1000000-0000-4000-8000-00000000000a', 'a4000000-0000-4000-8000-000000000001', '{nome}, ficamos felizes com sua chegada!');

-- Fila: só pelo motor (enqueue_message como service_role), corpos diferentes (anti-broadcast)
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
select disparador.enqueue_message('a3000000-0000-4000-8000-000000000001', '+5511990001001', 'Ana Fictícia', 'pai',
  p_variant_group_id => 'a4000000-0000-4000-8000-000000000001');
select disparador.enqueue_message('a3000000-0000-4000-8000-000000000001', '+5511990001002', 'Bruno Fictício', 'pai',
  p_body => 'Olá Bruno Fictício, lembrete do encontro de sábado.');
select disparador.enqueue_message('b3000000-0000-4000-8000-000000000001', '+5592990002001', 'Carla Fictícia', 'pai',
  p_body => 'Olá Carla Fictícia, tudo bem por aí?');
select set_config('request.jwt.claims', '', false);
