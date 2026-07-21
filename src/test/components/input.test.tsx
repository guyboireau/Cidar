import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Input } from '@/components/ui/input'
import React from 'react'

describe('Input', () => {
  it('rend un input avec le placeholder fourni', () => {
    render(<Input placeholder="Nom" />)
    expect(screen.getByPlaceholderText('Nom')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Nom')).toBeInstanceOf(HTMLInputElement)
  })

  it('supporte le type password', () => {
    render(<Input type="password" placeholder="Mot de passe" />)
    expect(screen.getByPlaceholderText('Mot de passe')).toHaveAttribute('type', 'password')
  })

  it('supporte le type email', () => {
    render(<Input type="email" placeholder="Email" />)
    expect(screen.getByPlaceholderText('Email')).toHaveAttribute('type', 'email')
  })

  it('est désactivé quand disabled est true', () => {
    render(<Input disabled placeholder="Désactivé" />)
    expect(screen.getByPlaceholderText('Désactivé')).toBeDisabled()
  })

  it('fusionne les classes personnalisées', () => {
    render(<Input className="ma-classe" placeholder="Custom" />)
    expect(screen.getByPlaceholderText('Custom')).toHaveClass('ma-classe')
  })

  it('transmet la valeur via ref', () => {
    const ref = React.createRef<HTMLInputElement>()
    render(<Input ref={ref} placeholder="Ref test" />)
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
    expect(ref.current?.placeholder).toBe('Ref test')
  })

  it('a les classes Tailwind attendues', () => {
    render(<Input placeholder="Style" />)
    const input = screen.getByPlaceholderText('Style')
    expect(input).toHaveClass('flex', 'h-9', 'w-full', 'rounded-md')
    expect(input).toHaveClass('border', 'border-input')
    expect(input).toHaveClass('bg-transparent')
  })
})
