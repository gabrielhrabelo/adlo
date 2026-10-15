import type { EventBus } from "../../../shared/application/EventBus.ts";
import type { ProcessoRepository } from "../domain/ProcessoRepository.ts";
import type { StatusDoProcesso } from "../domain/enums.ts";
import { ProcessoNotFoundError } from "../domain/errors.ts";
import { toProcessoDTO } from "./dto.ts";

// RF08 - Atualizar status do processo (também usado pelo kanban, RF17,
// e para "Inativar processo", que arquiva o processo)
export class AlterarStatusDoProcesso {
  constructor(
    private readonly processos: ProcessoRepository,
    private readonly events: EventBus
  ) { }

  async execute(input: { id: string, status: StatusDoProcesso }) {
    const processo = await this.processos.findById(input.id)

    if (!processo) throw new ProcessoNotFoundError()

    processo.alterarStatus(input.status)
    await this.processos.save(processo)
    await this.events.publish(processo.pullEvents())

    return toProcessoDTO(processo)
  }
}
