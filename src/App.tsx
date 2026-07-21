import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import Layout from '@/components/layout/Layout'
import { OrgProvider } from '@/contexts/OrgContext'

const Login = lazy(() => import('@/pages/Login'))
const AuthCallback = lazy(() => import('@/pages/AuthCallback'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Projects = lazy(() => import('@/pages/Projects'))
const Settings = lazy(() => import('@/pages/Settings'))
const Monitors = lazy(() => import('@/pages/Monitors'))
const CronRoutines = lazy(() => import('@/pages/CronRoutines'))
const StatusPages = lazy(() => import('@/pages/StatusPages'))
const PublicStatus = lazy(() => import('@/pages/PublicStatus'))
const Billing = lazy(() => import('@/pages/Billing'))
const Account = lazy(() => import('@/pages/Account'))
const Onboarding = lazy(() => import('@/pages/Onboarding'))
const Landing = lazy(() => import('@/pages/Landing'))
const UxAudits = lazy(() => import('@/pages/UxAudits'))
const DevTools = lazy(() => import('@/pages/DevTools'))
const AccessibilityAudits = lazy(() => import('@/pages/AccessibilityAudits'))
const StyleGuard = lazy(() => import('@/pages/StyleGuard'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <OrgProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/status/:slug" element={<PublicStatus />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/monitors" element={<Monitors />} />
                <Route path="/routines" element={<CronRoutines />} />
                <Route path="/status-pages" element={<StatusPages />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/account" element={<Account />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/ux-audits" element={<UxAudits />} />
                <Route path="/dev-tools" element={<DevTools />} />
                <Route path="/accessibility" element={<AccessibilityAudits />} />
                <Route path="/style-guard" element={<StyleGuard />} />
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </OrgProvider>
      </BrowserRouter>
      <Toaster position="bottom-right" richColors />
    </QueryClientProvider>
  )
}
