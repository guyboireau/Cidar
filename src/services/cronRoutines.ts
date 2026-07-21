import { supabase } from '@/lib/supabase'
import type { CronRoutine, CronRun } from '@/types'

// Même défense en profondeur que monitors.ts : le RLS protège déjà en base, mais
// on refuse aussi côté applicatif — une policy mal écrite ne doit pas suffire.
async function assertRoutineOwner(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const { data: routine } = await supabase
    .from('cron_routines')
    .select('user_id, org_id')
    .eq('id', id)
    .single()

  if (!routine) throw new Error('Routine introuvable')
  if (routine.user_id === user.id) return

  if (routine.org_id) {
    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('org_id', routine.org_id)
      .eq('user_id', user.id)
      .single()
    if (member) return

    const { data: org } = await supabase
      .from('organizations')
      .select('owner_id')
      .eq('id', routine.org_id)
      .single()
    if (org?.owner_id === user.id) return
  }

  throw new Error('Accès interdit')
}

export async function getRoutines(userId: string): Promise<CronRoutine[]> {
  const { data, error } = await supabase
    .from('cron_routines')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getRuns(routineId: string, limit = 20): Promise<CronRun[]> {
  const { data, error } = await supabase
    .from('cron_runs')
    .select('*')
    .eq('routine_id', routineId)
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function createRoutine(
  userId: string,
  routine: Pick<
    CronRoutine,
    'name' | 'description' | 'github_owner' | 'github_repo' | 'workflow_file' | 'cron_expression' | 'org_id'
  >
): Promise<CronRoutine> {
  const { data, error } = await supabase
    .from('cron_routines')
    .insert({ ...routine, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateRoutine(id: string, updates: Partial<CronRoutine>): Promise<CronRoutine> {
  await assertRoutineOwner(id)
  const { data, error } = await supabase
    .from('cron_routines')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteRoutine(id: string): Promise<void> {
  await assertRoutineOwner(id)
  const { error } = await supabase.from('cron_routines').delete().eq('id', id)
  if (error) throw error
}

// --- Actions passant par l'Edge Function ------------------------------------
//
// Tout ce qui touche à GitHub passe par la fonction serveur : le token vit dans
// linked_accounts et ne doit jamais atteindre le navigateur.

async function callDispatchFn<T>(body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Non authentifié')

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dispatch-workflow`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(payload.error ?? `Échec (${res.status})`)
  return payload as T
}

export async function triggerRoutine(routineId: string): Promise<{ run: CronRun }> {
  return callDispatchFn({ action: 'dispatch', routine_id: routineId })
}

// Active/désactive le cron CHEZ GITHUB, pas seulement en base : sinon le run part
// quand même chaque matin pour sortir aussitôt, et pollue l'historique Actions.
export async function toggleRoutine(routineId: string, enabled: boolean): Promise<void> {
  await callDispatchFn({ action: 'toggle', routine_id: routineId, enabled })
}

export async function syncRoutine(routineId: string): Promise<{ synced: number }> {
  return callDispatchFn({ action: 'sync', routine_id: routineId })
}
