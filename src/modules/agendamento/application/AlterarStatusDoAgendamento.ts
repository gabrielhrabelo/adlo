import type { EventBus } from "../../../shared/application/EventBus.ts";
import type { AgendamentoRepository } from "../domain/AgendamentoRepository.ts";
import { AgendamentoNotFoundError } from "../domain/errors.ts";
import { toAgendamentoDTO } from "./dto.ts";
import type { Clock } from "./ports.ts";

export type AcaoDeStatus = 'confirmar' | 'concluir' | 'cancelar'

// "Marcar agendamento como concluído" (Figura 5) e confirmar()/cancelar() do diagrama de classes
export class AlterarStatusDoAgendamento {
  constructor(
    private readonly agendamentos: AgendamentoRepository,
    private readonly events: EventBus,
    private readonly clock: Clock,
  ) { }

  async execute(input: { id: string, acao: AcaoDeStatus }) {
    const agendamento = await this.agendamentos.findById(input.id)

    if (!agendamento) throw new AgendamentoNotFoundError()

    switch (input.acao) {
      case 'confirmar': agendamento.confirmar(); break
      case 'concluir': agendamento.concluir(this.clock()); break
      case 'cancelar': agendamento.cancelar(); break
    }

    await this.agendamentos.save(agendamento)
    await this.events.publish(agendamento.pullEvents())

    return toAgendamentoDTO(agendamento)
  }
}
