import { ClienteInvalidoError } from "./errors.ts"

export const TIPOS_TELEFONE = ['CELULAR', 'RESIDENCIAL', 'COMERCIAL'] as const
export type TipoDeTelefone = typeof TIPOS_TELEFONE[number]

export const TIPOS_ENDERECO = ['RESIDENCIAL', 'COMERCIAL'] as const
export type TipoDeEndereco = typeof TIPOS_ENDERECO[number]

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

export interface Telefone {
  tipo: TipoDeTelefone
  numero: string
}

export interface Endereco {
  tipo: TipoDeEndereco
  rua: string
  numero: string | null
  complemento: string | null
  bairro: string | null
  cep: string
  cidade: string
  uf: string
}

export function criarTelefone(input: { tipo?: TipoDeTelefone, numero: string }): Telefone {
  const numero = input.numero.replace(/\D/g, '')

  // DDD + número fixo (10) ou celular (11)
  if (numero.length !== 10 && numero.length !== 11) {
    throw new ClienteInvalidoError(`Telefone inválido: "${input.numero}"`)
  }
  return { tipo: input.tipo ?? 'CELULAR', numero }
}

export function criarEndereco(input: {
  tipo?: TipoDeEndereco
  rua: string
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cep: string
  cidade: string
  uf: string
}): Endereco {
  const cep = input.cep.replace(/\D/g, '')
  const uf = input.uf.trim().toUpperCase()
  const rua = input.rua.trim()
  const cidade = input.cidade.trim()

  if (cep.length !== 8) throw new ClienteInvalidoError(`CEP inválido: "${input.cep}"`)
  if (!(UFS as readonly string[]).includes(uf)) throw new ClienteInvalidoError(`UF inválida: "${input.uf}"`)
  if (!rua) throw new ClienteInvalidoError('Rua é obrigatória')
  if (!cidade) throw new ClienteInvalidoError('Cidade é obrigatória')

  return {
    tipo: input.tipo ?? 'RESIDENCIAL',
    rua,
    numero: blankToNull(input.numero),
    complemento: blankToNull(input.complemento),
    bairro: blankToNull(input.bairro),
    cep,
    cidade,
    uf,
  }
}

function blankToNull(value: string | null | undefined): string | null {
  const v = value?.trim()
  return v ? v : null
}
