import type { Atendimento } from "./Atendimento.ts";

export interface AtendimentoRepository {
  save(atendimento: Atendimento): Promise<void>
  findById(id: string): Promise<Atendimento | null>
  delete(atendimento: Atendimento): Promise<void>
}
