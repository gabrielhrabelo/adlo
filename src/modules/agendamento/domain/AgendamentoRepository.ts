import type { Agendamento } from "./Agendamento.ts";

export interface AgendamentoRepository {
  save(agendamento: Agendamento): Promise<void>
  delete(agendamento: Agendamento): Promise<void>
  findById(id: string): Promise<Agendamento | null>
  // Agendamentos ativos do usuário que começam dentro da janela (candidatos a conflito)
  findAtivosDoUsuarioEntre(usuarioId: string, de: Date, ate: Date): Promise<Agendamento[]>
}
