import type { PrismaClient } from "../../../generated/prisma/client.ts";
import type { ReferenciasDoDocumento, SituacaoDoCliente } from "../application/ports.ts";

export class PostgresReferenciasDoDocumento implements ReferenciasDoDocumento {
  constructor(private readonly db: PrismaClient) {

  }

  async situacaoDoCliente(clienteId: string): Promise<SituacaoDoCliente> {
    const row = await this.db.cliente.findUnique({ where: { id: clienteId }, select: { ativo: true } })

    if (!row) return 'nao_encontrado'
    return row.ativo ? 'ativo' : 'inativo'
  }

  async ehAdvogado(usuarioId: string): Promise<boolean> {
    const usuario = await this.db.usuario.findUnique({ where: { id: usuarioId }, select: { papel: true, ativo: true } })

    return usuario?.ativo === true && usuario.papel === 'ADVOGADO'
  }
}
