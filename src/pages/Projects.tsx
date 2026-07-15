import { useState, useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, FolderGit2, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ResourceSelect } from '@/components/ui/resource-select'
import { useSession } from '@/hooks/useAuth'
import { useProjectsWithHealth, useCreateProject, useUpdateProject, useDeleteProject } from '@/hooks/useProjects'
import { useTriggerHealthCheck } from '@/hooks/useHealth'
import { useLinkedAccounts } from '@/hooks/useIntegrations'
import { useGithubRepos, useGitlabProjects, useVercelProjects, useCloudflareResources } from '@/hooks/useResources'
import StatusBadge from '@/components/features/dashboard/StatusBadge'
import type { HealthStatus, Project, ProjectRow } from '@/types'

const schema = z.object({
  name: z.string().min(1, 'Nom requis'),
  github_repo: z.string().optional(),
  gitlab_project: z.string().optional(),
  vercel_project_id: z.string().optional(),
  cloudflare_worker_name: z.string().optional(),
  cloudflare_zone_id: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function Projects() {
  const session = useSession()
  const userId = session?.user?.id ?? ''
  const { data: projects = [], isLoading } = useProjectsWithHealth(userId)
  const { data: accounts = [] } = useLinkedAccounts(userId)
  const createProject = useCreateProject(userId)
  const updateProject = useUpdateProject(userId)
  const deleteProject = useDeleteProject(userId)
  const triggerCheck = useTriggerHealthCheck(userId)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const isConnected = useCallback((p: string) => accounts.some(a => a.provider === p), [accounts])

  const { data: githubRepos = [], isLoading: githubLoading } = useGithubRepos(dialogOpen && isConnected('github'))
  const { data: gitlabProjects = [], isLoading: gitlabLoading } = useGitlabProjects(dialogOpen && isConnected('gitlab'))
  const { data: vercelProjects = [], isLoading: vercelLoading } = useVercelProjects(dialogOpen && isConnected('vercel'))
  const { data: cfResources, isLoading: cfLoading } = useCloudflareResources(dialogOpen && isConnected('cloudflare'))

  const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  function openCreate() {
    setEditingProject(null)
    reset({})
    setDialogOpen(true)
  }

  function openEdit(p: Project) {
    setEditingProject(p)
    reset({
      name: p.name,
      github_repo: p.github_repo ? `${p.github_owner}/${p.github_repo}` : '',
      gitlab_project: p.gitlab_project ? `${p.gitlab_namespace}/${p.gitlab_project}` : '',
      vercel_project_id: p.vercel_project_id ?? '',
      cloudflare_worker_name: p.cloudflare_worker_name ?? '',
      cloudflare_zone_id: p.cloudflare_zone_id ?? '',
    })
    setDialogOpen(true)
  }

  async function onSubmit(data: FormData) {
    const [ghOwner, ghRepo] = (data.github_repo ?? '').split('/')
    const [glNamespace, glProject] = (data.gitlab_project ?? '').split('/')

    const payload = {
      name: data.name,
      github_owner: ghOwner || null,
      github_repo: ghRepo || null,
      gitlab_namespace: glNamespace || null,
      gitlab_project: glProject || null,
      vercel_project_id: data.vercel_project_id || null,
      cloudflare_worker_name: data.cloudflare_worker_name || null,
      cloudflare_zone_id: data.cloudflare_zone_id || null,
    }

    if (editingProject) {
      await updateProject.mutateAsync({ id: editingProject.id, updates: payload })
    } else {
      const created = await createProject.mutateAsync(payload)
      if (created?.id) triggerCheck.mutate(created.id)
    }
    setDialogOpen(false)
    reset({})
  }

  const githubOptions = githubRepos.map(r => ({ label: r.label, value: `${r.owner}/${r.repo}` }))
  const gitlabOptions = gitlabProjects.map(p => ({ label: p.label, value: `${p.namespace}/${p.project}` }))
  const vercelOptions = vercelProjects.map(p => ({ label: p.label, value: p.id }))
  const workerOptions = (cfResources?.workers ?? []).map(w => ({ label: w.label, value: w.id }))
  const zoneOptions = (cfResources?.zones ?? []).map(z => ({ label: z.label, value: z.id }))

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Projets</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Gérez les projets à surveiller</p>
        </div>
        <Button size="sm" className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouveau projet
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg border bg-card animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-16 text-center">
          <FolderGit2 className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium">Aucun projet</p>
          <p className="text-xs text-muted-foreground mt-1">Créez votre premier projet à surveiller</p>
          <Button size="sm" className="mt-4 gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouveau projet
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Projet</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Services</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(projects as ProjectRow[]).map((p) => (
                <tr key={p.id} className="bg-card hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                      {p.github_repo && <span className="bg-muted px-1.5 py-0.5 rounded">{p.github_owner}/{p.github_repo}</span>}
                      {p.gitlab_project && <span className="bg-muted px-1.5 py-0.5 rounded">GL: {p.gitlab_namespace}/{p.gitlab_project}</span>}
                      {p.vercel_project_id && <span className="bg-muted px-1.5 py-0.5 rounded">▲ {p.vercel_project_id}</span>}
                      {p.cloudflare_worker_name && <span className="bg-muted px-1.5 py-0.5 rounded">CF: {p.cloudflare_worker_name}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={(p.overall_status as HealthStatus) ?? 'unknown'} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p as Project)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(p.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProject ? 'Modifier le projet' : 'Nouveau projet'}</DialogTitle>
            <DialogDescription>
              Sélectionnez les services à surveiller depuis vos comptes connectés.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nom du projet *</Label>
              <Controller name="name" control={control} render={({ field }) => (
                <Input id="name" placeholder="mon-app" {...field} />
              )} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                GitHub repo {!isConnected('github') && <span className="text-amber-500">(non connecté)</span>}
              </Label>
              <Controller name="github_repo" control={control} render={({ field }) => (
                <ResourceSelect options={githubOptions} value={field.value ?? ''} onChange={field.onChange} placeholder="Sélectionner un repo..." loading={githubLoading} notConnectedMsg={!isConnected('github') ? 'Connectez GitHub dans Paramètres' : undefined} />
              )} />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                GitLab projet {!isConnected('gitlab') && <span className="text-amber-500">(non connecté)</span>}
              </Label>
              <Controller name="gitlab_project" control={control} render={({ field }) => (
                <ResourceSelect options={gitlabOptions} value={field.value ?? ''} onChange={field.onChange} placeholder="Sélectionner un projet..." loading={gitlabLoading} notConnectedMsg={!isConnected('gitlab') ? 'Connectez GitLab dans Paramètres' : undefined} />
              )} />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Vercel project {!isConnected('vercel') && <span className="text-amber-500">(non connecté)</span>}
              </Label>
              <Controller name="vercel_project_id" control={control} render={({ field }) => (
                <ResourceSelect options={vercelOptions} value={field.value ?? ''} onChange={field.onChange} placeholder="Sélectionner un projet Vercel..." loading={vercelLoading} notConnectedMsg={!isConnected('vercel') ? 'Connectez Vercel dans Paramètres' : undefined} />
              )} />
            </div>

            {isConnected('cloudflare') ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">CF Worker</Label>
                  <Controller name="cloudflare_worker_name" control={control} render={({ field }) => (
                    <ResourceSelect options={workerOptions} value={field.value ?? ''} onChange={field.onChange} placeholder="Sélectionner..." loading={cfLoading} />
                  )} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">CF Zone</Label>
                  <Controller name="cloudflare_zone_id" control={control} render={({ field }) => (
                    <ResourceSelect options={zoneOptions} value={field.value ?? ''} onChange={field.onChange} placeholder="Sélectionner..." loading={cfLoading} />
                  )} />
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  Cloudflare <span className="text-amber-500">(non connecté)</span>
                </Label>
                <div className="flex h-9 w-full items-center rounded-md border border-dashed border-input px-3 text-xs text-muted-foreground">
                  Connectez Cloudflare dans Paramètres
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button type="submit" size="sm" loading={isSubmitting}>{editingProject ? 'Enregistrer' : 'Créer'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => { if (!open) setDeleteTarget(null) }}
        title="Supprimer le projet"
        description="Cette action est irréversible. Tout l'historique sera supprimé."
        confirmLabel="Supprimer"
        destructive
        loading={deleteProject.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteProject.mutate(deleteTarget, { onSuccess: () => setDeleteTarget(null) })
        }}
      />
    </div>
  )
}
