import { supabase } from '@/lib/supabase'
import type { Organization, OrgMember, Invitation, OrgRole, OrgWithPlan } from '@/types'

async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Non authentifié')
  return user
}

const ROLE_HIERARCHY: Record<OrgRole, number> = { owner: 3, admin: 2, member: 1 }

async function assertOrgAccess(orgId: string, minRole: OrgRole = 'member'): Promise<void> {
  const user = await getCurrentUser()

  // Ownership bypasses role checks
  const { data: org } = await supabase
    .from('organizations')
    .select('owner_id')
    .eq('id', orgId)
    .single()
  if (org?.owner_id === user.id) return

  const { data: member } = await supabase
    .from('organization_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (member && ROLE_HIERARCHY[member.role as OrgRole] >= ROLE_HIERARCHY[minRole]) return
  throw new Error('Accès interdit')
}

export async function getUserOrgs(userId: string): Promise<OrgWithPlan[]> {
  // Fetch owned orgs
  const { data: owned, error: ownedErr } = await supabase
    .from('org_with_plan')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })
  if (ownedErr) throw ownedErr

  // Fetch member org IDs (own row only — avoids recursive RLS)
  const { data: memberships } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', userId)

  const memberOrgIds = (memberships ?? []).map(r => r.org_id)
  const ownedIds = new Set((owned ?? []).map(o => o.id))
  const nonOwnedIds = memberOrgIds.filter(id => !ownedIds.has(id))

  if (nonOwnedIds.length === 0) return (owned ?? []) as OrgWithPlan[]

  const { data: memberOrgs, error: memberErr } = await supabase
    .from('org_with_plan')
    .select('*')
    .in('id', nonOwnedIds)
    .order('created_at', { ascending: true })
  if (memberErr) throw memberErr

  return [...(owned ?? []), ...(memberOrgs ?? [])] as OrgWithPlan[]
}

export async function getOrg(orgId: string): Promise<OrgWithPlan> {
  await assertOrgAccess(orgId, 'member')
  const { data, error } = await supabase
    .from('org_with_plan')
    .select('*')
    .eq('id', orgId)
    .single()
  if (error) throw error
  return data as OrgWithPlan
}

export async function createOrg(name: string, ownerId: string): Promise<Organization> {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)

  const { data, error } = await supabase
    .from('organizations')
    .insert({ name, slug, owner_id: ownerId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateOrg(orgId: string, updates: { name?: string }): Promise<Organization> {
  await assertOrgAccess(orgId, 'admin')
  const { data, error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', orgId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function setCurrentOrg(userId: string, orgId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ current_org_id: orgId })
    .eq('id', userId)
  if (error) throw error
}

// Members

export async function getOrgMembers(orgId: string): Promise<OrgMember[]> {
  await assertOrgAccess(orgId, 'member')
  const { data, error } = await supabase
    .from('organization_members')
    .select('*, profiles(name, email, avatar_url)')
    .eq('org_id', orgId)
    .order('joined_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as OrgMember[]
}

export async function removeMember(orgId: string, userId: string): Promise<void> {
  await assertOrgAccess(orgId, 'admin')
  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('org_id', orgId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function updateMemberRole(orgId: string, userId: string, role: OrgRole): Promise<void> {
  await assertOrgAccess(orgId, 'admin')
  const { error } = await supabase
    .from('organization_members')
    .update({ role })
    .eq('org_id', orgId)
    .eq('user_id', userId)
  if (error) throw error
}

// Invitations

export async function getInvitations(orgId: string): Promise<Invitation[]> {
  await assertOrgAccess(orgId, 'admin')
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('org_id', orgId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Invitation[]
}

export async function inviteMember(
  orgId: string,
  email: string,
  role: 'admin' | 'member',
  invitedBy: string
): Promise<Invitation> {
  await assertOrgAccess(orgId, 'admin')
  const token = crypto.randomUUID()
  const { data, error } = await supabase
    .from('invitations')
    .insert({ org_id: orgId, email, role, invited_by: invitedBy, token })
    .select()
    .single()
  if (error) throw error
  return data as Invitation
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  await getCurrentUser()
  const { data: invitation } = await supabase
    .from('invitations')
    .select('org_id')
    .eq('id', invitationId)
    .single()
  if (!invitation) throw new Error('Invitation introuvable')
  await assertOrgAccess(invitation.org_id, 'admin')
  const { error } = await supabase
    .from('invitations')
    .delete()
    .eq('id', invitationId)
  if (error) throw error
}

export async function acceptInvitation(token: string): Promise<{ org_id: string }> {
  const user = await getCurrentUser()

  const { data: invitation, error: fetchError } = await supabase
    .from('invitations')
    .select('*')
    .eq('token', token)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (fetchError || !invitation) throw new Error('Invitation invalide ou expirée')

  // Verify the accepting user matches the invited email
  if (invitation.email !== user.email) {
    throw new Error("Cette invitation ne vous est pas destinée")
  }

  // Add member
  const { error: memberError } = await supabase
    .from('organization_members')
    .upsert({ org_id: invitation.org_id, user_id: user.id, role: invitation.role }, { onConflict: 'org_id,user_id' })
  if (memberError) throw memberError

  // Mark accepted
  await supabase
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitation.id)

  return { org_id: invitation.org_id }
}
