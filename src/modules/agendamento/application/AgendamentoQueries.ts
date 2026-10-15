import type { Page, PageRequest } from "../../../shared/application/Pagination.ts";
import type { StatusDoAgendamento, TipoDeAgendamento } from "../domain/Agendamento.ts";
import type { AgendamentoDTO } from "./dto.ts";

export interface FiltrosDeAgendamento extends PageRequest {
  clienteId?: string
  usuarioId?: string
  processoId?: string
  tipo?: TipoDeAgendamento
  status?: StatusDoAgendamento[]
  de?: string
  ate?: string
}

export interface AgendamentoDetalheDTO extends AgendamentoDTO {
  cliente: { id: string, nome: string }
  responsavel: { id: string, nome: string }
  processo: { id: string, titulo: string, numeroProcesso: string | null } | null
  atrasado: boolean
}

export interface PainelDeAlertasDTO {
  geradoEm: string
  atrasados: AgendamentoDetalheDTO[]
  proximos: AgendamentoDetalheDTO[]
}

export interface AgendamentoQueries {
  listar(filtros: FiltrosDeAgendamento, agora: Date): Promise<Page<AgendamentoDetalheDTO>>
  detalhar(id: string, agora: Date): Promise<AgendamentoDetalheDTO | null>
  // RF14 - alertas exibidos na própria plataforma
  alertas(input: { usuarioId?: string, dias: number, agora: Date }): Promise<PainelDeAlertasDTO>
}
