import type { Prisma, PrismaClient } from "../../../generated/prisma/client.ts";
import { ConcurrencyError } from "../../../shared/domain/ConcurrencyError.ts";
import { isForeignKeyViolation, isRecordNotFound, isUniqueViolation } from "../../../shared/infrastructure/prismaErrors.ts";
import { Board } from "../domain/Board.ts";
import type { BoardRepository } from "../domain/BoardRepository.ts";
import { BoardInvalidoError, BoardNotFoundError, ProcessoDoCardNotFoundError } from "../domain/errors.ts";

const include = { colunas: { include: { cards: true } } } as const

type BoardRow = Prisma.BoardGetPayload<{ include: typeof include }>

export class PostgresBoardRepository implements BoardRepository {
  constructor(private readonly db: PrismaClient) {

  }

  async save(board: Board): Promise<void> {
    const colunas = board.colunas.map(c => ({ id: c.id, boardId: board.id, nome: c.nome, ordem: c.ordem, status: c.status }))
    const cards = board.cards.map(c => ({ id: c.id, colunaId: c.colunaId, processoId: c.processoId, titulo: c.titulo, ordem: c.ordem }))

    try {
      await this.db.$transaction(async (tx) => {
        if (board.version === 0) {
          await tx.board.create({
            data: { id: board.id, usuarioId: board.usuarioId, nome: board.nome, criadoEm: board.createdAt, versao: 1 }
          })
        } else {
          const { count } = await tx.board.updateMany({
            where: { id: board.id, versao: board.version },
            data: { nome: board.nome, versao: { increment: 1 } }
          })

          if (count === 0) throw new ConcurrencyError('Board')

          // Colunas e cards pertencem ao agregado: são substituídos por inteiro
          await tx.card.deleteMany({ where: { coluna: { boardId: board.id } } })
          await tx.coluna.deleteMany({ where: { boardId: board.id } })
        }

        await tx.coluna.createMany({ data: colunas })
        await tx.card.createMany({ data: cards })
      })
      board.markPersisted(board.version + 1)
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        throw board.version === 0 ? new BoardInvalidoError('Usuário não encontrado') : new ProcessoDoCardNotFoundError()
      }
      if (isUniqueViolation(err)) throw new ConcurrencyError('Board')
      throw err
    }
  }

  async findById(id: string): Promise<Board | null> {
    const row = await this.db.board.findUnique({ where: { id }, include })

    return row ? toDomain(row) : null
  }

  async findByProcesso(processoId: string): Promise<Board[]> {
    const rows = await this.db.board.findMany({
      where: { colunas: { some: { cards: { some: { processoId } } } } },
      include,
    })

    return rows.map(toDomain)
  }

  async delete(board: Board): Promise<void> {
    try {
      // Colunas e cards são removidos em cascata
      await this.db.board.delete({ where: { id: board.id } })
    } catch (err) {
      if (isRecordNotFound(err)) throw new BoardNotFoundError()
      throw err
    }
  }
}

function toDomain(row: BoardRow): Board {
  return Board.restore({
    id: row.id,
    usuarioId: row.usuarioId,
    nome: row.nome,
    colunas: row.colunas.map(c => ({ id: c.id, nome: c.nome, ordem: c.ordem, status: c.status })),
    cards: row.colunas.flatMap(c => c.cards.map(card => ({
      id: card.id,
      colunaId: card.colunaId,
      processoId: card.processoId,
      titulo: card.titulo,
      ordem: card.ordem,
    }))),
    createdAt: row.criadoEm,
  }, row.versao)
}
