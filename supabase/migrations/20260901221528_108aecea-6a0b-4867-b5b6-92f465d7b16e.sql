create table if not exists public.opportunity_organizer_domains (
  opportunity_id uuid primary key references public.opportunities(id) on delete cascade,
  listing_url text,
  resolved_domain text,
  candidates text[] not null default '{}',
  method text not null default 'aggregator_link',
  rendered boolean not null default false,
  error text,
  resolved_at timestamptz not null default now()
);

create index if not exists opportunity_organizer_domains_domain_idx
  on public.opportunity_organizer_domains (resolved_domain);

grant select on public.opportunity_organizer_domains to authenticated;
grant select on public.opportunity_organizer_domains to anon;
grant all on public.opportunity_organizer_domains to service_role;

alter table public.opportunity_organizer_domains enable row level security;

create policy "Anyone can read organizer domain resolutions"
  on public.opportunity_organizer_domains for select using (true);
