# Vigilo

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
| Déploiement   | Vercel                                                        |

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
VITE_VERCEL_CLIENT_ID=
```

Les secrets serveur (clés Stripe, service role Supabase, secrets OAuth) sont
configurés côté Supabase Edge Functions / Vercel, jamais préfixés `VITE_`.

> Le client Supabase (`src/lib/supabase.ts`) **lève une erreur au chargement**
> si `VITE_SUPABASE_URL` ou `VITE_SUPABASE_ANON_KEY` manquent. En test, la CI
> fournit des valeurs mock (`https://mock-url.supabase.co` / `mock-anon-key`).

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

Pour lancer les tests en local sans base réelle, fournir les valeurs mock :

```bash
VITE_SUPABASE_URL=https://mock-url.supabase.co \
VITE_SUPABASE_ANON_KEY=mock-anon-key \
pnpm test
```

## CI / Déploiement

- **CI** (GitHub Actions) : lint → type-check → build → tests, avec des
  `VITE_SUPABASE_*` mock injectées à l'étape de test.
- **Déploiement** : Vercel exécute le script `build` du `package.json`
  (`vercel.json` n'override pas la commande de build).
