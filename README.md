# Vigilo

Tableau de bord de surveillance d'infrastructure : Vigilo centralise l'état CI/CD de tes projets (GitHub Actions, pipelines GitLab, déploiements Vercel, ressources Cloudflare), surveille des endpoints HTTP avec alertes, publie des status pages publiques et fournit des audits UX / accessibilité / style.

Application SPA React + Supabase, multi-organisation, avec facturation Stripe.

## Stack

| Domaine | Techno |
|---------|--------|
| Build | Vite `^8.0.10` |
| UI | React `^19.2.5` + React Router `^7.14.2` |
| Styles | Tailwind CSS `^4` (via `@tailwindcss/vite`) + Radix UI + `class-variance-authority` |
| État serveur | TanStack React Query `^5.100.5` |
| Backend | Supabase (`@supabase/supabase-js` `^2.105.1`) — Postgres, Auth, Edge Functions |
| Formulaires | React Hook Form `^7.74.0` + Zod `^4.3.6` (`@hookform/resolvers`) |
| Notifications UI | Sonner `^2.0.7` |
| Icônes | `lucide-react` `^1.11.0` |
| Tests | Vitest `^4.1.5` + Testing Library, environnement `jsdom` |
| Langage | TypeScript `^5.9` |

Le React Compiler n'est pas activé.

## Prérequis

- Node.js 20.x (version utilisée par la CI)
- pnpm `10.33.2` (déclaré dans `packageManager`)
- Un projet Supabase
- La CLI Supabase pour déployer les migrations et les Edge Functions

## Installation

```bash
pnpm install
cp .env.example .env   # puis renseigner les valeurs
pnpm dev
```

## Variables d'environnement

Toutes les variables `VITE_*` sont **publiques** : elles sont embarquées dans le bundle. Ne jamais y mettre de secret.

| Variable | Obligatoire | Rôle |
|----------|-------------|------|
| `VITE_SUPABASE_URL` | Oui | URL du projet Supabase. Utilisée par le client Supabase et pour appeler les Edge Functions (`/functions/v1/...`). `src/lib/supabase.ts` lève une erreur au démarrage si absente. |
| `VITE_SUPABASE_ANON_KEY` | Oui | Clé anon Supabase. Même erreur au démarrage si absente. |
| `VITE_GITHUB_CLIENT_ID` | Pour l'OAuth GitHub | Client ID de la GitHub OAuth App, utilisé dans `src/pages/Settings.tsx` pour construire l'URL d'autorisation. |
| `VITE_GITLAB_CLIENT_ID` | Pour l'OAuth GitLab | Client ID de l'application GitLab, même usage. |
| `VITE_VERCEL_CLIENT_ID` | Non | Présente dans `.env.example` et la CI, mais **lue nulle part dans `src/`** : la connexion Vercel passe par la page d'installation de l'intégration, pas par une URL d'autorisation OAuth construite côté client. |

### Secrets des Edge Functions

Configurés côté Supabase (`supabase secrets set`), jamais dans `.env` :

| Secret | Fonctions concernées |
|--------|----------------------|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | toutes |
| `SUPABASE_ANON_KEY` | `create-checkout-session` |
| `STRIPE_SECRET_KEY` | `create-checkout-session`, `stripe-webhook` |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | `oauth-callback` |
| `GITLAB_CLIENT_ID` / `GITLAB_CLIENT_SECRET` | `oauth-callback` |
| `VERCEL_CLIENT_ID` / `VERCEL_CLIENT_SECRET` | `oauth-callback`, `vercel-exchange` |
| `APP_URL` | `oauth-callback`, `vercel-exchange` |
| `RESEND_API_KEY` | `health-check`, `http-monitor` (envoi des alertes e-mail) |

Détail de la configuration OAuth : voir `OAUTH_SETUP.md`.

## Scripts

| Commande | Effet |
|----------|-------|
| `pnpm dev` | Serveur de dev Vite |
| `pnpm build` | `tsc -b` puis `vite build` |
| `pnpm preview` | Prévisualise le build |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest, run unique |
| `pnpm test:watch` | Vitest en watch |
| `pnpm test:coverage` | Couverture V8 (`text` + `lcov`) |

## Structure

```
src/
├── App.tsx              # Routes (lazy-loaded) + QueryClient + OrgProvider
├── main.tsx
├── lib/
│   ├── supabase.ts      # Client Supabase (valide les env vars au boot)
│   └── utils.ts
├── pages/               # 16 pages
├── services/            # 14 services — seul point d'accès à Supabase
├── hooks/               # 14 hooks React Query (un par service)
├── components/
│   ├── features/        # dashboard, integrations, projects
│   ├── layout/          # Layout, Sidebar, OrgSwitcher
│   └── ui/              # primitives Radix / shadcn-like
├── contexts/
│   └── OrgContext.tsx   # organisation courante
├── types/index.ts
└── test/                # setup + tests (services, hooks, composants)

supabase/
├── functions/           # 7 Edge Functions (Deno)
└── migrations/          # 11 migrations SQL
```

L'alias `@` pointe vers `src/` (`vite.config.ts`).

### Routes

Publiques : `/` (Landing), `/login`, `/auth/callback`, `/status/:slug`, `/onboarding`.
Sous `Layout` : `/dashboard`, `/projects`, `/monitors`, `/status-pages`, `/settings`, `/account`, `/billing`, `/ux-audits`, `/dev-tools`, `/accessibility`, `/style-guard`.
Toute route inconnue redirige vers `/dashboard`.

## Fonctionnalités

- **Projets & health checks** — chaque projet référence un repo GitHub, un projet GitLab, un projet Vercel et/ou une zone / un Worker Cloudflare. L'Edge Function `health-check` interroge les APIs et enregistre le résultat dans `health_checks`.
- **Monitors HTTP** — surveillance d'URLs avec statut attendu et intervalle (`http_monitors`). L'Edge Function `http-monitor` vérifie les endpoints et envoie les alertes (Slack, Discord, e-mail via Resend) lors des passages down / up.
- **Status pages** — pages publiques exposant projets et monitors sélectionnés, accessibles via `/status/:slug` sans authentification.
- **Intégrations** — GitHub, GitLab et Vercel se connectent en OAuth (échange de code côté serveur dans `oauth-callback` / `vercel-exchange`) ; Cloudflare utilise un token API saisi manuellement. `list-resources` liste les ressources distantes par provider.
- **Organisations** — multi-org avec membres, rôles et invitations ; sélection de l'org courante via `OrgSwitcher`.
- **Facturation** — plans `free`, `solo` (900), `agency` (2900) définis en base (`plans`, valeurs en centimes / mois, `-1` = illimité) avec quotas projets / monitors / status pages / membres. Checkout via `create-checkout-session`, synchronisation via `stripe-webhook`.
- **Audits UX** — `scanUrl` analyse une page à la recherche de dark patterns (options pré-cochées, etc.), chaque motif étant rattaché à une référence réglementaire RGPD ou DSA, avec un score de sévérité.
- **Audits d'accessibilité** — `scanAccessibility` récupère le HTML via un proxy public (`api.allorigins.win`), le parse avec `DOMParser` et applique des règles WCAG côté client.
- **Style Guard** — `analyzeStyle` vérifie un contenu contre des chartes éditoriales configurables (`style_guides`, `style_checks`).
- **Dev tools** — snippets de code, templates de PR, génération de markdown de PR / messages de commit, formatage JSON, encodage Base64.
- **Notifications** — préférences par utilisateur : e-mail (échec, rétablissement, résumé quotidien), webhooks Slack et Discord.

## Supabase

### Edge Functions (`supabase/functions/`)

| Fonction | Rôle |
|----------|------|
| `health-check` | Interroge GitHub / GitLab / Vercel / Cloudflare et enregistre l'état des projets |
| `http-monitor` | Vérifie les monitors HTTP et déclenche les alertes |
| `oauth-callback` | Échange le code OAuth (GitHub, GitLab, Vercel) contre un access token |
| `vercel-exchange` | Échange le code de l'intégration Vercel |
| `list-resources` | Liste les ressources distantes d'un provider |
| `create-checkout-session` | Crée une session Stripe Checkout |
| `stripe-webhook` | Traite les webhooks Stripe (vérification de signature) |

Déploiement : `supabase functions deploy <nom>`.

### Migrations (`supabase/migrations/`)

11 migrations, de `001_initial.sql` à `011_fix_overall_status.sql` : schéma initial, cron, fonctionnalités (monitors, notifications, status pages), organisations, abonnements, onboarding, correctifs RLS, extensions, audits accessibilité / style.

Tables principales : `profiles`, `projects`, `health_checks`, `linked_accounts`, `http_monitors`, `notification_settings`, `status_pages`, `organizations`, `organization_members`, `invitations`, `plans`, `subscriptions`, `ux_audits`, `accessibility_audits`, `style_guides`, `style_checks`, `code_snippets`, `pr_templates`. RLS activée.

### Cron

`002_cron.sql` planifie un health check quotidien à 06:00 (`0 6 * * *`) via `pg_cron` + `pg_net`, en appelant l'Edge Function `health-check` avec `{"run_all": true}`.

Ce fichier n'est pas exécutable tel quel : il faut activer les extensions `pg_cron` et `pg_net` dans le dashboard Supabase et remplacer `<SERVICE_ROLE_KEY>` avant de le lancer dans le SQL Editor.

## Déploiement

Déployé sur Vercel. `vercel.json` définit :

- un rewrite SPA de `/(.*)` vers `/index.html` ;
- des en-têtes de sécurité : `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy` et une `Content-Security-Policy` dont `connect-src` / `img-src` autorisent explicitement le domaine du projet Supabase.

> La CSP contient l'URL du projet Supabase en dur : elle doit être mise à jour si le projet Supabase change.

Les sourcemaps sont désactivées en build (`vite.config.ts`).

## CI

`.github/workflows/ci.yml` s'exécute sur `main` et `develop` (push + PR) : install pnpm, lint, `tsc --noEmit`, puis build avec des valeurs d'environnement factices. La CI ne lance pas les tests.
