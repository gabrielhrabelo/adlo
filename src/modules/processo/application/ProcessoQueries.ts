import type { Page, PageRequest } from "../../../shared/application/Pagination.ts";
import type { AreaDoProcesso, StatusDoProcesso } from "../domain/enums.ts";
import type { ProcessoDTO } from "./dto.ts";

export interface FiltrosDeProcesso extends PageRequest {
  // Busca por título, número do processo ou nome do cliente
  busca?: string
  clienteId?: string
  status?: StatusDoProcesso[]
  area?: AreaDoProcesso
  // Por padrão processos arquivados ficam de fora das listagens
  incluirArquivados?: boolean
  ordenarPor?: 'criadoEm' | 'dataAbertura' | 'titulo'
}

export interface ProcessoResumoDTO extends ProcessoDTO {
  cliente: { id: string, nome: string }
}

export interface ProcessoDetalheDTO extends ProcessoResumoDTO {
  proximoAgendamento: { id: string, titulo: string, tipo: string, dataHora: string } | null
  totais: { agendamentos: number, atendimentos: number }
}

// Consultar processo (Figura 1 / Figura 11)
export interface ProcessoQueries {
  listar(filtros: FiltrosDeProcesso): Promise<Page<ProcessoResumoDTO>>
  detalhar(id: string): Promise<ProcessoDetalheDTO | null>
}
