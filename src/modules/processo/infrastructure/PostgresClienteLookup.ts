import type { PrismaClient } from "../../../generated/prisma/client.ts";
import type { ClienteLookup, SituacaoDoCliente } from "../application/ports.ts";

export class PostgresClienteLookup implements ClienteLookup {
  constructor(private readonly db: PrismaClient) {

  }

  async situacao(clienteId: string): Promise<SituacaoDoCliente> {
    const row = await this.db.cliente.findUnique({ where: { id: clienteId }, select: { ativo: true } })

    if (!row) return 'nao_encontrado'
    return row.ativo ? 'ativo' : 'inativo'
  }
}
