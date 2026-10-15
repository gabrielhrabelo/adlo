import type { Page, PageRequest } from "../../../shared/application/Pagination.ts";
import type { ClienteDTO } from "./dto.ts";

export interface FiltrosDeCliente extends PageRequest {
  // Busca por nome, CPF/CNPJ, email ou telefone
  busca?: string
  ativo?: boolean
  usuarioId?: string
  area?: 'INSS' | 'DPVAT'
  cidade?: string
  ordenarPor?: 'nome' | 'criadoEm'
}

export interface ClienteResumoDTO {
  id: string
  nome: string
  cpfCnpj: string | null
  email: string | null
  telefonePrincipal: string | null
  ativo: boolean
  usuarioId: string
  totalProcessos: number
  createdAt: string
}

export interface ClienteDetalheDTO extends ClienteDTO {
  responsavel: { id: string, nome: string }
  totais: { processos: number, atendimentos: number, documentos: number, agendamentosPendentes: number }
}

// RF03 - Consultar cliente, com busca avançada e filtros dinâmicos
export interface ClienteQueries {
  listar(filtros: FiltrosDeCliente): Promise<Page<ClienteResumoDTO>>
  detalhar(id: string): Promise<ClienteDetalheDTO | null>
}
