# Cidar

> Cidar est le nom du dépôt GitHub et celui qu'affiche l'interface, sauf la
> page Routines qui dit encore « Vigilo ». `vigilo`, le nom d'origine du
> projet, reste celui du `package.json`.

Tableau de bord de supervision pour projets web : santé applicative, monitoring
d'uptime, pages de statut publiques, audits (accessibilité, UX, style) et
pilotage de routines automatisées (agents GitHub Actions). Multi-organisations,
facturation Stripe intégrée.

## Stack

| Domaine       | Techno                                                        |
|---------------|---------------------------------------------------------------|
| Framework     | React 19 + Vite 8 (SPA)                                        |
| Langage       | TypeScript (strict)                                            |
| UI            | Tailwind CSS 4 + Radix UI + lucide-react + sonner (toasts)     |
| Data / cache  | @tanstack/react-query                                          |
| Formulaires   | react-hook-form + Zod                                          |
| Routing       | react-router-dom                                              |
| Backend       | Supabase (PostgreSQL, Auth, RLS, Edge Functions)              |
| Paiement      | Stripe (via Edge Functions)                                   |
| Tests         | Vitest + Testing Library (jsdom)                              |
| Déploiement   | Vercel (production figée depuis mai, voir plus bas)           |

Gestionnaire de paquets : **pnpm** (`packageManager: pnpm@10.33.2`). La version
est fixée par le champ `packageManager` — ne pas la redéclarer dans la CI.

## Fonctionnalités

- **Dashboard** — vue agrégée de l'état des projets suivis.
- **Health checks & monitors** — sondes HTTP, historique de disponibilité.
- **Status pages** — pages de statut publiques par projet.
- **Audits** — accessibilité, UX et garde de style (style guard).
- **Cron routines** — pilotage de workflows / agents GitHub Actions depuis l'app.
- **Intégrations** — GitHub, GitLab, Vercel, Cloudflare (OAuth).
- **Organisations** — espaces multi-utilisateurs avec rôles.
- **Billing** — abonnements Stripe (checkout + webhook).

## Structure

```
src/
├── components/   # ui/ (Radix + primitives), layout/, features/
├── contexts/     # OrgContext (organisation courante), Auth
├── hooks/        # hooks data (react-query) par domaine
├── lib/          # client Supabase, utilitaires
├── pages/        # une page par route (Dashboard, Monitors, StatusPages…)
├── services/     # accès données par domaine (health, monitors, billing…)
├── types/        # types partagés
└── test/         # tests co-localisés par dossier

supabase/
├── migrations/   # schéma versionné (001 → 012)
└── functions/    # Edge Functions (health-check, http-monitor,
                  #   dispatch-workflow, stripe-webhook, oauth-callback…)
```

## Variables d'environnement

Copier `.env.example` vers `.env` et renseigner :

```bash
# Supabase (Settings > API)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# OAuth frontend (public, embarqué dans le build)
VITE_GITHUB_CLIENT_ID=
VITE_GITLAB_CLIENT_ID=
```

`VITE_VERCEL_CLIENT_ID`, encore présente dans `.env.example`, n'est lue nulle
part : côté front, Vercel passe par la page d'installation de l'intégration
(`src/pages/Settings.tsx`).

Les secrets serveur (clés Stripe, service role Supabase, secrets OAuth) sont
configurés côté Supabase Edge Functions / Vercel, jamais préfixés `VITE_`.

Secrets des Edge Functions, configurés côté Supabase (`supabase secrets set`),
jamais dans `.env` — relevés dans les `Deno.env.get` de `supabase/functions/` :

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
| `RESEND_API_KEY` | `health-check`, `http-monitor` (alertes e-mail) |

> Le client Supabase (`src/lib/supabase.ts`) **lève une erreur au chargement**
> si `VITE_SUPABASE_URL` ou `VITE_SUPABASE_ANON_KEY` manquent. En test, ces
> valeurs mock (`https://mock-url.supabase.co` / `mock-anon-key`) sont fournies
> par `test.env` dans `vite.config.ts` : aucun `.env` n'est nécessaire pour
> lancer la suite, et un test ne peut pas viser une vraie instance Supabase.

## Commandes

```bash
pnpm install          # Installer les dépendances
pnpm dev              # Serveur de développement (Vite)
pnpm build            # Build production (tsc -b && vite build)
pnpm preview          # Prévisualiser le build
pnpm lint             # ESLint
pnpm test             # Vitest (run unique)
pnpm test:watch       # Vitest (watch)
pnpm test:coverage    # Vitest + couverture
```

`pnpm test` fonctionne tel quel sur un clone neuf : aucune variable
d'environnement à exporter.

## CI / Déploiement

- **CI** (GitHub Actions) : lint → type-check → build → tests, sur Node 22.
  Les `VITE_SUPABASE_*` mock sont injectées à l'étape de build (Vite les
  substitue à la compilation) ; l'étape de test les tient de `test.env`.
- **Déploiement** : Vercel exécute le script `build` du `package.json`
  (`vercel.json` n'override pas la commande de build).
- **État au 23 septembre 2026** : la production n'est plus mise à jour. Son
  dernier déploiement date du 6 mai 2026 (`a8cbcb1`) ; aucun des commits
  poussés sur `main` depuis n'a été déployé en production.
