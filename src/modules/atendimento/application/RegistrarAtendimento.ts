import type { EventBus } from "../../../shared/application/EventBus.ts";
import { Atendimento, type CanalDeAtendimento } from "../domain/Atendimento.ts";
import type { AtendimentoRepository } from "../domain/AtendimentoRepository.ts";
import { AtendimentoInvalidoError, ClienteDoAtendimentoNotFoundError, ProcessoDeOutroClienteError } from "../domain/errors.ts";
import { toAtendimentoDTO } from "./dto.ts";
import type { ReferenciasDoAtendimento } from "./ports.ts";

// RF10 - Registrar atendimento
export class RegistrarAtendimento {
  constructor(
    private readonly atendimentos: AtendimentoRepository,
    private readonly referencias: ReferenciasDoAtendimento,
    private readonly events: EventBus
  ) { }

  async execute(input: {
    clienteId: string
    usuarioLogadoId: string
    processoId?: string | null
    assunto: string
    conteudo: string
    canal?: CanalDeAtendimento
    ocorridoEm?: string
  }) {
    if (!(await this.referencias.clienteExiste(input.clienteId))) {
      throw new ClienteDoAtendimentoNotFoundError()
    }

    if (input.processoId) {
      const clienteDoProcesso = await this.referencias.clienteDoProcesso(input.processoId)
      if (clienteDoProcesso !== input.clienteId) throw new ProcessoDeOutroClienteError()
    }

    const atendimento = Atendimento.registrar({
      clienteId: input.clienteId,
      usuarioId: input.usuarioLogadoId,
      processoId: input.processoId ?? null,
      assunto: input.assunto,
      conteudo: input.conteudo,
      ...(input.canal && { canal: input.canal }),
      ...(input.ocorridoEm && { ocorridoEm: parseDateTime(input.ocorridoEm) }),
    })
    await this.atendimentos.save(atendimento)
    await this.events.publish(atendimento.pullEvents())

    return toAtendimentoDTO(atendimento)
  }
}

function parseDateTime(value: string): Date {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new AtendimentoInvalidoError(`Data inválida: "${value}"`)
  return date
}
