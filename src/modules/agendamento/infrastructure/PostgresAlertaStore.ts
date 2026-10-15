import type { PrismaClient } from "../../../generated/prisma/client.ts";
import type { AlertaDeAgendamento, AlertaStore } from "../application/ports.ts";
import { STATUS_ATIVOS } from "../domain/Agendamento.ts";

export class PostgresAlertaStore implements AlertaStore {
  constructor(private readonly db: PrismaClient) {

  }

  async pendentes(agora: Date, limite: number): Promise<AlertaDeAgendamento[]> {
    const rows = await this.db.agendamento.findMany({
      where: {
        status: { in: [...STATUS_ATIVOS] },
        lembrarEm: { lte: agora },
        notificadoEm: null,
        usuario: { ativo: true },
      },
      orderBy: { lembrarEm: 'asc' },
      take: limite,
      include: {
        cliente: { select: { id: true, nome: true } },
        processo: { select: { id: true, titulo: true, numeroProcesso: true } },
        usuario: { select: { id: true, nome: true, email: true } },
      },
    })

    return rows.map(row => ({
      agendamentoId: row.id,
      titulo: row.titulo,
      tipo: row.tipo,
      dataHora: row.dataHora,
      duracaoMinutos: row.duracaoMinutos,
      cliente: row.cliente,
      processo: row.processo,
      destinatario: row.usuario,
    }))
  }

  // Incrementa a versão para que uma edição concorrente, carregada antes da
  // reserva, falhe em vez de sobrescrever notificadoEm e duplicar o alerta
  async reservar(agendamentoId: string, agora: Date): Promise<boolean> {
    const { count } = await this.db.agendamento.updateMany({
      where: { id: agendamentoId, notificadoEm: null },
      data: { notificadoEm: agora, versao: { increment: 1 } },
    })

    return count === 1
  }

  async liberar(agendamentoId: string, reservadoEm: Date): Promise<void> {
    await this.db.agendamento.updateMany({
      where: { id: agendamentoId, notificadoEm: reservadoEm },
      data: { notificadoEm: null, versao: { increment: 1 } },
    })
  }
}
