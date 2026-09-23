# Configuration OAuth — Cidar

## Vue d'ensemble

GitHub, GitLab et Vercel utilisent désormais l'**OAuth 2.0** — zéro token à copier-coller.
Cloudflare reste en token manuel (pas d'OAuth public).

| Provider | Méthode | Action utilisateur |
|----------|---------|-------------------|
| GitHub | OAuth 2.0 | Cliquer "Connecter" → autoriser sur GitHub → retour automatique |
| GitLab | OAuth 2.0 | Cliquer "Connecter" → autoriser sur GitLab → retour automatique |
| Vercel | OAuth 2.0 | Cliquer "Connecter" → autoriser sur Vercel → retour automatique |
| Cloudflare | Token manuel | Coller un API Token dans le dialog |

---

## 1. Créer les OAuth Apps

### GitHub OAuth App

1. Aller sur https://github.com/settings/developers
2. Cliquer **New OAuth App**
3. Remplir :
   - **Application name** : `Cidar`
   - **Homepage URL** : `https://votre-app.vercel.app` (ou `http://localhost:5173` en dev)
   - **Authorization callback URL** : `https://glvdyenokrgfzrdlgcvz.supabase.co/functions/v1/oauth-callback`
4. Générer un **Client Secret**
5. Récupérer **Client ID** et **Client Secret**

### GitLab Application

1. Aller sur https://gitlab.com/-/profile/applications
2. Cliquer **Add new application**
3. Remplir :
   - **Name** : `Cidar`
   - **Redirect URI** : `https://glvdyenokrgfzrdlgcvz.supabase.co/functions/v1/oauth-callback`
   - **Scopes** : cocher `read_api`
4. Récupérer **Application ID** (= Client ID) et **Secret** (= Client Secret)

### Vercel Integration

1. Aller sur https://vercel.com/dashboard/integrations
2. Créer une nouvelle integration
3. Configurer le **Redirect URL** : `https://glvdyenokrgfzrdlgcvz.supabase.co/functions/v1/oauth-callback`
4. Récupérer **Client ID** et **Client Secret**

---

## 2. Configurer les variables d'environnement

### Frontend (`.env`)

Ces variables sont publiques (préfixées `VITE_`) et embarquées dans le build :

```bash
VITE_GITHUB_CLIENT_ID=xxx
VITE_GITLAB_CLIENT_ID=xxx
```

Vercel n'a pas de variable côté front : le bouton « Connecter » renvoie vers la page d'installation de l'intégration (`src/pages/Settings.tsx`).

### Edge Functions Secrets (Supabase Dashboard)

Ces variables sont secrètes et utilisées côté serveur uniquement :

Dans Supabase Dashboard → Project Settings → Edge Functions → Secrets, ajouter :

```
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
GITLAB_CLIENT_ID=xxx
GITLAB_CLIENT_SECRET=xxx
VERCEL_CLIENT_ID=xxx
VERCEL_CLIENT_SECRET=xxx
APP_URL=https://votre-app.vercel.app   # ou http://localhost:5173 en dev
```

**Ne jamais** mettre les `*_CLIENT_SECRET` dans le `.env` frontend — ils seraient exposés dans le bundle JavaScript.

---

## 3. Déployer l'Edge Function

```bash
supabase functions deploy oauth-callback
```

---

## 4. Flow OAuth (récap technique)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Frontend  │────►│  Provider    │────►│ Edge Function   │
│  Settings   │     │  (GitHub/    │     │ oauth-callback  │
│  Bouton     │     │  GitLab/     │     │                 │
│  "Connecter"│     │  Vercel)     │     │ Échange code    │
└─────────────┘     └──────────────┘     │ → access_token  │
                                         │ → stocke token  │
                                         │ → redirect /settings│
                                         └─────────────────┘
```

1. L'utilisateur clique "Connecter GitHub" dans Settings
2. Le frontend redirige vers l'URL d'autorisation du provider avec `state=user_id`
3. L'utilisateur autorise l'app sur le provider
4. Le provider redirige vers `oauth-callback` avec un `code`
5. L'Edge Function échange le `code` contre un `access_token`
6. L'Edge Function récupère le username via l'API du provider
7. L'Edge Function upsert le token dans `linked_accounts`
8. Redirection vers `/settings?connected=github`
9. Le frontend affiche un toast de succès

---

## 5. Dépannage

| Problème | Cause probable | Solution |
|----------|---------------|----------|
| `Invalid state` | L'user_id dans `state` n'existe pas | Vérifier que l'utilisateur est bien connecté avant de lancer OAuth |
| `No access_token` | Le code a déjà été utilisé ou est expiré | Le code OAuth est à usage unique — relancer le flow |
| Redirect loop | Le callback URL ne correspond pas | Vérifier que l'URL dans l'OAuth App correspond exactement à l'URL Supabase |
| `Unsupported provider` | Paramètre `provider` invalide | Vérifier que le provider est bien `github`, `gitlab` ou `vercel` |

---

## 6. Sécurité

- Les `CLIENT_SECRET` ne transitent **jamais** par le navigateur
- Le `state` paramètre contient le `user_id` et est vérifié côté serveur
- Les tokens sont stockés chiffrés dans Supabase (`linked_accounts`)
- Les tokens ne sont **jamais** renvoyés au frontend
