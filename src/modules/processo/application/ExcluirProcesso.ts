import type { EventBus } from "../../../shared/application/EventBus.ts";
import type { ProcessoRepository } from "../domain/ProcessoRepository.ts";
import { ProcessoComVinculosError, ProcessoNotFoundError } from "../domain/errors.ts";

// RF09 - Excluir processo. A exclusão física só é permitida para processos sem
// histórico (agendamentos ou atendimentos); nos demais casos o processo deve ser arquivado.
export class ExcluirProcesso {
  constructor(
    private readonly processos: ProcessoRepository,
    private readonly events: EventBus
  ) { }

  async execute(id: string): Promise<void> {
    const processo = await this.processos.findById(id)

    if (!processo) throw new ProcessoNotFoundError()

    if (await this.processos.possuiVinculos(id)) throw new ProcessoComVinculosError()

    processo.marcarExcluido()
    await this.processos.delete(id)
    await this.events.publish(processo.pullEvents())
  }
}
