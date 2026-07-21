-- Cron routines : pilotage des agents planifiés qui tournent sur GitHub Actions.
--
-- CONTEXTE : trois agents (surf-report-agent, email-ai-agent, infra-health-check)
-- tournent en cron chez GitHub. L'ordonnancement reste chez GitHub — on ne le
-- réimplémente pas ici. Cette table sert à les inventorier, à porter leur config
-- métier, et à garder trace des déclenchements manuels.
--
-- Modelé sur http_monitors (enabled / last_* / RLS user + org) et health_checks
-- (historique horodaté avec payload jsonb libre) pour rester cohérent avec
-- l'existant plutôt que d'inventer une n-ième forme.

-- ============================================================
-- 1. cron_routines — l'inventaire des agents pilotés
-- ============================================================
create table if not exists public.cron_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,

  name text not null,
  description text,

  -- Localisation du workflow chez GitHub. workflow_file est le nom de fichier
  -- (« surf-daily.yml »), pas l'id numérique : l'API accepte les deux et le nom
  -- survit à une recréation du workflow, contrairement à l'id.
  github_owner text not null,
  github_repo text not null,
  workflow_file text not null,

  -- Reflet de l'état côté GitHub. La source de vérité reste le workflow lui-même
  -- (activé/désactivé via l'API) ; cette colonne est un miroir pour l'UI, remise
  -- à jour à chaque synchronisation.
  enabled boolean not null default true,

  -- Expression cron déclarée dans le YAML. Purement informative : la modifier ici
  -- ne change rien chez GitHub, seul un commit sur le workflow le fait.
  cron_expression text,

  -- Config métier de l'agent (le config.json du repo). Éditée depuis l'UI, poussée
  -- vers le repo ou lue par l'agent au démarrage selon la routine.
  config jsonb not null default '{}'::jsonb,

  last_run_at timestamptz,
  last_run_status text,
  last_run_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Un même workflow ne doit pas être inventorié deux fois pour un même owner.
  unique (user_id, github_owner, github_repo, workflow_file)
);

create index if not exists cron_routines_user_idx
  on public.cron_routines (user_id, created_at desc);

-- ============================================================
-- 2. cron_runs — historique des exécutions
-- ============================================================
create table if not exists public.cron_runs (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.cron_routines(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Id du run côté GitHub, pour rapprocher un run observé d'un run déclenché.
  -- Null tant que GitHub n'a pas encore matérialisé le run (dispatch asynchrone).
  github_run_id bigint,

  -- 'manual' = déclenché depuis l'UI · 'scheduled' = relevé depuis le cron GitHub.
  trigger_source text not null default 'manual'
    check (trigger_source in ('manual', 'scheduled')),

  status text not null default 'pending'
    check (status in ('pending', 'running', 'success', 'failure', 'cancelled', 'unknown')),

  html_url text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,

  -- Payload libre : réponse GitHub, message d'erreur, durée… Même parti pris que
  -- health_checks.<provider>_data — on ne fige pas un schéma qu'on devra migrer.
  data jsonb not null default '{}'::jsonb,

  -- Requis par l'upsert de `sync`, qui doit pouvoir être rejoué sans dupliquer.
  -- Postgres autorise plusieurs NULL sous une contrainte unique : les runs
  -- 'pending' (dispatch accepté, run pas encore matérialisé côté GitHub) ne se
  -- gênent donc pas entre eux.
  unique (github_run_id)
);

create index if not exists cron_runs_routine_idx
  on public.cron_runs (routine_id, started_at desc);

create index if not exists cron_runs_user_idx
  on public.cron_runs (user_id, started_at desc);

-- ============================================================
-- 3. RLS
-- ============================================================
alter table public.cron_routines enable row level security;
alter table public.cron_runs enable row level security;

-- `drop ... if exists` avant chaque `create policy` : le reste du fichier est
-- rejouable (`if not exists` partout), les policies étaient la seule chose qui
-- faisait échouer une seconde exécution. Cette migration se passe souvent à la
-- main dans le SQL Editor, où l'on relance volontiers un script.
drop policy if exists "cron_routines: self crud" on public.cron_routines;
create policy "cron_routines: self crud"
  on public.cron_routines for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "cron_routines: org members crud" on public.cron_routines;
create policy "cron_routines: org members crud"
  on public.cron_routines for all
  using (org_id is not null and public.is_org_member(org_id))
  with check (org_id is not null and public.is_org_member(org_id));

drop policy if exists "cron_runs: self crud" on public.cron_runs;
create policy "cron_runs: self crud"
  on public.cron_runs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Lecture des runs d'une routine partagée avec l'organisation. En lecture seule :
-- l'écriture passe par l'Edge Function en service_role, jamais par le client.
drop policy if exists "cron_runs: org members read" on public.cron_runs;
create policy "cron_runs: org members read"
  on public.cron_runs for select
  using (
    exists (
      select 1 from public.cron_routines r
      where r.id = cron_runs.routine_id
        and r.org_id is not null
        and public.is_org_member(r.org_id)
    )
  );

-- ============================================================
-- 4. updated_at
-- ============================================================
create or replace function public.touch_cron_routines_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cron_routines_touch_updated_at on public.cron_routines;
create trigger cron_routines_touch_updated_at
  before update on public.cron_routines
  for each row execute function public.touch_cron_routines_updated_at();
