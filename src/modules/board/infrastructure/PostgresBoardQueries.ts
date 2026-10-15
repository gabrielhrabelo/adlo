import type { PrismaClient } from "../../../generated/prisma/client.ts";
import type { BoardDetalheDTO, BoardQueries, BoardResumoDTO } from "../application/BoardQueries.ts";

export class PostgresBoardQueries implements BoardQueries {
  constructor(private readonly db: PrismaClient) {

  }

  async listar(filtros: { usuarioId?: string }): Promise<BoardResumoDTO[]> {
    const rows = await this.db.board.findMany({
      where: filtros.usuarioId ? { usuarioId: filtros.usuarioId } : {},
      orderBy: { criadoEm: 'asc' },
      include: {
        usuario: { select: { id: true, nome: true } },
        colunas: { select: { _count: { select: { cards: true } } } },
      },
    })

    return rows.map(row => ({
      id: row.id,
      nome: row.nome,
      usuario: row.usuario,
      totalColunas: row.colunas.length,
      totalCards: row.colunas.reduce((total, c) => total + c._count.cards, 0),
      createdAt: row.criadoEm.toISOString(),
    }))
  }

  async detalhar(id: string): Promise<BoardDetalheDTO | null> {
    const agora = new Date()
    const row = await this.db.board.findUnique({
      where: { id },
      include: {
        usuario: { select: { id: true, nome: true } },
        colunas: {
          orderBy: { ordem: 'asc' },
          include: {
            cards: {
              orderBy: { ordem: 'asc' },
              include: {
                processo: {
                  select: {
                    id: true,
                    numeroProcesso: true,
                    titulo: true,
                    area: true,
                    status: true,
                    cliente: { select: { id: true, nome: true } },
                    agendamentos: {
                      where: { status: { in: ['PENDENTE', 'CONFIRMADO'] }, dataHora: { gte: agora } },
                      orderBy: { dataHora: 'asc' },
                      take: 1,
                      select: { id: true, titulo: true, tipo: true, dataHora: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!row) return null

    return {
      id: row.id,
      nome: row.nome,
      usuario: row.usuario,
      createdAt: row.criadoEm.toISOString(),
      colunas: row.colunas.map(coluna => ({
        id: coluna.id,
        nome: coluna.nome,
        ordem: coluna.ordem,
        status: coluna.status,
        cards: coluna.cards.map(card => {
          const { agendamentos, ...processo } = card.processo
          const proximo = agendamentos[0]

          return {
            id: card.id,
            colunaId: card.colunaId,
            titulo: card.titulo,
            ordem: card.ordem,
            processo: {
              ...processo,
              proximoAgendamento: proximo
                ? { id: proximo.id, titulo: proximo.titulo, tipo: proximo.tipo, dataHora: proximo.dataHora.toISOString() }
                : null,
            },
          }
        }),
      })),
    }
  }
}
