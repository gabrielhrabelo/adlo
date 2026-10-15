import type { EventBus } from "../../../shared/application/EventBus.ts";
import type { AlteracaoDeAgendamento } from "../domain/Agendamento.ts";
import type { AgendamentoRepository } from "../domain/AgendamentoRepository.ts";
import { AgendamentoNotFoundError } from "../domain/errors.ts";
import { toAgendamentoDTO } from "./dto.ts";
import { parseDataHora, type DadosDoAgendamentoInput } from "./input.ts";
import type { Clock, Referencias } from "./ports.ts";
import { validarProcesso, validarUsuario } from "./validarReferencias.ts";
import type { VerificadorDeHorario } from "./VerificadorDeHorario.ts";

export class AlterarAgendamento {
  constructor(
    private readonly agendamentos: AgendamentoRepository,
    private readonly verificador: VerificadorDeHorario,
    private readonly referencias: Referencias,
    private readonly events: EventBus,
    private readonly clock: Clock,
  ) { }

  async execute(input: DadosDoAgendamentoInput & { id: string }) {
    const agendamento = await this.agendamentos.findById(input.id)

    if (!agendamento) throw new AgendamentoNotFoundError()

    if (input.usuarioId !== undefined && input.usuarioId !== agendamento.usuarioId) {
      await validarUsuario(this.referencias, input.usuarioId)
    }
    if (input.processoId) await validarProcesso(this.referencias, input.processoId, agendamento.clienteId)

    const alteracao: AlteracaoDeAgendamento = {}
    if (input.usuarioId !== undefined) alteracao.usuarioId = input.usuarioId
    if (input.processoId !== undefined) alteracao.processoId = input.processoId
    if (input.titulo !== undefined) alteracao.titulo = input.titulo
    if (input.tipo !== undefined) alteracao.tipo = input.tipo
    if (input.dataHora !== undefined) alteracao.dataHora = parseDataHora(input.dataHora)
    if (input.duracaoMinutos !== undefined) alteracao.duracaoMinutos = input.duracaoMinutos
    if (input.antecedenciaMinutos !== undefined) alteracao.antecedenciaMinutos = input.antecedenciaMinutos

    agendamento.alterar(alteracao, this.clock())

    await this.verificador.garantirLivre(agendamento)
    await this.agendamentos.save(agendamento)
    await this.events.publish(agendamento.pullEvents())

    return toAgendamentoDTO(agendamento)
  }
}
