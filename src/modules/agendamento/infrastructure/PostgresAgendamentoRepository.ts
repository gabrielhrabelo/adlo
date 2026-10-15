import type { Agendamento as AgendamentoRow, PrismaClient } from "../../../generated/prisma/client.ts";
import { ConcurrencyError } from "../../../shared/domain/ConcurrencyError.ts";
import { isForeignKeyViolation, isRecordNotFound } from "../../../shared/infrastructure/prismaErrors.ts";
import { Agendamento, STATUS_ATIVOS } from "../domain/Agendamento.ts";
import type { AgendamentoRepository } from "../domain/AgendamentoRepository.ts";
import { AgendamentoInvalidoError, AgendamentoNotFoundError } from "../domain/errors.ts";

export class PostgresAgendamentoRepository implements AgendamentoRepository {
  constructor(private readonly db: PrismaClient) {

  }

  async save(agendamento: Agendamento): Promise<void> {
    const data = {
      clienteId: agendamento.clienteId,
      usuarioId: agendamento.usuarioId,
      processoId: agendamento.processoId,
      titulo: agendamento.titulo,
      tipo: agendamento.tipo,
      status: agendamento.status,
      dataHora: agendamento.dataHora,
      duracaoMinutos: agendamento.duracaoMinutos,
      lembrarEm: agendamento.lembrarEm,
      notificadoEm: agendamento.notificadoEm,
      concluidoEm: agendamento.concluidoEm,
    }

    try {
      if (agendamento.version === 0) {
        await this.db.agendamento.create({
          data: { ...data, id: agendamento.id, criadoEm: agendamento.createdAt, versao: 1 }
        })
        agendamento.markPersisted(1)
        return
      }

      const { count } = await this.db.agendamento.updateMany({
        where: { id: agendamento.id, versao: agendamento.version },
        data: { ...data, versao: { increment: 1 } }
      })

      if (count === 0) throw new ConcurrencyError('Agendamento')

      agendamento.markPersisted(agendamento.version + 1)
    } catch (err) {
      if (isForeignKeyViolation(err)) throw new AgendamentoInvalidoError('Cliente, usuário ou processo não encontrado')
      throw err
    }
  }

  async delete(agendamento: Agendamento): Promise<void> {
    try {
      await this.db.agendamento.delete({ where: { id: agendamento.id } })
    } catch (err) {
      if (isRecordNotFound(err)) throw new AgendamentoNotFoundError()
      throw err
    }
  }

  async findById(id: string): Promise<Agendamento | null> {
    const row = await this.db.agendamento.findUnique({ where: { id } })

    return row ? toDomain(row) : null
  }

  async findAtivosDoUsuarioEntre(usuarioId: string, de: Date, ate: Date): Promise<Agendamento[]> {
    const rows = await this.db.agendamento.findMany({
      where: {
        usuarioId,
        status: { in: [...STATUS_ATIVOS] },
        dataHora: { gte: de, lt: ate },
      },
      orderBy: { dataHora: 'asc' },
    })

    return rows.map(toDomain)
  }
}

export function toDomain(row: AgendamentoRow): Agendamento {
  return Agendamento.restore({
    id: row.id,
    clienteId: row.clienteId,
    usuarioId: row.usuarioId,
    processoId: row.processoId,
    titulo: row.titulo,
    tipo: row.tipo,
    status: row.status,
    dataHora: row.dataHora,
    duracaoMinutos: row.duracaoMinutos,
    lembrarEm: row.lembrarEm,
    notificadoEm: row.notificadoEm,
    concluidoEm: row.concluidoEm,
    createdAt: row.criadoEm,
  }, row.versao)
}
