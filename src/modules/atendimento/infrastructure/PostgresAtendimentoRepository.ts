import type { Atendimento as AtendimentoRow, PrismaClient } from "../../../generated/prisma/client.ts";
import { isForeignKeyViolation, isRecordNotFound } from "../../../shared/infrastructure/prismaErrors.ts";
import { Atendimento } from "../domain/Atendimento.ts";
import type { AtendimentoRepository } from "../domain/AtendimentoRepository.ts";
import { AtendimentoInvalidoError, AtendimentoNotFoundError } from "../domain/errors.ts";

export class PostgresAtendimentoRepository implements AtendimentoRepository {
  constructor(private readonly db: PrismaClient) {

  }

  // Atendimentos são imutáveis: só existe inserção
  async save(atendimento: Atendimento): Promise<void> {
    if (atendimento.version !== 0) return

    try {
      await this.db.atendimento.create({
        data: {
          id: atendimento.id,
          clienteId: atendimento.clienteId,
          usuarioId: atendimento.usuarioId,
          processoId: atendimento.processoId,
          assunto: atendimento.assunto,
          conteudo: atendimento.conteudo,
          canal: atendimento.canal,
          ocorridoEm: atendimento.ocorridoEm,
          criadoEm: atendimento.createdAt,
        }
      })
      atendimento.markPersisted(1)
    } catch (err) {
      if (isForeignKeyViolation(err)) throw new AtendimentoInvalidoError('Cliente, usuário ou processo não encontrado')
      throw err
    }
  }

  async findById(id: string): Promise<Atendimento | null> {
    const row = await this.db.atendimento.findUnique({ where: { id } })

    return row ? toDomain(row) : null
  }

  async delete(atendimento: Atendimento): Promise<void> {
    try {
      await this.db.atendimento.delete({ where: { id: atendimento.id } })
    } catch (err) {
      if (isRecordNotFound(err)) throw new AtendimentoNotFoundError()
      throw err
    }
  }
}

function toDomain(row: AtendimentoRow): Atendimento {
  return Atendimento.restore({
    id: row.id,
    clienteId: row.clienteId,
    usuarioId: row.usuarioId,
    processoId: row.processoId,
    assunto: row.assunto,
    conteudo: row.conteudo,
    canal: row.canal,
    ocorridoEm: row.ocorridoEm,
    createdAt: row.criadoEm,
  })
}
