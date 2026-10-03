-- Disparador: schema do motor de envio WhatsApp (fila + regras anti-ban), isolado por tenant.
-- Regras: context/whatsapp-seguranca.md. Limites seguros garantidos também por restrições do banco.

create schema disparador;

create type disparador.instance_status as enum ('disconnected', 'connecting', 'open');
create type disparador.message_status as enum ('queued', 'sending', 'sent', 'failed', 'deferred', 'cancelled');
create type disparador.campaign_status as enum ('draft', 'running', 'paused', 'done');

-- 1 instância Evolution por número; limites por instância
create table disparador.instances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null unique,
  phone_e164 text not null unique constraint instances_phone_e164 check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  status disparador.instance_status not null default 'disconnected',
  daily_cap int not null default 30 constraint instances_daily_cap check (daily_cap between 1 and 50),
  window_start time not null default '06:00',
  window_end time not null default '22:00',
  min_delay_s int not null default 45,
  max_delay_s int not null default 90,
  next_allowed_at timestamptz not null default now(),
  webhook_key_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint instances_window check (window_start >= '06:00' and window_end <= '22:00' and window_start < window_end),
  constraint instances_delay check (min_delay_s >= 45 and max_delay_s <= 90 and min_delay_s <= max_delay_s),
  unique (id, tenant_id)
);

create table disparador.contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  phone_e164 text not null constraint contacts_phone_e164 check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  name text not null,
  opted_in_at timestamptz,
  opted_out_at timestamptz,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, phone_e164)
);

create table disparador.variant_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name),
  unique (id, tenant_id)
);

-- Cada variação tem de personalizar com {nome}
create table disparador.variants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  group_id uuid not null,
  template text not null constraint variants_personalized check (position('{nome}' in template) > 0),
  created_at timestamptz not null default now(),
  foreign key (group_id, tenant_id) references disparador.variant_groups (id, tenant_id) on delete cascade
);
create index variants_group_idx on disparador.variants (group_id);

create table disparador.campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  name text not null,
  variant_group_id uuid not null,
  status disparador.campaign_status not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (variant_group_id, tenant_id) references disparador.variant_groups (id, tenant_id),
  unique (id, tenant_id)
);

-- Fila de saída: escrita só pelo motor (funções SECURITY DEFINER / service_role)
create table disparador.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  instance_id uuid not null,
  product text not null,
  recipient_e164 text not null constraint outbound_phone_e164 check (recipient_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  recipient_name text not null,
  body text not null,
  variant_group_id uuid,
  campaign_id uuid,
  status disparador.message_status not null default 'queued',
  not_before timestamptz not null default now(),
  attempts int not null default 0,
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  foreign key (instance_id, tenant_id) references disparador.instances (id, tenant_id) on delete cascade,
  foreign key (campaign_id, tenant_id) references disparador.campaigns (id, tenant_id)
);
create index outbound_queue_idx on disparador.outbound_messages (instance_id, created_at) where status = 'queued';
create index outbound_broadcast_idx on disparador.outbound_messages (tenant_id, md5(body), created_at);

create table disparador.inbound_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  instance_id uuid not null,
  sender_e164 text not null,
  body text,
  provider_message_id text not null,
  provider_ts timestamptz,
  received_at timestamptz not null default now(),
  foreign key (instance_id, tenant_id) references disparador.instances (id, tenant_id) on delete cascade,
  unique (instance_id, provider_message_id)
);

-- Uso diário por instância (dia na hora local do tenant); conta todos os fluxos
create table disparador.daily_usage (
  instance_id uuid not null references disparador.instances (id) on delete cascade,
  day date not null,
  sent int not null default 0,
  primary key (instance_id, day)
);

create trigger instances_updated_at before update on disparador.instances
  for each row execute function public.set_updated_at();
create trigger contacts_updated_at before update on disparador.contacts
  for each row execute function public.set_updated_at();
create trigger variant_groups_updated_at before update on disparador.variant_groups
  for each row execute function public.set_updated_at();
create trigger campaigns_updated_at before update on disparador.campaigns
  for each row execute function public.set_updated_at();
create trigger outbound_messages_updated_at before update on disparador.outbound_messages
  for each row execute function public.set_updated_at();

-- ===== Permissões e RLS =====
grant usage on schema disparador to authenticated, service_role;
grant all on all tables in schema disparador to service_role;

grant select on all tables in schema disparador to authenticated;
grant insert, update, delete on disparador.contacts, disparador.variant_groups, disparador.variants,
  disparador.campaigns to authenticated;
grant insert, delete on disparador.instances to authenticated;
-- Configuração editável da instância (estado, número e agenda de envio ficam com o motor)
grant update (name, daily_cap, window_start, window_end, min_delay_s, max_delay_s) on disparador.instances to authenticated;

alter table disparador.instances enable row level security;
alter table disparador.contacts enable row level security;
alter table disparador.variant_groups enable row level security;
alter table disparador.variants enable row level security;
alter table disparador.campaigns enable row level security;
alter table disparador.outbound_messages enable row level security;
alter table disparador.inbound_messages enable row level security;
alter table disparador.daily_usage enable row level security;

-- Leitura: membros da igreja (ou super_admin)
create policy instances_select on disparador.instances for select to authenticated
  using (public.is_super_admin() or public.is_tenant_member(tenant_id));
create policy contacts_select on disparador.contacts for select to authenticated
  using (public.is_super_admin() or public.is_tenant_member(tenant_id));
create policy variant_groups_select on disparador.variant_groups for select to authenticated
  using (public.is_super_admin() or public.is_tenant_member(tenant_id));
create policy variants_select on disparador.variants for select to authenticated
  using (public.is_super_admin() or public.is_tenant_member(tenant_id));
create policy campaigns_select on disparador.campaigns for select to authenticated
  using (public.is_super_admin() or public.is_tenant_member(tenant_id));
create policy outbound_select on disparador.outbound_messages for select to authenticated
  using (public.is_super_admin() or public.is_tenant_member(tenant_id));
create policy inbound_select on disparador.inbound_messages for select to authenticated
  using (public.is_super_admin() or public.is_tenant_member(tenant_id));
create policy daily_usage_select on disparador.daily_usage for select to authenticated
  using (exists (
    select 1 from disparador.instances i
    where i.id = instance_id and (public.is_super_admin() or public.is_tenant_member(i.tenant_id))
  ));

-- Instâncias: só admin da igreja
create policy instances_write on disparador.instances for all to authenticated
  using (public.is_super_admin() or public.has_tenant_role(tenant_id, array['admin']::public.app_role[]))
  with check (public.is_super_admin() or public.has_tenant_role(tenant_id, array['admin']::public.app_role[]));

-- Contatos, variações e campanhas: admin ou coordenador
create policy contacts_write on disparador.contacts for all to authenticated
  using (public.is_super_admin() or public.has_tenant_role(tenant_id, array['admin', 'coordenador']::public.app_role[]))
  with check (public.is_super_admin() or public.has_tenant_role(tenant_id, array['admin', 'coordenador']::public.app_role[]));
create policy variant_groups_write on disparador.variant_groups for all to authenticated
  using (public.is_super_admin() or public.has_tenant_role(tenant_id, array['admin', 'coordenador']::public.app_role[]))
  with check (public.is_super_admin() or public.has_tenant_role(tenant_id, array['admin', 'coordenador']::public.app_role[]));
create policy variants_write on disparador.variants for all to authenticated
  using (public.is_super_admin() or public.has_tenant_role(tenant_id, array['admin', 'coordenador']::public.app_role[]))
  with check (public.is_super_admin() or public.has_tenant_role(tenant_id, array['admin', 'coordenador']::public.app_role[]));
create policy campaigns_write on disparador.campaigns for all to authenticated
  using (public.is_super_admin() or public.has_tenant_role(tenant_id, array['admin', 'coordenador']::public.app_role[]))
  with check (public.is_super_admin() or public.has_tenant_role(tenant_id, array['admin', 'coordenador']::public.app_role[]));
