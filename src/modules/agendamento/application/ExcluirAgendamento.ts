import type { EventBus } from "../../../shared/application/EventBus.ts";
import type { AgendamentoRepository } from "../domain/AgendamentoRepository.ts";
import { AgendamentoNotFoundError } from "../domain/errors.ts";

export class ExcluirAgendamento {
  constructor(
    private readonly agendamentos: AgendamentoRepository,
    private readonly events: EventBus,
  ) { }

  async execute(id: string): Promise<void> {
    const agendamento = await this.agendamentos.findById(id)

    if (!agendamento) throw new AgendamentoNotFoundError()

    agendamento.excluir()
    await this.agendamentos.delete(agendamento)
    await this.events.publish(agendamento.pullEvents())
  }
}
