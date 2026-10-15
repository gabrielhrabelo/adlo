import type { PrismaClient } from "../../../generated/prisma/client.ts";
import type { ReferenciasDoAtendimento } from "../application/ports.ts";

export class PostgresReferenciasDoAtendimento implements ReferenciasDoAtendimento {
  constructor(private readonly db: PrismaClient) {

  }

  async clienteExiste(clienteId: string): Promise<boolean> {
    return (await this.db.cliente.count({ where: { id: clienteId } })) > 0
  }

  async clienteDoProcesso(processoId: string): Promise<string | null> {
    const processo = await this.db.processo.findUnique({ where: { id: processoId }, select: { clienteId: true } })

    return processo?.clienteId ?? null
  }

  async ehAdvogado(usuarioId: string): Promise<boolean> {
    const usuario = await this.db.usuario.findUnique({ where: { id: usuarioId }, select: { papel: true, ativo: true } })

    return usuario?.ativo === true && usuario.papel === 'ADVOGADO'
  }
}
