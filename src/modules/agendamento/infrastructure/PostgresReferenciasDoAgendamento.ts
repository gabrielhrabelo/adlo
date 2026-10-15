import type { PrismaClient } from "../../../generated/prisma/client.ts";
import type { Referencias } from "../application/ports.ts";

export class PostgresReferenciasDoAgendamento implements Referencias {
  constructor(private readonly db: PrismaClient) {

  }

  cliente(id: string): Promise<{ ativo: boolean } | null> {
    return this.db.cliente.findUnique({ where: { id }, select: { ativo: true } })
  }

  processo(id: string): Promise<{ clienteId: string } | null> {
    return this.db.processo.findUnique({ where: { id }, select: { clienteId: true } })
  }

  usuario(id: string): Promise<{ ativo: boolean } | null> {
    return this.db.usuario.findUnique({ where: { id }, select: { ativo: true } })
  }
}
