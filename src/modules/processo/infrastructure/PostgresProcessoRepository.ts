import type { PrismaClient, Processo as ProcessoRow } from "../../../generated/prisma/client.ts";
import { ConcurrencyError } from "../../../shared/domain/ConcurrencyError.ts";
import { isForeignKeyViolation, isRecordNotFound, isUniqueViolation } from "../../../shared/infrastructure/prismaErrors.ts";
import { Processo } from "../domain/Processo.ts";
import type { ProcessoRepository } from "../domain/ProcessoRepository.ts";
import { ClienteDoProcessoInvalidoError, NumeroProcessoEmUsoError, ProcessoComVinculosError, ProcessoNotFoundError } from "../domain/errors.ts";

export class PostgresProcessoRepository implements ProcessoRepository {
  constructor(private readonly db: PrismaClient) {

  }

  async save(processo: Processo): Promise<void> {
    const data = {
      clienteId: processo.clienteId,
      numeroProcesso: processo.numeroProcesso,
      titulo: processo.titulo,
      area: processo.area,
      status: processo.status,
      tribunal: processo.tribunal,
      descricao: processo.descricao,
      dataAbertura: processo.dataAbertura,
    }

    try {
      if (processo.version === 0) {
        await this.db.processo.create({
          data: { ...data, id: processo.id, criadoEm: processo.createdAt, versao: 1 }
        })
        processo.markPersisted(1)
        return
      }

      const { count } = await this.db.processo.updateMany({
        where: { id: processo.id, versao: processo.version },
        data: { ...data, versao: { increment: 1 } }
      })

      if (count === 0) throw new ConcurrencyError('Processo')

      processo.markPersisted(processo.version + 1)
    } catch (err) {
      if (isUniqueViolation(err)) throw new NumeroProcessoEmUsoError()
      if (isForeignKeyViolation(err)) throw new ClienteDoProcessoInvalidoError('nao_encontrado')
      throw err
    }
  }

  async findById(id: string): Promise<Processo | null> {
    const row = await this.db.processo.findUnique({ where: { id } })

    return row ? toDomain(row) : null
  }

  async findByNumero(numeroProcesso: string): Promise<Processo | null> {
    const row = await this.db.processo.findUnique({ where: { numeroProcesso } })

    return row ? toDomain(row) : null
  }

  async possuiVinculos(id: string): Promise<boolean> {
    const [agendamentos, atendimentos] = await Promise.all([
      this.db.agendamento.count({ where: { processoId: id } }),
      this.db.atendimento.count({ where: { processoId: id } }),
    ])

    return agendamentos + atendimentos > 0
  }

  async delete(id: string): Promise<void> {
    try {
      // Cards do kanban vinculados são removidos em cascata
      await this.db.processo.delete({ where: { id } })
    } catch (err) {
      if (isRecordNotFound(err)) throw new ProcessoNotFoundError()
      if (isForeignKeyViolation(err)) throw new ProcessoComVinculosError()
      throw err
    }
  }
}

function toDomain(row: ProcessoRow): Processo {
  return Processo.restore({
    id: row.id,
    clienteId: row.clienteId,
    numeroProcesso: row.numeroProcesso,
    titulo: row.titulo,
    area: row.area,
    status: row.status,
    tribunal: row.tribunal,
    descricao: row.descricao,
    dataAbertura: row.dataAbertura,
    createdAt: row.criadoEm,
  }, row.versao)
}
