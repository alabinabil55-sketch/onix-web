-- ONIX WEB - Monétisation publicitaire
-- À exécuter dans Supabase SQL Editor après les migrations précédentes.

create table if not exists public.ad_slots(
 id uuid primary key default gen_random_uuid(),
 slot_key text not null unique,
 label text not null,
 enabled boolean not null default false,
 provider text not null default 'adsense' check(provider in ('adsense','custom')),
 publisher_id text,
 ad_unit_id text,
 format text not null default 'auto',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
insert into public.ad_slots(slot_key,label,enabled,provider,format) values
 ('home_top','Accueil — haut de page',false,'adsense','auto'),
 ('home_featured','Accueil — après les sélections',false,'adsense','auto'),
 ('catalogue_top','Catalogue — haut de page',false,'adsense','auto'),
 ('catalogue_mid','Catalogue — au milieu de la grille',false,'adsense','auto')
on conflict(slot_key) do nothing;

alter table public.ad_revenue_events add column if not exists impressions bigint;
alter table public.ad_revenue_events add column if not exists clicks bigint;
alter table public.ad_revenue_events add column if not exists external_reference text;
drop index if exists public.ad_revenue_events_external_reference_uidx;
create unique index if not exists ad_revenue_events_external_reference_uidx
 on public.ad_revenue_events(external_reference);

alter table public.ad_slots enable row level security;
drop policy if exists "public read enabled ad slots" on public.ad_slots;
create policy "public read enabled ad slots" on public.ad_slots for select to anon,authenticated using(enabled=true);
drop policy if exists "admin manage ad slots" on public.ad_slots;
create policy "admin manage ad slots" on public.ad_slots for all to authenticated using(public.is_admin()) with check(public.is_admin());

-- Les revenus restent accessibles uniquement aux administrateurs.
alter table public.ad_revenue_events enable row level security;
drop policy if exists "admin read ad revenue" on public.ad_revenue_events;
create policy "admin read ad revenue" on public.ad_revenue_events for select to authenticated using(public.is_admin());
drop policy if exists "admin insert ad revenue" on public.ad_revenue_events;
create policy "admin insert ad revenue" on public.ad_revenue_events for insert to authenticated with check(public.is_admin());
drop policy if exists "admin update ad revenue" on public.ad_revenue_events;
create policy "admin update ad revenue" on public.ad_revenue_events for update to authenticated using(public.is_admin()) with check(public.is_admin());
