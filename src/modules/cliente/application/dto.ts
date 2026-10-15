import type { Endereco, Telefone } from "../domain/Contato.ts";
import type { Cliente } from "../domain/Cliente.ts";

export interface ClienteDTO {
  id: string
  usuarioId: string
  nome: string
  cpfCnpj: string | null
  email: string | null
  dataNascimento: string | null
  observacoes: string | null
  ativo: boolean
  telefones: Telefone[]
  enderecos: Endereco[]
  createdAt: string
}

export function toClienteDTO(cliente: Cliente): ClienteDTO {
  return {
    id: cliente.id,
    usuarioId: cliente.usuarioId,
    nome: cliente.nome,
    cpfCnpj: cliente.cpfCnpj,
    email: cliente.email,
    dataNascimento: cliente.dataNascimento?.toISOString().slice(0, 10) ?? null,
    observacoes: cliente.observacoes,
    ativo: cliente.ativo,
    telefones: [...cliente.telefones],
    enderecos: [...cliente.enderecos],
    createdAt: cliente.createdAt.toISOString(),
  }
}
