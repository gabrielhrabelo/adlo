import type { Page, PageRequest } from "../../../shared/application/Pagination.ts";
import type { CanalDeAtendimento } from "../domain/Atendimento.ts";
import type { AtendimentoDTO } from "./dto.ts";

export interface FiltrosDeAtendimento extends PageRequest {
  clienteId: string
  canal?: CanalDeAtendimento
  processoId?: string
  // Período (ISO 8601), inclusivo
  de?: string
  ate?: string
  busca?: string
}

export interface AtendimentoHistoricoDTO extends AtendimentoDTO {
  usuario: { id: string, nome: string } | null
  processo: { id: string, titulo: string, numeroProcesso: string | null } | null
}

// RF11 - Consultar histórico de atendimentos por cliente
export interface AtendimentoQueries {
  historico(filtros: FiltrosDeAtendimento): Promise<Page<AtendimentoHistoricoDTO>>
  detalhar(id: string): Promise<AtendimentoHistoricoDTO | null>
}
