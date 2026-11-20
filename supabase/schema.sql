-- ONIX WEB : schéma initial PostgreSQL / Supabase
create extension if not exists pgcrypto;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default 'Lecteur ONIX',
 role text not null default 'user' check (role in ('user','admin')),
 created_at timestamptz not null default now()
);
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
 insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name','Lecteur ONIX'));
 return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create table if not exists public.webtoons (
 id uuid primary key default gen_random_uuid(), title text not null, slug text unique not null,
 synopsis text, cover_url text, author_name text, status text not null default 'ongoing',
 language text not null default 'fr', genres text[] not null default '{}',
 views_count bigint not null default 0, is_published boolean not null default false,
 rights_status text not null default 'pending' check (rights_status in ('pending','owned','public_domain','licensed')),
 rights_notes text, created_at timestamptz not null default now()
);
create table if not exists public.chapters (
 id uuid primary key default gen_random_uuid(), webtoon_id uuid not null references public.webtoons(id) on delete cascade,
 chapter_number numeric(8,2) not null, title text not null default '', is_published boolean not null default false,
 published_at timestamptz, created_at timestamptz not null default now(), unique(webtoon_id,chapter_number)
);
create table if not exists public.chapter_pages (
 id uuid primary key default gen_random_uuid(), chapter_id uuid not null references public.chapters(id) on delete cascade,
 page_number int not null, image_url text not null, unique(chapter_id,page_number)
);
create table if not exists public.user_library (
 user_id uuid not null references public.profiles(id) on delete cascade,
 webtoon_id uuid not null references public.webtoons(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(user_id,webtoon_id)
);
create table if not exists public.reading_history (
 user_id uuid not null references public.profiles(id) on delete cascade,
 chapter_id uuid not null references public.chapters(id) on delete cascade,
 updated_at timestamptz not null default now(), page_number int not null default 1,
 primary key(user_id,chapter_id)
);
create table if not exists public.comments (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 chapter_id uuid not null references public.chapters(id) on delete cascade,
 body text not null check (char_length(body) between 1 and 2000),
 created_at timestamptz not null default now()
);
create table if not exists public.notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 webtoon_id uuid references public.webtoons(id) on delete cascade, title text not null,
 body text not null, read_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.support_messages (
 id uuid primary key default gen_random_uuid(), email text not null, subject text not null,
 message text not null check(char_length(message) between 1 and 5000), created_at timestamptz not null default now()
);

-- RLS : activée sur toutes les tables exposées
alter table public.profiles enable row level security;
alter table public.webtoons enable row level security;
alter table public.chapters enable row level security;
alter table public.chapter_pages enable row level security;
alter table public.user_library enable row level security;
alter table public.reading_history enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;
alter table public.support_messages enable row level security;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;
create policy "profiles read own" on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
create policy "profiles update own" on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid() and role='user');
create policy "public read published webtoons" on public.webtoons for select using(is_published=true or public.is_admin());
create policy "admins manage webtoons" on public.webtoons for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "public read published chapters" on public.chapters for select using(is_published=true or public.is_admin());
create policy "admins manage chapters" on public.chapters for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "public read pages of published chapters" on public.chapter_pages for select using(exists(select 1 from public.chapters c where c.id=chapter_id and c.is_published=true) or public.is_admin());
create policy "admins manage pages" on public.chapter_pages for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "library own rows" on public.user_library for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "history own rows" on public.reading_history for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "comments public read" on public.comments for select using(true);
create policy "comments own insert" on public.comments for insert to authenticated with check(user_id=auth.uid());
create policy "comments own delete" on public.comments for delete to authenticated using(user_id=auth.uid() or public.is_admin());
create policy "notifications own" on public.notifications for select to authenticated using(user_id=auth.uid());
create policy "notifications update own" on public.notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "support insert public" on public.support_messages for insert with check(true);
create policy "admin read support" on public.support_messages for select to authenticated using(public.is_admin());

-- Créer un bucket Storage nommé "webtoon-pages" en privé dans Supabase.
-- Utiliser des URL signées pour les images privées si les licences l'exigent.
-- IMPORTANT : promouvoir manuellement le premier administrateur depuis SQL Editor :
-- update public.profiles set role='admin' where id='UUID_DU_COMPTE';

-- Signalements des chapitres envoyés depuis le lecteur ONIX.
create table if not exists public.chapter_reports (
 id uuid primary key default gen_random_uuid(),
 chapter_id uuid not null references public.chapters(id) on delete cascade,
 user_id uuid references public.profiles(id) on delete set null,
 reason text not null check (reason in ('image_missing','image_broken','wrong_order','wrong_chapter','translation','other')),
 details text check (details is null or char_length(details) <= 1500),
 status text not null default 'open' check (status in ('open','reviewing','resolved','rejected')),
 created_at timestamptz not null default now()
);
alter table public.chapter_reports enable row level security;
drop policy if exists "chapter reports submit" on public.chapter_reports;
create policy "chapter reports submit" on public.chapter_reports for insert with check (user_id is null or user_id=auth.uid());
drop policy if exists "admins read chapter reports" on public.chapter_reports;
create policy "admins read chapter reports" on public.chapter_reports for select to authenticated using(public.is_admin());
drop policy if exists "admins update chapter reports" on public.chapter_reports;
create policy "admins update chapter reports" on public.chapter_reports for update to authenticated using(public.is_admin()) with check(public.is_admin());
