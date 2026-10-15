import type { Agendamento, StatusDoAgendamento, TipoDeAgendamento } from "../domain/Agendamento.ts";

export interface AgendamentoDTO {
  id: string
  clienteId: string
  usuarioId: string
  processoId: string | null
  titulo: string
  tipo: TipoDeAgendamento
  status: StatusDoAgendamento
  dataHora: string
  duracaoMinutos: number
  antecedenciaMinutos: number
  lembrarEm: string | null
  notificadoEm: string | null
  concluidoEm: string | null
  createdAt: string
}

export function toAgendamentoDTO(agendamento: Agendamento): AgendamentoDTO {
  return {
    id: agendamento.id,
    clienteId: agendamento.clienteId,
    usuarioId: agendamento.usuarioId,
    processoId: agendamento.processoId,
    titulo: agendamento.titulo,
    tipo: agendamento.tipo,
    status: agendamento.status,
    dataHora: agendamento.dataHora.toISOString(),
    duracaoMinutos: agendamento.duracaoMinutos,
    antecedenciaMinutos: agendamento.antecedenciaMinutos,
    lembrarEm: agendamento.lembrarEm?.toISOString() ?? null,
    notificadoEm: agendamento.notificadoEm?.toISOString() ?? null,
    concluidoEm: agendamento.concluidoEm?.toISOString() ?? null,
    createdAt: agendamento.createdAt.toISOString(),
  }
}
