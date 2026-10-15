import type { StatusDoProcesso } from "../domain/StatusDoProcesso.ts";

// Acesso ao módulo de processos: o kanban não altera o processo diretamente,
// delega ao caso de uso "Atualizar status do processo" (RF08/RF17)
export interface ProcessosDoBoard {
  resumo(processoId: string): Promise<{ titulo: string, numeroProcesso: string | null, status: StatusDoProcesso } | null>
  alterarStatus(processoId: string, status: StatusDoProcesso): Promise<void>
}
