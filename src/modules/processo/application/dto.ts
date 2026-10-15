import type { Processo } from "../domain/Processo.ts";
import type { AreaDoProcesso, StatusDoProcesso } from "../domain/enums.ts";

export interface ProcessoDTO {
  id: string
  clienteId: string
  numeroProcesso: string | null
  titulo: string
  area: AreaDoProcesso
  status: StatusDoProcesso
  tribunal: string | null
  descricao: string | null
  dataAbertura: string
  createdAt: string
}

export function toProcessoDTO(processo: Processo): ProcessoDTO {
  return {
    id: processo.id,
    clienteId: processo.clienteId,
    numeroProcesso: processo.numeroProcesso,
    titulo: processo.titulo,
    area: processo.area,
    status: processo.status,
    tribunal: processo.tribunal,
    descricao: processo.descricao,
    dataAbertura: processo.dataAbertura.toISOString().slice(0, 10),
    createdAt: processo.createdAt.toISOString(),
  }
}
