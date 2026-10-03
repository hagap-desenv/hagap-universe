-- Disparador (QA Q7): virada de dia — o uso do dia local ANTERIOR (no cap) não bloqueia o claim de hoje;
-- o dia é calculado no fuso de cada igreja. Dois tenants com fusos diferentes (os dois extremos Etc/GMT
-- com "agora" dentro da janela), estável a qualquer hora do CI. Dados fictícios.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

create temporary table q7_tz as
  select
    (select name from pg_timezone_names
     where name ~ '^Etc/GMT[+-][0-9]+$' and extract(hour from now() at time zone name) between 7 and 20
     order by utc_offset asc limit 1) as tz_west,
    (select name from pg_timezone_names
     where name ~ '^Etc/GMT[+-][0-9]+$' and extract(hour from now() at time zone name) between 7 and 20
     order by utc_offset desc limit 1) as tz_east;

select ok((select tz_west <> tz_east and tz_west is not null from q7_tz), 'dois fusos diferentes dentro da janela');

insert into public.tenants (id, name, cnpj, slug, timezone) values
  ('2c000000-0000-0000-0000-00000000000a', 'Igreja Oeste', '11222333000181', 'igreja-oeste', (select tz_west from q7_tz)),
  ('2c000000-0000-0000-0000-00000000000b', 'Igreja Leste', '11444777000161', 'igreja-leste', (select tz_east from q7_tz));
insert into disparador.instances (id, tenant_id, name, phone_e164, status, daily_cap, next_allowed_at) values
  ('4c000000-0000-0000-0000-00000000000a', '2c000000-0000-0000-0000-00000000000a', 'rollover-oeste', '+5511979900000',
   'open', 2, now() - interval '1 minute'),
  ('4c000000-0000-0000-0000-00000000000b', '2c000000-0000-0000-0000-00000000000b', 'rollover-leste', '+5511979910000',
   'open', 2, now() - interval '1 minute');
-- Ontem (dia local de cada igreja) no cap
insert into disparador.daily_usage (instance_id, day, sent)
  select '4c000000-0000-0000-0000-00000000000a', (now() at time zone tz_west)::date - 1, 2 from q7_tz
  union all
  select '4c000000-0000-0000-0000-00000000000b', (now() at time zone tz_east)::date - 1, 2 from q7_tz;
insert into disparador.outbound_messages (id, tenant_id, instance_id, product, recipient_e164, recipient_name, body) values
  ('6c000000-0000-0000-0000-000000000001', '2c000000-0000-0000-0000-00000000000a', '4c000000-0000-0000-0000-00000000000a',
   'pai', '+5511979900001', 'Oeste', 'Olá Oeste'),
  ('6c000000-0000-0000-0000-000000000002', '2c000000-0000-0000-0000-00000000000b', '4c000000-0000-0000-0000-00000000000b',
   'pai', '+5511979910001', 'Leste', 'Olá Leste'),
  ('6c000000-0000-0000-0000-000000000003', '2c000000-0000-0000-0000-00000000000a', '4c000000-0000-0000-0000-00000000000a',
   'pai', '+5511979900002', 'Oeste Dois', 'Olá Oeste Dois');

select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select is((select id from disparador.claim_next('4c000000-0000-0000-0000-00000000000a')),
  '6c000000-0000-0000-0000-000000000001'::uuid, 'oeste: cap de ontem não bloqueia hoje');
select is((select id from disparador.claim_next('4c000000-0000-0000-0000-00000000000b')),
  '6c000000-0000-0000-0000-000000000002'::uuid, 'leste: cap de ontem não bloqueia hoje');

select is((select day from disparador.daily_usage where instance_id = '4c000000-0000-0000-0000-00000000000a' and sent = 1),
  (select (now() at time zone tz_west)::date from q7_tz), 'oeste: uso conta no dia local da igreja');
select is((select day from disparador.daily_usage where instance_id = '4c000000-0000-0000-0000-00000000000b' and sent = 1),
  (select (now() at time zone tz_east)::date from q7_tz), 'leste: uso conta no dia local da igreja');
select is((select sent from disparador.daily_usage
           where instance_id = '4c000000-0000-0000-0000-00000000000a'
             and day = (select (now() at time zone tz_west)::date - 1 from q7_tz)), 2,
  'uso de ontem fica intacto');

-- Contraste: cap atingido HOJE bloqueia
update disparador.daily_usage set sent = 2
  where instance_id = '4c000000-0000-0000-0000-00000000000a'
    and day = (select (now() at time zone tz_west)::date from q7_tz);
update disparador.instances set next_allowed_at = now() - interval '1 second'
  where id = '4c000000-0000-0000-0000-00000000000a';
select is((select id from disparador.claim_next('4c000000-0000-0000-0000-00000000000a')), null::uuid,
  'cap de hoje no limite bloqueia');
select is((select status::text from disparador.outbound_messages where id = '6c000000-0000-0000-0000-000000000003'),
  'queued', 'mensagem bloqueada pelo cap continua na fila para o dia seguinte');

select * from finish();
rollback;
