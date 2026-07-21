// Pilotage des workflows GitHub Actions depuis l'UI.
//
// Trois actions : `dispatch` (déclencher maintenant), `toggle` (activer/désactiver
// le cron chez GitHub), `sync` (rapatrier l'historique des runs).
//
// Le token GitHub ne quitte jamais le serveur : il est lu dans linked_accounts
// avec la service_role, jamais renvoyé au client. Le flux OAuth demande déjà
// `scope=repo workflow` (src/pages/Settings.tsx), qui couvre workflow_dispatch
// et l'activation/désactivation.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const GH = 'https://api.github.com'
const ghHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
})

type Action = 'dispatch' | 'toggle' | 'sync'

interface Routine {
  id: string
  user_id: string
  github_owner: string
  github_repo: string
  workflow_file: string
  enabled: boolean
}

function mapRunStatus(conclusion: string | null, status: string): string {
  if (status === 'in_progress' || status === 'queued' || status === 'waiting') return 'running'
  if (conclusion === 'success') return 'success'
  if (conclusion === 'failure' || conclusion === 'timed_out') return 'failure'
  if (conclusion === 'cancelled' || conclusion === 'skipped') return 'cancelled'
  return 'unknown'
}

// Branche par défaut du repo — workflow_dispatch l'exige et elle n'est pas
// toujours "main" (certains repos sont encore sur "master").
async function defaultBranch(routine: Routine, token: string): Promise<string> {
  const res = await fetch(`${GH}/repos/${routine.github_owner}/${routine.github_repo}`, {
    headers: ghHeaders(token),
  })
  if (!res.ok) throw new Error(`GitHub repos GET ${res.status}`)
  const repo = await res.json()
  return repo.default_branch ?? 'main'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(token)
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const body = await req.json().catch(() => ({}))
    const action = (body.action ?? 'dispatch') as Action
    const routineId = body.routine_id as string | undefined
    if (!routineId) return json({ error: 'routine_id requis' }, 400)

    // Lecture de la routine EN FILTRANT SUR user_id : la service_role court-circuite
    // le RLS, c'est donc à nous de vérifier que l'appelant possède bien la routine.
    const { data: routine, error: routineErr } = await supabase
      .from('cron_routines')
      .select('id, user_id, github_owner, github_repo, workflow_file, enabled')
      .eq('id', routineId)
      .eq('user_id', user.id)
      .single<Routine>()

    if (routineErr || !routine) return json({ error: 'Routine introuvable' }, 404)

    const { data: account } = await supabase
      .from('linked_accounts')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('provider', 'github')
      .single()

    if (!account?.access_token) return json({ error: 'Compte GitHub non connecté' }, 400)
    const ghToken = account.access_token as string

    const base = `${GH}/repos/${routine.github_owner}/${routine.github_repo}/actions/workflows/${routine.workflow_file}`

    // ── dispatch ────────────────────────────────────────────────────────────
    if (action === 'dispatch') {
      const ref = body.ref ?? (await defaultBranch(routine, ghToken))

      const res = await fetch(`${base}/dispatches`, {
        method: 'POST',
        headers: { ...ghHeaders(ghToken), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref }),
      })

      // 204 = accepté. GitHub ne renvoie pas l'id du run : il n'existe pas encore.
      // On enregistre un run 'pending' que `sync` rapprochera ensuite.
      if (res.status !== 204) {
        const detail = await res.text()
        return json({ error: `GitHub dispatch ${res.status}`, detail }, 502)
      }

      const { data: run } = await supabase
        .from('cron_runs')
        .insert({
          routine_id: routine.id,
          user_id: user.id,
          trigger_source: 'manual',
          status: 'pending',
          data: { ref },
        })
        .select()
        .single()

      await supabase
        .from('cron_routines')
        .update({ last_run_at: new Date().toISOString(), last_run_status: 'pending' })
        .eq('id', routine.id)

      return json({ ok: true, run })
    }

    // ── toggle ──────────────────────────────────────────────────────────────
    // Désactive le cron chez GitHub plutôt qu'en base : le run ne part pas du tout,
    // au lieu de démarrer pour sortir aussitôt. La colonne `enabled` suit en miroir.
    if (action === 'toggle') {
      const enabled = Boolean(body.enabled)
      const res = await fetch(`${base}/${enabled ? 'enable' : 'disable'}`, {
        method: 'PUT',
        headers: ghHeaders(ghToken),
      })

      if (res.status !== 204) {
        const detail = await res.text()
        return json({ error: `GitHub ${enabled ? 'enable' : 'disable'} ${res.status}`, detail }, 502)
      }

      await supabase.from('cron_routines').update({ enabled }).eq('id', routine.id)
      return json({ ok: true, enabled })
    }

    // ── sync ────────────────────────────────────────────────────────────────
    if (action === 'sync') {
      const res = await fetch(`${base}/runs?per_page=20`, { headers: ghHeaders(ghToken) })
      if (!res.ok) {
        const detail = await res.text()
        return json({ error: `GitHub runs ${res.status}`, detail }, 502)
      }

      const data = await res.json()
      const runs = (data.workflow_runs ?? []) as Array<{
        id: number
        conclusion: string | null
        status: string
        html_url: string
        run_started_at: string
        updated_at: string
        event: string
      }>

      if (runs.length) {
        // upsert sur github_run_id : `sync` est idempotent, on peut le rejouer.
        await supabase.from('cron_runs').upsert(
          runs.map((r) => ({
            routine_id: routine.id,
            user_id: user.id,
            github_run_id: r.id,
            trigger_source: r.event === 'workflow_dispatch' ? 'manual' : 'scheduled',
            status: mapRunStatus(r.conclusion, r.status),
            html_url: r.html_url,
            started_at: r.run_started_at,
            finished_at: r.status === 'completed' ? r.updated_at : null,
            data: { event: r.event, conclusion: r.conclusion },
          })),
          { onConflict: 'github_run_id' }
        )

        const latest = runs[0]
        await supabase
          .from('cron_routines')
          .update({
            last_run_at: latest.run_started_at,
            last_run_status: mapRunStatus(latest.conclusion, latest.status),
            last_run_url: latest.html_url,
          })
          .eq('id', routine.id)

        // Purge des 'pending' rattrapés par la réalité. Un dispatch insère une ligne
        // sans github_run_id (GitHub ne le renvoie pas) ; dès qu'un vrai run apparaît
        // à la même période, ce placeholder n'a plus de raison d'être — sans ça il
        // resterait « en attente » indéfiniment dans l'historique.
        await supabase
          .from('cron_runs')
          .delete()
          .eq('routine_id', routine.id)
          .is('github_run_id', null)
          .lte('started_at', latest.run_started_at)
      }

      return json({ ok: true, synced: runs.length })
    }

    return json({ error: `Action inconnue : ${action}` }, 400)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
