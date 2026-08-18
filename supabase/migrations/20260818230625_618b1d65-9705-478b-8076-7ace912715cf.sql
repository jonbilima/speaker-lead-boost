create table public.lead_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  channel text not null,
  delivered_at timestamptz not null default now(),
  vertical_slug text references public.verticals(slug),
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint lead_deliveries_channel_check check (channel in ('weekly_digest','in_app_feed')),
  constraint lead_deliveries_unique unique (user_id, opportunity_id, channel)
);

create index lead_deliveries_user_delivered_idx on public.lead_deliveries(user_id, delivered_at desc);
create index lead_deliveries_vertical_idx on public.lead_deliveries(vertical_slug, delivered_at desc);

grant select on public.lead_deliveries to authenticated;
grant all on public.lead_deliveries to service_role;

alter table public.lead_deliveries enable row level security;

create policy "Users can view their own deliveries"
  on public.lead_deliveries for select to authenticated
  using (auth.uid() = user_id);