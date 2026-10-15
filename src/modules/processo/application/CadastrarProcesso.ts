import type { EventBus } from "../../../shared/application/EventBus.ts";
import { Processo } from "../domain/Processo.ts";
import type { ProcessoRepository } from "../domain/ProcessoRepository.ts";
import type { AreaDoProcesso, StatusDoProcesso } from "../domain/enums.ts";
import { ClienteDoProcessoInvalidoError, NumeroProcessoEmUsoError } from "../domain/errors.ts";
import { toProcessoDTO } from "./dto.ts";
import { parseDadosDoProcesso, type DadosDoProcessoInput } from "./input.ts";
import type { ClienteLookup } from "./ports.ts";

// RF06 - Cadastrar processo
export class CadastrarProcesso {
  constructor(
    private readonly processos: ProcessoRepository,
    private readonly clientes: ClienteLookup,
    private readonly events: EventBus
  ) { }

  async execute(input: DadosDoProcessoInput & {
    clienteId: string
    titulo: string
    area: AreaDoProcesso
    status?: StatusDoProcesso
  }) {
    const situacao = await this.clientes.situacao(input.clienteId)

    if (situacao !== 'ativo') throw new ClienteDoProcessoInvalidoError(situacao)

    const dados = parseDadosDoProcesso(input)

    if (dados.numeroProcesso && await this.processos.findByNumero(dados.numeroProcesso.value)) {
      throw new NumeroProcessoEmUsoError()
    }

    const processo = Processo.create({
      ...dados,
      clienteId: input.clienteId,
      titulo: input.titulo,
      area: input.area,
      ...(input.status && { status: input.status }),
    })
    await this.processos.save(processo)
    await this.events.publish(processo.pullEvents())

    return toProcessoDTO(processo)
  }
}
