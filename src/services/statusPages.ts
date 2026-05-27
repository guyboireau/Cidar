import { supabase } from '@/lib/supabase'
import type { StatusPage, ProjectRow, HttpMonitor } from '@/types'

async function assertStatusPageOwner(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non authentifié')

  const { data: page } = await supabase
    .from('status_pages')
    .select('user_id')
    .eq('id', id)
    .single()

  if (!page) throw new Error('Status page introuvable')
  if (page.user_id !== user.id) throw new Error('Accès interdit')
}

export async function getPublicProjects(projectIds: string[]): Promise<ProjectRow[]> {
  const { data } = await supabase
    .from('projects_with_latest_check')
    .select('*')
    .in('id', projectIds)
  return (data ?? []) as ProjectRow[]
}

export async function getPublicMonitors(monitorIds: string[]): Promise<HttpMonitor[]> {
  const { data } = await supabase
    .from('http_monitors')
    .select('id, name, url, public_name, last_status, last_checked_at, last_response_ms')
    .in('id', monitorIds)
  return (data ?? []) as HttpMonitor[]
}

export async function getStatusPages(userId: string): Promise<StatusPage[]> {
  const { data, error } = await supabase
    .from('status_pages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getPublicStatusPage(slug: string): Promise<StatusPage | null> {
  const { data } = await supabase
    .from('status_pages')
    .select('*')
    .eq('slug', slug)
    .eq('is_public', true)
    .single()
  return data
}

export async function createStatusPage(
  userId: string,
  page: Pick<StatusPage, 'slug' | 'title' | 'description' | 'project_ids' | 'http_monitor_ids'>
): Promise<StatusPage> {
  const { data, error } = await supabase
    .from('status_pages')
    .insert({ ...page, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateStatusPage(id: string, updates: Partial<StatusPage>): Promise<StatusPage> {
  await assertStatusPageOwner(id)
  const { data, error } = await supabase
    .from('status_pages')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteStatusPage(id: string): Promise<void> {
  await assertStatusPageOwner(id)
  const { error } = await supabase.from('status_pages').delete().eq('id', id)
  if (error) throw error
}
