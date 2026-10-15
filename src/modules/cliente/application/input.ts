import { Email } from "../../../shared/domain/Email.ts";
import type { DadosDoCliente } from "../domain/Cliente.ts";
import { criarEndereco, criarTelefone, type TipoDeEndereco, type TipoDeTelefone } from "../domain/Contato.ts";
import { CpfCnpj } from "../domain/CpfCnpj.ts";
import { ClienteInvalidoError } from "../domain/errors.ts";

// Formato recebido pelos casos de uso (primitivos vindos da API)
export interface DadosDoClienteInput {
  usuarioId?: string
  nome?: string
  cpfCnpj?: string | null
  email?: string | null
  dataNascimento?: string | null
  observacoes?: string | null
  telefones?: { tipo?: TipoDeTelefone, numero: string }[]
  enderecos?: {
    tipo?: TipoDeEndereco
    rua: string
    numero?: string | null
    complemento?: string | null
    bairro?: string | null
    cep: string
    cidade: string
    uf: string
  }[]
}

export function parseDadosDoCliente(input: DadosDoClienteInput): DadosDoCliente {
  const dados: DadosDoCliente = {}

  if (input.usuarioId !== undefined) dados.usuarioId = input.usuarioId
  if (input.nome !== undefined) dados.nome = input.nome
  if (input.cpfCnpj !== undefined) dados.cpfCnpj = input.cpfCnpj ? CpfCnpj.create(input.cpfCnpj) : null
  if (input.email !== undefined) dados.email = input.email ? Email.create(input.email) : null
  if (input.dataNascimento !== undefined) dados.dataNascimento = parseDate(input.dataNascimento)
  if (input.observacoes !== undefined) dados.observacoes = input.observacoes
  if (input.telefones !== undefined) dados.telefones = input.telefones.map(criarTelefone)
  if (input.enderecos !== undefined) dados.enderecos = input.enderecos.map(criarEndereco)

  return dados
}

function parseDate(value: string | null): Date | null {
  if (!value) return null

  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) throw new ClienteInvalidoError(`Data inválida: "${value}"`)

  return date
}
