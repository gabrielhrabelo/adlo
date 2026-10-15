import type { Atendimento, CanalDeAtendimento } from "../domain/Atendimento.ts";

export interface AtendimentoDTO {
  id: string
  clienteId: string
  usuarioId: string | null
  processoId: string | null
  assunto: string
  conteudo: string
  canal: CanalDeAtendimento
  ocorridoEm: string
  createdAt: string
}

export function toAtendimentoDTO(atendimento: Atendimento): AtendimentoDTO {
  return {
    id: atendimento.id,
    clienteId: atendimento.clienteId,
    usuarioId: atendimento.usuarioId,
    processoId: atendimento.processoId,
    assunto: atendimento.assunto,
    conteudo: atendimento.conteudo,
    canal: atendimento.canal,
    ocorridoEm: atendimento.ocorridoEm.toISOString(),
    createdAt: atendimento.createdAt.toISOString(),
  }
}
