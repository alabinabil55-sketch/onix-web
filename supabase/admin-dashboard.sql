-- ONIX WEB : migration tableau de bord administrateur
-- À exécuter dans Supabase SQL Editor après le schéma initial.

alter table public.profiles add column if not exists suspended_at timestamptz;
alter table public.webtoons add column if not exists is_archived boolean not null default false;
alter table public.chapters add column if not exists scheduled_at timestamptz;
alter table public.chapters add column if not exists published_at timestamptz;

create table if not exists public.rights_records (
 id uuid primary key default gen_random_uuid(),
 webtoon_id uuid not null references public.webtoons(id) on delete cascade,
 rights_holder text not null,
 license_type text not null,
 territories text[] not null default '{}',
 starts_at date,
 ends_at date,
 status text not null default 'pending' check(status in ('pending','approved','rejected','expired')),
 proof_url text,
 created_at timestamptz not null default now(),
 check(ends_at is null or starts_at is null or ends_at >= starts_at)
);
create table if not exists public.ad_revenue_events (
 id uuid primary key default gen_random_uuid(),
 source text not null,
 external_reference text,
 amount numeric(14,4) not null default 0,
 currency text not null default 'XOF',
 event_date date not null default current_date,
 created_at timestamptz not null default now()
);

alter table public.rights_records enable row level security;
alter table public.ad_revenue_events enable row level security;

drop policy if exists "admin manage rights records" on public.rights_records;
create policy "admin manage rights records" on public.rights_records
 for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "admin read ad revenue" on public.ad_revenue_events;
create policy "admin read ad revenue" on public.ad_revenue_events
 for select to authenticated using(public.is_admin());
drop policy if exists "admin insert ad revenue" on public.ad_revenue_events;
create policy "admin insert ad revenue" on public.ad_revenue_events
 for insert to authenticated with check(public.is_admin());

-- Le bucket onix-media doit être créé dans Supabase Storage.
-- Le tableau de bord utilise des URL publiques pour les couvertures/pages de ce starter.
-- Pour des licences territoriales ou des œuvres nécessitant une protection, basculer vers
-- un bucket privé et une API serveur qui délivre des URL signées après vérification des droits.

-- IMPORTANT : les rôles et suspensions doivent être protégés côté serveur.
-- Les politiques de base sont complétées par les règles ci-dessous.
drop policy if exists "profiles admin read all" on public.profiles;
create policy "profiles admin read all" on public.profiles
 for select to authenticated using(id=auth.uid() or public.is_admin());
drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update" on public.profiles
 for update to authenticated using(public.is_admin()) with check(public.is_admin());

-- Les politiques RLS ne bloquent pas automatiquement une session Auth suspendue.
-- La suspension doit être appliquée dans les routes/API serveur ou via Supabase Auth Admin
-- avec une fonction Edge sécurisée utilisant la service_role côté serveur uniquement.
