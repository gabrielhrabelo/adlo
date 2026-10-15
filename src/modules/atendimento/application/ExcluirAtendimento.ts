import type { EventBus } from "../../../shared/application/EventBus.ts";
import type { AtendimentoRepository } from "../domain/AtendimentoRepository.ts";
import { AtendimentoNotFoundError } from "../domain/errors.ts";
import type { ReferenciasDoAtendimento } from "./ports.ts";

export class ExcluirAtendimento {
  constructor(
    private readonly atendimentos: AtendimentoRepository,
    private readonly referencias: ReferenciasDoAtendimento,
    private readonly events: EventBus
  ) { }

  async execute(input: { id: string, clienteId?: string, usuarioLogadoId: string }): Promise<void> {
    const atendimento = await this.atendimentos.findById(input.id)

    if (!atendimento || (input.clienteId && atendimento.clienteId !== input.clienteId)) {
      throw new AtendimentoNotFoundError()
    }

    atendimento.excluir({
      usuarioId: input.usuarioLogadoId,
      ehAdvogado: await this.referencias.ehAdvogado(input.usuarioLogadoId),
    })
    await this.atendimentos.delete(atendimento)
    await this.events.publish(atendimento.pullEvents())
  }
}
