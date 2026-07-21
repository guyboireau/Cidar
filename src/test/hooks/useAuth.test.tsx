import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSession, useProfile, useSignOut, useUpdateProfile } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'
import type { ReactNode } from 'react'

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      update: vi.fn().mockReturnThis(),
    })),
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe('useSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retourne undefined au montage puis la session', async () => {
    const mockSession = { user: { id: 'user-123' } } as Session
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({ data: { session: mockSession } })

    const { result } = renderHook(() => useSession())

    // Au montage : undefined
    expect(result.current).toBeUndefined()

    // Après résolution
    await waitFor(() => {
      expect(result.current).toEqual(mockSession)
    })
  })

  it('retourne null si pas de session', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({ data: { session: null } })

    const { result } = renderHook(() => useSession())

    await waitFor(() => {
      expect(result.current).toBeNull()
    })
  })

  it('s\'abonne aux changements d\'auth state', () => {
    renderHook(() => useSession())

    expect(supabase.auth.onAuthStateChange).toHaveBeenCalled()
  })
})

describe('useProfile', () => {
  const mockUser = { id: 'user-123' } as User
  const mockProfile = { id: 'user-123', name: 'Test User', email: 'test@example.com' }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('récupère le profil quand user est défini', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValueOnce({ data: mockProfile, error: null }),
    } as unknown as ReturnType<typeof supabase.from>)

    const { result } = renderHook(() => useProfile(mockUser), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.data).toEqual(mockProfile)
    })
  })

  it('ne fait pas de requête si user est null', () => {
    const { result } = renderHook(() => useProfile(null), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeUndefined()
  })

  it('ne fait pas de requête si user est undefined', () => {
    const { result } = renderHook(() => useProfile(undefined), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeUndefined()
  })
})

describe('useSignOut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('appelle supabase.auth.signOut', async () => {
    vi.mocked(supabase.auth.signOut).mockResolvedValueOnce({ error: null })

    const { result } = renderHook(() => useSignOut(), { wrapper: createWrapper() })

    await result.current.mutateAsync()

    expect(supabase.auth.signOut).toHaveBeenCalled()
  })

  it('invalide le cache après déconnexion', async () => {
    vi.mocked(supabase.auth.signOut).mockResolvedValueOnce({ error: null })

    const queryClient = new QueryClient()
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'clear')

    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useSignOut(), { wrapper: Wrapper })

    await result.current.mutateAsync()

    expect(invalidateQueriesSpy).toHaveBeenCalled()
  })
})

describe('useUpdateProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('met à jour le profil avec les données fournies', async () => {
    const singleMock = vi.fn().mockResolvedValueOnce({ data: { id: 'user-123', name: 'New Name' }, error: null })
    const selectMock = vi.fn().mockReturnValueOnce({ single: singleMock })
    const eqMock = vi.fn().mockReturnValueOnce({ select: selectMock })
    const updateMock = vi.fn().mockReturnValueOnce({ eq: eqMock })

    vi.mocked(supabase.from).mockReturnValueOnce({
      update: updateMock,
    } as unknown as ReturnType<typeof supabase.from>)

    const { result } = renderHook(() => useUpdateProfile('user-123'), { wrapper: createWrapper() })

    await result.current.mutateAsync({ name: 'New Name' })

    expect(updateMock).toHaveBeenCalledWith({ name: 'New Name' })
    expect(eqMock).toHaveBeenCalledWith('id', 'user-123')
  })
})
