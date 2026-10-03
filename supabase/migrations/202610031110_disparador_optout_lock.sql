-- Disparador (QA Q2): opt-out irreversível pelo cliente. Só o motor (service_role) limpa opted_out_at;
-- contato com opt-out não pode ser apagado (fecha delete + re-insert). Exclusão em cascata (igreja) é permitida.

create or replace function disparador.contacts_keep_opt_out()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Motor ou exclusão em cascata (ex.: igreja apagada) seguem
  if disparador.is_engine() or pg_catalog.pg_trigger_depth() > 1 then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'UPDATE' and old.opted_out_at is not null and new.opted_out_at is null then
    raise exception 'opt-out só pode ser desfeito pela própria pessoa' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' and old.opted_out_at is not null then
    raise exception 'contato com opt-out não pode ser apagado' using errcode = '42501';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger contacts_keep_opt_out_update before update on disparador.contacts
  for each row execute function disparador.contacts_keep_opt_out();
create trigger contacts_keep_opt_out_delete before delete on disparador.contacts
  for each row execute function disparador.contacts_keep_opt_out();
