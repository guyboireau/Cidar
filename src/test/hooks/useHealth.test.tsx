import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useTriggerHealthCheck,
  useTriggerAllHealthChecks,
  useProjectHealthHistory,
} from '@/hooks/useHealth'
import * as healthService from '@/services/health'
import { supabase } from '@/lib/supabase'
import type { HealthCheck } from '@/types'
import type { ReactNode } from 'react'

vi.mock('@/services/health')
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
    })),
  },
}))
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

const mockHealthChecks: HealthCheck[] = [
  {
    id: 'hc-1',
    project_id: 'proj-1',
    user_id: 'user-123',
    github_status: 'success',
    github_data: null,
    gitlab_status: null,
    gitlab_data: null,
    vercel_status: null,
    vercel_data: null,
    cloudflare_status: null,
    cloudflare_data: null,
    checked_at: '2024-03-15T10:00:00Z',
  },
]

describe('useTriggerHealthCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('déclenche une vérification de santé', async () => {
    vi.mocked(healthService.triggerHealthCheck).mockResolvedValueOnce(mockHealthChecks[0])

    const { result } = renderHook(() => useTriggerHealthCheck('user-123'), {
      wrapper: createWrapper(),
    })

    await result.current.mutateAsync('proj-1')

    expect(healthService.triggerHealthCheck).toHaveBeenCalledWith('proj-1')
  })
})

describe('useTriggerAllHealthChecks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('déclenche une vérification complète', async () => {
    vi.mocked(healthService.triggerAllHealthChecks).mockResolvedValueOnce([])

    const { result } = renderHook(() => useTriggerAllHealthChecks('user-123'), {
      wrapper: createWrapper(),
    })

    await result.current.mutateAsync()

    expect(healthService.triggerAllHealthChecks).toHaveBeenCalledWith('user-123')
  })
})

describe('useProjectHealthHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('récupère l\'historique de santé d\'un projet', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValueOnce({ data: mockHealthChecks, error: null }),
    } as unknown as ReturnType<typeof supabase.from>)

    const { result } = renderHook(() => useProjectHealthHistory('proj-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.data).toEqual(mockHealthChecks)
    })
  })

  it('ne fait pas de requête si projectId est null', () => {
    const { result } = renderHook(() => useProjectHealthHistory(null), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeUndefined()
  })
})
