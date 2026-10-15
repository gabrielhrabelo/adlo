import { AgendamentoNotFoundError } from "../domain/errors.ts";
import type { AgendamentoQueries, FiltrosDeAgendamento } from "./AgendamentoQueries.ts";
import { parseDataHora } from "./input.ts";
import type { Clock } from "./ports.ts";
import type { VerificadorDeHorario } from "./VerificadorDeHorario.ts";

export class ConsultarAgendamento {
  constructor(
    private readonly queries: AgendamentoQueries,
    private readonly verificador: VerificadorDeHorario,
    private readonly clock: Clock,
  ) { }

  async detalhar(id: string) {
    const agendamento = await this.queries.detalhar(id, this.clock())

    if (!agendamento) throw new AgendamentoNotFoundError()

    return agendamento
  }

  listar(filtros: FiltrosDeAgendamento) {
    return this.queries.listar(filtros, this.clock())
  }

  alertas(input: { usuarioId?: string, dias?: number }) {
    return this.queries.alertas({
      dias: input.dias ?? 7,
      agora: this.clock(),
      ...(input.usuarioId !== undefined && { usuarioId: input.usuarioId }),
    })
  }

  disponibilidade(input: { usuarioId: string, dataHora: string, duracaoMinutos?: number, ignorarId?: string }) {
    return this.verificador.disponibilidade({
      usuarioId: input.usuarioId,
      dataHora: parseDataHora(input.dataHora),
      duracaoMinutos: input.duracaoMinutos ?? 60,
      ...(input.ignorarId !== undefined && { ignorarId: input.ignorarId }),
    })
  }
}
