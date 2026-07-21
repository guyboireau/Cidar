import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus,
  Timer,
  Play,
  Power,
  RefreshCw,
  Trash2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  CircleDashed,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useSession } from '@/hooks/useAuth'
import {
  useCronRoutines,
  useCronRuns,
  useCreateCronRoutine,
  useDeleteCronRoutine,
  useTriggerCronRoutine,
  useToggleCronRoutine,
  useSyncCronRoutine,
} from '@/hooks/useCronRoutines'
import { formatRelative, cn } from '@/lib/utils'
import type { CronRoutine, CronRunStatus } from '@/types'

const schema = z.object({
  name: z.string().min(1, 'Nom requis'),
  description: z.string().optional(),
  github_owner: z.string().min(1, 'Propriétaire requis'),
  github_repo: z.string().min(1, 'Dépôt requis'),
  // Le nom de fichier, pas l'id numérique : il survit à une recréation du workflow.
  workflow_file: z
    .string()
    .min(1, 'Fichier requis')
    .regex(/\.ya?ml$/, 'Doit finir par .yml ou .yaml'),
  cron_expression: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const STATUS_META: Record<CronRunStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  success: { label: 'Succès', icon: CheckCircle2, className: 'text-emerald-600' },
  failure: { label: 'Échec', icon: XCircle, className: 'text-red-600' },
  running: { label: 'En cours', icon: Loader2, className: 'text-blue-500' },
  pending: { label: 'En attente', icon: CircleDashed, className: 'text-muted-foreground' },
  cancelled: { label: 'Annulé', icon: XCircle, className: 'text-amber-600' },
  unknown: { label: 'Inconnu', icon: CircleDashed, className: 'text-muted-foreground' },
}

function RunStatus({ status }: { status: CronRunStatus | null }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>
  const meta = STATUS_META[status] ?? STATUS_META.unknown
  const Icon = meta.icon
  return (
    <span className={cn('flex items-center gap-1 text-xs', meta.className)}>
      <Icon className={cn('h-3.5 w-3.5', status === 'running' && 'animate-spin')} />
      {meta.label}
    </span>
  )
}

// Historique d'une routine, replié par défaut : la requête ne part qu'à l'ouverture
// (le hook est `enabled: !!routineId`), on ne charge pas 3 historiques pour rien.
function RunHistory({ routineId }: { routineId: string }) {
  const { data: runs = [], isLoading } = useCronRuns(routineId)

  if (isLoading) return <p className="text-xs text-muted-foreground px-4 py-3">Chargement…</p>
  if (!runs.length) return <p className="text-xs text-muted-foreground px-4 py-3">Aucun run enregistré. Lance une synchronisation.</p>

  return (
    <ul className="divide-y divide-border">
      {runs.map((run) => (
        <li key={run.id} className="flex items-center gap-3 px-4 py-2 text-xs">
          <RunStatus status={run.status} />
          <span className="text-muted-foreground">{formatRelative(run.started_at)}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {run.trigger_source === 'manual' ? 'manuel' : 'planifié'}
          </span>
          {run.html_url && (
            <a
              href={run.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1 text-primary hover:underline"
            >
              Voir <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}

export default function CronRoutines() {
  const session = useSession()
  const userId = session?.user?.id ?? ''
  const { data: routines = [], isLoading } = useCronRoutines(userId)
  const createRoutine = useCreateCronRoutine(userId)
  const deleteRoutine = useDeleteCronRoutine(userId)
  const trigger = useTriggerCronRoutine(userId)
  const toggle = useToggleCronRoutine(userId)
  const sync = useSyncCronRoutine(userId)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [disableTarget, setDisableTarget] = useState<CronRoutine | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    await createRoutine.mutateAsync({
      name: data.name,
      description: data.description || null,
      github_owner: data.github_owner,
      github_repo: data.github_repo,
      workflow_file: data.workflow_file,
      cron_expression: data.cron_expression || null,
      org_id: null,
    })
    setDialogOpen(false)
    reset()
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Routines planifiées</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pilotez vos agents GitHub Actions — déclenchement, activation, historique
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Nouvelle routine
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg border bg-card animate-pulse" />
          ))}
        </div>
      ) : routines.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-16 text-center">
          <Timer className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium">Aucune routine</p>
          <p className="text-xs text-muted-foreground mt-1">
            Déclarez un workflow GitHub Actions pour le piloter d'ici
          </p>
          <Button size="sm" className="mt-4 gap-2" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Nouvelle routine
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {routines.map((r) => {
            const isOpen = expanded === r.id
            return (
              <div key={r.id} className="rounded-lg border bg-card overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{r.name}</p>
                      {!r.enabled && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          désactivée
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {r.github_owner}/{r.github_repo} · {r.workflow_file}
                      {r.cron_expression && <span className="ml-1 font-mono">{r.cron_expression}</span>}
                    </p>
                  </div>

                  <div className="hidden sm:flex flex-col items-end gap-0.5">
                    <RunStatus status={r.last_run_status} />
                    {r.last_run_at && (
                      <span className="text-[11px] text-muted-foreground">{formatRelative(r.last_run_at)}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={!r.enabled}
                      title={r.enabled ? 'Déclencher maintenant' : 'Routine désactivée chez GitHub'}
                      loading={trigger.isPending && trigger.variables === r.id}
                      onClick={() => trigger.mutate(r.id)}
                    >
                      <Play className="h-3.5 w-3.5" />
                      Lancer
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      title="Synchroniser l'historique depuis GitHub"
                      loading={sync.isPending && sync.variables === r.id}
                      onClick={() => sync.mutate(r.id)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn('h-7 w-7', r.enabled ? 'text-muted-foreground' : 'text-amber-600')}
                      title={r.enabled ? 'Désactiver le cron chez GitHub' : 'Réactiver le cron'}
                      loading={toggle.isPending && toggle.variables?.id === r.id}
                      onClick={() => {
                        // Couper une routine arrête un cron en production : on confirme.
                        // La réactiver est sans risque, elle part directement.
                        if (r.enabled) setDisableTarget(r)
                        else toggle.mutate({ id: r.id, enabled: true })
                      }}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      title="Retirer de Vigilo"
                      onClick={() => setDeleteTarget(r.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      title="Historique"
                      onClick={() => setExpanded(isOpen ? null : r.id)}
                    >
                      <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')} />
                    </Button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t bg-muted/20">
                    <RunHistory routineId={r.id} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle routine</DialogTitle>
            <DialogDescription>
              Déclarez un workflow GitHub Actions existant. Vigilo ne crée pas le cron —
              il vit dans le YAML du dépôt.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nom *</Label>
              <Input placeholder="Surf Report" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input placeholder="Rapport surf quotidien" {...register('description')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Propriétaire *</Label>
                <Input placeholder="guyboireau" {...register('github_owner')} />
                {errors.github_owner && <p className="text-xs text-destructive">{errors.github_owner.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Dépôt *</Label>
                <Input placeholder="surf-report-agent" {...register('github_repo')} />
                {errors.github_repo && <p className="text-xs text-destructive">{errors.github_repo.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Fichier workflow *</Label>
              <Input placeholder="surf-daily.yml" {...register('workflow_file')} />
              {errors.workflow_file && <p className="text-xs text-destructive">{errors.workflow_file.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Expression cron</Label>
              <Input placeholder="0 5 * * *" className="font-mono" {...register('cron_expression')} />
              <p className="text-[11px] text-muted-foreground">
                Informatif — recopie ce qui est dans le YAML. La modifier ici ne change rien chez GitHub.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" size="sm" loading={isSubmitting}>
                Ajouter
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!disableTarget}
        onOpenChange={(open) => { if (!open) setDisableTarget(null) }}
        title="Désactiver la routine"
        description={
          disableTarget
            ? `Le cron de « ${disableTarget.name} » sera désactivé chez GitHub : il ne se déclenchera plus automatiquement jusqu'à réactivation.`
            : ''
        }
        confirmLabel="Désactiver"
        loading={toggle.isPending}
        onConfirm={() => {
          if (disableTarget) {
            toggle.mutate(
              { id: disableTarget.id, enabled: false },
              { onSuccess: () => setDisableTarget(null) }
            )
          }
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="Retirer la routine"
        description="La routine et son historique sont supprimés de Vigilo. Le workflow et son cron restent intacts chez GitHub."
        confirmLabel="Retirer"
        destructive
        loading={deleteRoutine.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteRoutine.mutate(deleteTarget, { onSuccess: () => setDeleteTarget(null) })
        }}
      />
    </div>
  )
}
