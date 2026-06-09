import { userColor } from '../userColor'

describe('userColor', () => {
  it('retourne un fallback pour null', () => {
    const c = userColor(null)
    expect(c.bg).toBeTruthy()
    expect(c.text).toBeTruthy()
  })

  it('retourne un fallback pour undefined', () => {
    expect(userColor(undefined)).toEqual(userColor(null))
  })

  it('retourne un fallback pour string vide', () => {
    expect(userColor('')).toEqual(userColor(null))
  })

  it('est déterministe — même nom retourne toujours le même résultat', () => {
    expect(userColor('Alice')).toEqual(userColor('Alice'))
    expect(userColor('Jean-Pierre')).toEqual(userColor('Jean-Pierre'))
  })

  it('utilise le premier segment pour "Alice, Bob"', () => {
    expect(userColor('Alice, Bob')).toEqual(userColor('Alice'))
    expect(userColor('Alice,Bob')).toEqual(userColor('Alice'))
  })

  it('retourne des couleurs différentes selon le nom', () => {
    const colors = new Set(['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Hugo'].map(n => userColor(n).bg))
    expect(colors.size).toBeGreaterThan(4)
  })

  it('retourne des couleurs hex de la palette', () => {
    const { bg, text } = userColor('Alice')
    expect(bg).toMatch(/^#[0-9a-f]{6}$/)
    expect(text).toMatch(/^#[0-9a-f]{6}$/)
  })
})
