import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getRoutines,
  getRuns,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  triggerRoutine,
  toggleRoutine,
  syncRoutine,
} from '@/services/cronRoutines'
import type { CronRoutine } from '@/types'

export function useCronRoutines(userId: string) {
  return useQuery({
    queryKey: ['cronRoutines', userId],
    queryFn: () => getRoutines(userId),
    enabled: !!userId,
    refetchInterval: 60_000,
  })
}

export function useCronRuns(routineId: string) {
  return useQuery({
    queryKey: ['cronRuns', routineId],
    queryFn: () => getRuns(routineId),
    enabled: !!routineId,
  })
}

export function useCreateCronRoutine(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (
      r: Pick<
        CronRoutine,
        'name' | 'description' | 'github_owner' | 'github_repo' | 'workflow_file' | 'cron_expression' | 'org_id'
      >
    ) => createRoutine(userId, r),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cronRoutines', userId] })
      toast.success('Routine ajoutée')
    },
    onError: (e: Error) => toast.error(e.message || 'Erreur lors de la création'),
  })
}

export function useUpdateCronRoutine(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CronRoutine> }) => updateRoutine(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cronRoutines', userId] }),
    onError: (e: Error) => toast.error(e.message || 'Erreur lors de la mise à jour'),
  })
}

export function useDeleteCronRoutine(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteRoutine(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cronRoutines', userId] })
      toast.success('Routine supprimée')
    },
    onError: (e: Error) => toast.error(e.message || 'Erreur lors de la suppression'),
  })
}

export function useTriggerCronRoutine(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (routineId: string) => triggerRoutine(routineId),
    onSuccess: (_data, routineId) => {
      qc.invalidateQueries({ queryKey: ['cronRoutines', userId] })
      qc.invalidateQueries({ queryKey: ['cronRuns', routineId] })
      // GitHub matérialise le run de façon asynchrone : au retour du dispatch il
      // n'existe pas encore. D'où « lancé » et non « terminé ».
      toast.success('Workflow lancé — le run apparaîtra dans quelques secondes')
    },
    onError: (e: Error) => toast.error(e.message || 'Échec du déclenchement'),
  })
}

export function useToggleCronRoutine(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => toggleRoutine(id, enabled),
    onSuccess: (_data, { enabled }) => {
      qc.invalidateQueries({ queryKey: ['cronRoutines', userId] })
      toast.success(enabled ? 'Routine réactivée' : 'Routine désactivée chez GitHub')
    },
    onError: (e: Error) => toast.error(e.message || 'Échec du changement d\'état'),
  })
}

export function useSyncCronRoutine(userId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (routineId: string) => syncRoutine(routineId),
    onSuccess: (data, routineId) => {
      qc.invalidateQueries({ queryKey: ['cronRoutines', userId] })
      qc.invalidateQueries({ queryKey: ['cronRuns', routineId] })
      toast.success(`${data.synced} run(s) synchronisé(s)`)
    },
    onError: (e: Error) => toast.error(e.message || 'Échec de la synchronisation'),
  })
}
