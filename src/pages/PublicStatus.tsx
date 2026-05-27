import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, XCircle, AlertTriangle, MinusCircle, Shield } from 'lucide-react'
import { getPublicStatusPage, getPublicProjects, getPublicMonitors } from '@/services/statusPages'
import { formatRelative } from '@/lib/utils'

function StatusIcon({ status }: { status: string | null }) {
  if (status === 'success' || status === 'up') return <CheckCircle2 className="h-5 w-5 text-emerald-500" />
  if (status === 'failure' || status === 'error' || status === 'down') return <XCircle className="h-5 w-5 text-red-500" />
  if (status === 'warning') return <AlertTriangle className="h-5 w-5 text-amber-500" />
  return <MinusCircle className="h-5 w-5 text-muted-foreground" />
}

function statusLabel(s: string | null): string {
  if (s === 'success' || s === 'up') return 'Opérationnel'
  if (s === 'failure' || s === 'error' || s === 'down') return 'Panne'
  if (s === 'warning') return 'Dégradé'
  return 'Inconnu'
}

export default function PublicStatus() {
  const { slug } = useParams<{ slug: string }>()

  const { data: page, isLoading: pageLoading } = useQuery({
    queryKey: ['public-status', slug],
    queryFn: () => getPublicStatusPage(slug!),
    enabled: !!slug,
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['public-status-projects', page?.project_ids],
    queryFn: async () => {
      if (!page?.project_ids?.length) return []
      return getPublicProjects(page.project_ids)
    },
    enabled: !!page?.project_ids?.length,
  })

  const { data: monitors = [] } = useQuery({
    queryKey: ['public-status-monitors', page?.http_monitor_ids],
    queryFn: async () => {
      if (!page?.http_monitor_ids?.length) return []
      return getPublicMonitors(page.http_monitor_ids)
    },
    enabled: !!page?.http_monitor_ids?.length,
  })

  const allStatuses = [
    ...projects.map(p => p.overall_status),
    ...monitors.map(m => m.last_status === 'up' ? 'success' : m.last_status === 'down' ? 'failure' : null),
  ].filter(Boolean)

  const globalStatus = allStatuses.includes('failure') || allStatuses.includes('error') ? 'failure'
    : allStatuses.includes('warning') ? 'warning'
    : allStatuses.every(s => s === 'success') && allStatuses.length > 0 ? 'success'
    : null

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!page) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-xl font-bold">Page introuvable</p>
        <p className="text-muted-foreground text-sm">Cette status page n'existe pas ou n'est plus publique.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{page.title}</h1>
            {page.description && <p className="text-muted-foreground mt-1">{page.description}</p>}
          </div>
          {globalStatus && (
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border ${
              globalStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700'
              : globalStatus === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-700'
              : 'bg-red-500/10 border-red-500/30 text-red-700'
            }`}>
              <StatusIcon status={globalStatus} />
              {globalStatus === 'success' ? 'Tous les systèmes sont opérationnels'
               : globalStatus === 'warning' ? 'Dégradation partielle en cours'
               : 'Panne en cours'}
            </div>
          )}
        </div>

        {/* Services */}
        {(projects.length > 0 || monitors.length > 0) && (
          <div className="rounded-xl border overflow-hidden">
            <div className="bg-muted/40 px-4 py-2.5 border-b">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Services</p>
            </div>
            <div className="divide-y">
              {projects.map(p => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    {p.checked_at && <p className="text-[11px] text-muted-foreground">{formatRelative(p.checked_at)}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusIcon status={p.overall_status} />
                    <span className="text-sm">{statusLabel(p.overall_status)}</span>
                  </div>
                </div>
              ))}
              {monitors.map(m => (
                <div key={m.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{m.public_name || m.name}</p>
                    {m.last_checked_at && <p className="text-[11px] text-muted-foreground">{formatRelative(m.last_checked_at)}{m.last_response_ms ? ` · ${m.last_response_ms}ms` : ''}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusIcon status={m.last_status === 'up' ? 'success' : m.last_status === 'down' ? 'failure' : null} />
                    <span className="text-sm">{m.last_status === 'up' ? 'Opérationnel' : m.last_status === 'down' ? 'Panne' : '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Propulsé par <a href="/" className="text-primary hover:underline">CIdar</a>
        </p>
      </div>
    </div>
  )
}
