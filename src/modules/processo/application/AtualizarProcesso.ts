import type { EventBus } from "../../../shared/application/EventBus.ts";
import type { ProcessoRepository } from "../domain/ProcessoRepository.ts";
import { NumeroProcessoEmUsoError, ProcessoNotFoundError } from "../domain/errors.ts";
import { toProcessoDTO } from "./dto.ts";
import { parseDadosDoProcesso, type DadosDoProcessoInput } from "./input.ts";

// RF07 - Editar processo
export class AtualizarProcesso {
  constructor(
    private readonly processos: ProcessoRepository,
    private readonly events: EventBus
  ) { }

  async execute(input: DadosDoProcessoInput & { id: string }) {
    const processo = await this.processos.findById(input.id)

    if (!processo) throw new ProcessoNotFoundError()

    const dados = parseDadosDoProcesso(input)

    if (dados.numeroProcesso && dados.numeroProcesso.value !== processo.numeroProcesso) {
      const outro = await this.processos.findByNumero(dados.numeroProcesso.value)
      if (outro && outro.id !== processo.id) throw new NumeroProcessoEmUsoError()
    }

    processo.atualizar(dados)
    await this.processos.save(processo)
    await this.events.publish(processo.pullEvents())

    return toProcessoDTO(processo)
  }
}
