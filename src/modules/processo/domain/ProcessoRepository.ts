import type { Processo } from "./Processo.ts";

export interface ProcessoRepository {
  save(processo: Processo): Promise<void>
  findById(id: string): Promise<Processo | null>
  findByNumero(numeroProcesso: string): Promise<Processo | null>
  // Agendamentos e atendimentos são histórico do cliente e impedem a exclusão física
  possuiVinculos(id: string): Promise<boolean>
  delete(id: string): Promise<void>
}
