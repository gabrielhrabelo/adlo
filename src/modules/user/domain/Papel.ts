export const PAPEIS = ['ADVOGADO', 'ESTAGIARIO', 'ADMINISTRATIVO'] as const

export type Papel = typeof PAPEIS[number]
