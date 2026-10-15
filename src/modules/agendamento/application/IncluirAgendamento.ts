import type { EventBus } from "../../../shared/application/EventBus.ts";
import { Agendamento } from "../domain/Agendamento.ts";
import type { AgendamentoRepository } from "../domain/AgendamentoRepository.ts";
import { AgendamentoInvalidoError, ReferenciaNaoEncontradaError } from "../domain/errors.ts";
import { toAgendamentoDTO } from "./dto.ts";
import { parseDataHora, type DadosDoAgendamentoInput } from "./input.ts";
import type { Clock, Referencias } from "./ports.ts";
import { validarProcesso, validarUsuario } from "./validarReferencias.ts";
import type { VerificadorDeHorario } from "./VerificadorDeHorario.ts";

export class IncluirAgendamento {
  constructor(
    private readonly agendamentos: AgendamentoRepository,
    private readonly verificador: VerificadorDeHorario,
    private readonly referencias: Referencias,
    private readonly events: EventBus,
    private readonly clock: Clock,
  ) { }

  async execute(input: DadosDoAgendamentoInput & {
    clienteId: string
    titulo: string
    dataHora: string
    usuarioLogadoId: string
  }) {
    const cliente = await this.referencias.cliente(input.clienteId)

    if (!cliente) throw new ReferenciaNaoEncontradaError('Cliente')
    if (!cliente.ativo) throw new AgendamentoInvalidoError('Não é possível agendar para um cliente inativo')

    // Por padrão o responsável é quem agendou
    const usuarioId = input.usuarioId ?? input.usuarioLogadoId
    await validarUsuario(this.referencias, usuarioId)

    if (input.processoId) await validarProcesso(this.referencias, input.processoId, input.clienteId)

    const agendamento = Agendamento.create({
      clienteId: input.clienteId,
      usuarioId,
      processoId: input.processoId ?? null,
      titulo: input.titulo,
      dataHora: parseDataHora(input.dataHora),
      ...(input.tipo !== undefined && { tipo: input.tipo }),
      ...(input.duracaoMinutos !== undefined && { duracaoMinutos: input.duracaoMinutos }),
      ...(input.antecedenciaMinutos !== undefined && { antecedenciaMinutos: input.antecedenciaMinutos }),
    }, this.clock())

    await this.verificador.garantirLivre(agendamento)
    await this.agendamentos.save(agendamento)
    await this.events.publish(agendamento.pullEvents())

    return toAgendamentoDTO(agendamento)
  }
}
