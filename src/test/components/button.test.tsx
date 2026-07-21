import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('rend un bouton avec le texte fourni', () => {
    render(<Button>Cliquez-moi</Button>)
    expect(screen.getByRole('button', { name: /Cliquez-moi/i })).toBeInTheDocument()
  })

  it('est désactivé quand disabled est true', () => {
    render(<Button disabled>Désactivé</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('est désactivé quand loading est true', () => {
    render(<Button loading>Chargement</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('affiche un spinner quand loading est true', () => {
    render(<Button loading>Chargement</Button>)
    expect(screen.getByRole('button').querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('appelle onClick quand cliqué', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Cliquer</Button>)

    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('ne déclenche pas onClick quand désactivé', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick} disabled>Désactivé</Button>)

    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('supporte la variante "destructive"', () => {
    render(<Button variant="destructive">Supprimer</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-destructive')
  })

  it('supporte la taille "sm"', () => {
    render(<Button size="sm">Petit</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('h-8')
  })

  it('supporte la taille "lg"', () => {
    render(<Button size="lg">Grand</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('h-10')
  })

  it('supporte asChild pour rendre un lien', () => {
    render(
      <Button asChild>
        <a href="/test">Lien</a>
      </Button>
    )
    expect(screen.getByRole('link', { name: /Lien/i })).toBeInTheDocument()
  })

  it('fusionne les classes personnalisées', () => {
    render(<Button className="ma-classe">Custom</Button>)
    expect(screen.getByRole('button')).toHaveClass('ma-classe')
  })
})
