import type { PrismaClient } from "../../../generated/prisma/client.ts";
import type { ProcessosDoBoard } from "../application/ports.ts";
import type { StatusDoProcesso } from "../domain/StatusDoProcesso.ts";

export class PostgresProcessosDoBoard implements ProcessosDoBoard {
  constructor(
    private readonly db: PrismaClient,
    // Caso de uso do módulo de processos, injetado na composição da aplicação
    private readonly alterarStatusDoProcesso: (input: { id: string, status: StatusDoProcesso }) => Promise<unknown>
  ) {

  }

  resumo(processoId: string) {
    return this.db.processo.findUnique({
      where: { id: processoId },
      select: { titulo: true, numeroProcesso: true, status: true },
    })
  }

  async alterarStatus(processoId: string, status: StatusDoProcesso): Promise<void> {
    await this.alterarStatusDoProcesso({ id: processoId, status })
  }
}
