import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FolderGit2, Settings, LogOut, Zap, Globe, LayoutGrid, Menu, X, CreditCard, Eye, Wrench, Accessibility, PenTool, Timer } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useSignOut } from '@/hooks/useAuth'
import { useOrg } from '@/contexts/OrgContext'
import OrgSwitcher from './OrgSwitcher'
import type { Profile } from '@/types'

const PLAN_BADGE: Record<string, { label: string; className: string }> = {
  free: { label: 'Free', className: 'bg-muted text-muted-foreground' },
  solo: { label: 'Solo', className: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
  agency: { label: 'Agency', className: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' },
}

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects', icon: FolderGit2, label: 'Projets' },
  { to: '/monitors', icon: Globe, label: 'Moniteurs HTTP' },
  { to: '/routines', icon: Timer, label: 'Routines' },
  { to: '/status-pages', icon: LayoutGrid, label: 'Status Pages' },
  { to: '/ux-audits', icon: Eye, label: 'Audit UX' },
  { to: '/accessibility', icon: Accessibility, label: 'AccessLens' },
  { to: '/style-guard', icon: PenTool, label: 'StyleGuard' },
  { to: '/dev-tools', icon: Wrench, label: 'Dev Tools' },
  { to: '/settings', icon: Settings, label: 'Paramètres' },
  { to: '/billing', icon: CreditCard, label: 'Facturation' },
]

interface SidebarProps {
  profile: Profile | null | undefined
  onAnalyze: () => void
  analyzing: boolean
}

function SidebarContent({ profile, onAnalyze, analyzing, onClose }: SidebarProps & { onClose?: () => void }) {
  const signOut = useSignOut()
  const navigate = useNavigate()
  const { currentOrg } = useOrg()

  function handleSignOut() {
    signOut.mutate(undefined, { onSuccess: () => navigate('/login') })
  }

  const initials = profile?.name
    ?.split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?'

  const planBadge = currentOrg ? PLAN_BADGE[currentOrg.plan_id] ?? PLAN_BADGE.free : null

  return (
    <aside className="flex h-screen w-56 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <Logo size={32} />
          <div>
            <p className="text-sm font-bold text-white">Cidar</p>
            <p className="text-[10px] text-sidebar-foreground/50 leading-none">Infra Health</p>
          </div>
        </div>
        {planBadge && (
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', planBadge.className)}>
            {planBadge.label}
          </span>
        )}
        {onClose && (
          <button onClick={onClose} className="text-sidebar-foreground/50 hover:text-sidebar-foreground md:hidden">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Org switcher */}
      <div className="px-2 py-2 border-b border-sidebar-border">
        <OrgSwitcher />
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-sidebar-accent/20 text-sidebar-accent font-medium border-l-2 border-sidebar-accent'
                  : 'text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground'
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-3">
        <Button
          className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          size="sm"
          onClick={onAnalyze}
          loading={analyzing}
        >
          <Zap className="h-4 w-4" />
          {analyzing ? 'Analyse...' : 'Analyser tout'}
        </Button>
      </div>

      <div className="border-t border-sidebar-border px-3 py-3 space-y-2">
        <NavLink
          to="/account"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-sidebar-accent/20 text-sidebar-accent font-medium border-l-2 border-sidebar-accent'
                : 'text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground'
            )
          }
        >
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-sidebar-accent/20 text-sidebar-accent text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{profile?.name ?? profile?.email ?? '—'}</p>
            <p className="text-[10px] text-sidebar-foreground/50 truncate">{profile?.email}</p>
          </div>
        </NavLink>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Déconnexion
        </button>
      </div>
    </aside>
  )
}

export default function Sidebar(props: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex">
        <SidebarContent {...props} />
      </div>

      {/* Mobile hamburger */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between bg-sidebar border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Logo size={28} />
          <p className="text-sm font-bold text-white">Cidar</p>
        </div>
        <button onClick={() => setMobileOpen(true)} className="text-white">
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative z-50">
            <SidebarContent {...props} onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
