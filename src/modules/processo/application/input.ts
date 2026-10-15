import type { DadosDoProcesso } from "../domain/Processo.ts";
import type { AreaDoProcesso } from "../domain/enums.ts";
import { ProcessoInvalidoError } from "../domain/errors.ts";
import { NumeroProcesso } from "../domain/NumeroProcesso.ts";

export interface DadosDoProcessoInput {
  numeroProcesso?: string | null
  titulo?: string
  area?: AreaDoProcesso
  tribunal?: string | null
  descricao?: string | null
  dataAbertura?: string
}

export function parseDadosDoProcesso(input: DadosDoProcessoInput): DadosDoProcesso {
  const dados: DadosDoProcesso = {}

  if (input.numeroProcesso !== undefined) {
    dados.numeroProcesso = input.numeroProcesso ? NumeroProcesso.create(input.numeroProcesso) : null
  }
  if (input.titulo !== undefined) dados.titulo = input.titulo
  if (input.area !== undefined) dados.area = input.area
  if (input.tribunal !== undefined) dados.tribunal = input.tribunal
  if (input.descricao !== undefined) dados.descricao = input.descricao
  if (input.dataAbertura !== undefined) dados.dataAbertura = parseDate(input.dataAbertura)

  return dados
}

function parseDate(value: string): Date {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) throw new ProcessoInvalidoError(`Data inválida: "${value}"`)

  return date
}
