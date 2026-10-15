import type { TipoDeAgendamento } from "../domain/Agendamento.ts";
import { AgendamentoInvalidoError } from "../domain/errors.ts";

export interface DadosDoAgendamentoInput {
  usuarioId?: string
  processoId?: string | null
  titulo?: string
  tipo?: TipoDeAgendamento
  dataHora?: string
  duracaoMinutos?: number
  antecedenciaMinutos?: number
}

export function parseDataHora(value: string): Date {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) throw new AgendamentoInvalidoError(`Data e hora inválidas: "${value}"`)

  return date
}
