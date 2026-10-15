import { Agendamento, DURACAO_MAXIMA_MINUTOS } from "../domain/Agendamento.ts";
import type { AgendamentoRepository } from "../domain/AgendamentoRepository.ts";
import { HorarioOcupadoError } from "../domain/errors.ts";

const MINUTO = 60 * 1000

// Caso de uso "Verificar se o horário está ocupado" (Figura 5)
export class VerificadorDeHorario {
  constructor(private readonly agendamentos: AgendamentoRepository) { }

  async conflitos(agendamento: Agendamento): Promise<Agendamento[]> {
    if (!agendamento.ocupaAgenda) return []

    // Um agendamento que começa até DURACAO_MAXIMA antes ainda pode sobrepor este
    const candidatos = await this.agendamentos.findAtivosDoUsuarioEntre(
      agendamento.usuarioId,
      new Date(agendamento.inicio - DURACAO_MAXIMA_MINUTOS * MINUTO),
      new Date(agendamento.fim),
    )

    return candidatos.filter(outro => agendamento.conflitaCom(outro))
  }

  async garantirLivre(agendamento: Agendamento): Promise<void> {
    const conflitos = await this.conflitos(agendamento)

    if (conflitos.length > 0) {
      throw new HorarioOcupadoError(conflitos.map(c => ({ id: c.id, titulo: c.titulo, dataHora: c.dataHora.toISOString() })))
    }
  }

  async disponibilidade(input: { usuarioId: string, dataHora: Date, duracaoMinutos: number, ignorarId?: string }) {
    const sonda = Agendamento.restore({
      id: input.ignorarId ?? 'disponibilidade',
      clienteId: '',
      usuarioId: input.usuarioId,
      processoId: null,
      titulo: '',
      tipo: 'COMPROMISSO',
      status: 'PENDENTE',
      dataHora: input.dataHora,
      duracaoMinutos: input.duracaoMinutos,
      lembrarEm: null,
      notificadoEm: null,
      concluidoEm: null,
      createdAt: input.dataHora,
    }, 0)
    const conflitos = await this.conflitos(sonda)

    return {
      livre: conflitos.length === 0,
      conflitos: conflitos.map(c => ({ id: c.id, titulo: c.titulo, dataHora: c.dataHora.toISOString(), duracaoMinutos: c.duracaoMinutos })),
    }
  }
}
