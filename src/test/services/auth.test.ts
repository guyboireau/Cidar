import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  signInWithEmail,
  signUpWithEmail,
  signOut,
  getProfile,
  updateProfile,
} from '@/services/auth'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      update: vi.fn().mockReturnThis(),
    })),
  },
}))

describe('signInWithEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('connecte un utilisateur avec email et mot de passe', async () => {
    const mockData = { session: { user: { id: 'user-123' } } }
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: mockData,
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>)

    const result = await signInWithEmail('test@example.com', 'password123')

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    })
    expect(result).toEqual(mockData)
  })

  it('lance une erreur si la connexion échoue', async () => {
    const mockError = new Error('Invalid credentials')
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: null,
      error: mockError,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>)

    await expect(signInWithEmail('test@example.com', 'wrong')).rejects.toThrow('Invalid credentials')
  })
})

describe('signUpWithEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inscrit un nouvel utilisateur', async () => {
    const mockData = { user: { id: 'new-user' }, session: null }
    vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
      data: mockData,
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.signUp>>)

    const result = await signUpWithEmail('new@example.com', 'password123', 'John Doe')

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'password123',
      options: { data: { full_name: 'John Doe' } },
    })
    expect(result).toEqual(mockData)
  })

  it('inscrit sans nom si non fourni', async () => {
    const mockData = { user: { id: 'new-user' }, session: null }
    vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
      data: mockData,
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.signUp>>)

    await signUpWithEmail('new@example.com', 'password123')

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'password123',
      options: { data: { full_name: undefined } },
    })
  })
})

describe('signOut', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('déconnecte l\'utilisateur', async () => {
    vi.mocked(supabase.auth.signOut).mockResolvedValueOnce({ error: null })

    await signOut()

    expect(supabase.auth.signOut).toHaveBeenCalled()
  })

  it('lance une erreur si la déconnexion échoue', async () => {
    const mockError = new Error('Sign out failed')
    vi.mocked(supabase.auth.signOut).mockResolvedValueOnce({
      error: mockError,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.signOut>>)

    await expect(signOut()).rejects.toThrow('Sign out failed')
  })
})

describe('getProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('récupère le profil par userId', async () => {
    const mockProfile = { id: 'user-123', name: 'Test User', email: 'test@example.com' }
    const singleMock = vi.fn().mockResolvedValueOnce({ data: mockProfile, error: null })
    const eqMock = vi.fn().mockReturnValueOnce({ single: singleMock })
    const selectMock = vi.fn().mockReturnValueOnce({ eq: eqMock })

    vi.mocked(supabase.from).mockReturnValueOnce({
      select: selectMock,
    } as unknown as ReturnType<typeof supabase.from>)

    const result = await getProfile('user-123')

    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(selectMock).toHaveBeenCalledWith('*')
    expect(eqMock).toHaveBeenCalledWith('id', 'user-123')
    expect(result).toEqual(mockProfile)
  })

  it('lance une erreur si le profil n\'est pas trouvé', async () => {
    const singleMock = vi.fn().mockResolvedValueOnce({ data: null, error: new Error('Not found') })
    const eqMock = vi.fn().mockReturnValueOnce({ single: singleMock })
    const selectMock = vi.fn().mockReturnValueOnce({ eq: eqMock })

    vi.mocked(supabase.from).mockReturnValueOnce({
      select: selectMock,
    } as unknown as ReturnType<typeof supabase.from>)

    await expect(getProfile('unknown')).rejects.toThrow('Not found')
  })
})

describe('updateProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('met à jour le profil avec les données fournies', async () => {
    const updatedProfile = { id: 'user-123', name: 'New Name' }
    const selectMock = vi.fn().mockReturnValueOnce({
      single: vi.fn().mockResolvedValueOnce({ data: updatedProfile, error: null }),
    })
    const eqMock = vi.fn().mockReturnValueOnce({
      select: selectMock,
    })
    const updateMock = vi.fn().mockReturnValueOnce({
      eq: eqMock,
    })

    vi.mocked(supabase.from).mockReturnValueOnce({
      update: updateMock,
    } as unknown as ReturnType<typeof supabase.from>)

    const result = await updateProfile('user-123', { name: 'New Name' })

    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(updateMock).toHaveBeenCalledWith({ name: 'New Name' })
    expect(eqMock).toHaveBeenCalledWith('id', 'user-123')
    expect(result).toEqual(updatedProfile)
  })
})
