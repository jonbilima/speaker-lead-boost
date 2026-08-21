create table if not exists public.organizer_email_fill_log_20260821c (
  opportunity_id uuid primary key,
  domain text,
  email text,
  filled_at timestamptz not null default now()
);
grant all on public.organizer_email_fill_log_20260821c to service_role;
alter table public.organizer_email_fill_log_20260821c enable row level security;
create policy "admins read fill log c" on public.organizer_email_fill_log_20260821c
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

with cand as (
  select o.id, c.domain, c.email
  from public.opportunities o
  join public.aggregator_domain_resolution_20260821 r on r.opportunity_id = o.id
  join public.organizer_contacts c on c.domain = r.resolved_domain
  where o.organizer_email is null
    and o.is_active = true
    and c.email is not null
),
upd as (
  update public.opportunities o
  set organizer_email = cand.email
  from cand
  where o.id = cand.id and o.organizer_email is null
  returning o.id, cand.domain, cand.email
)
insert into public.organizer_email_fill_log_20260821c (opportunity_id, domain, email)
select id, domain, email from upd
on conflict (opportunity_id) do nothing;