import type { Prisma, PrismaClient } from "../../../generated/prisma/client.ts";
import { normalizePage, type Page } from "../../../shared/application/Pagination.ts";
import type { AtendimentoHistoricoDTO, AtendimentoQueries, FiltrosDeAtendimento } from "../application/AtendimentoQueries.ts";

const include = {
  usuario: { select: { id: true, nome: true } },
  processo: { select: { id: true, titulo: true, numeroProcesso: true } },
} as const

type Row = Prisma.AtendimentoGetPayload<{ include: typeof include }>

export class PostgresAtendimentoQueries implements AtendimentoQueries {
  constructor(private readonly db: PrismaClient) {

  }

  async historico(filtros: FiltrosDeAtendimento): Promise<Page<AtendimentoHistoricoDTO>> {
    const { page, pageSize, skip } = normalizePage(filtros)
    const where = buildWhere(filtros)

    const [total, rows] = await Promise.all([
      this.db.atendimento.count({ where }),
      this.db.atendimento.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ ocorridoEm: 'desc' }, { criadoEm: 'desc' }],
        include,
      }),
    ])

    return { total, page, pageSize, items: rows.map(toDTO) }
  }

  async detalhar(id: string): Promise<AtendimentoHistoricoDTO | null> {
    const row = await this.db.atendimento.findUnique({ where: { id }, include })

    return row ? toDTO(row) : null
  }
}

function buildWhere(filtros: FiltrosDeAtendimento): Prisma.AtendimentoWhereInput {
  const where: Prisma.AtendimentoWhereInput = { clienteId: filtros.clienteId }
  const busca = filtros.busca?.trim()

  if (filtros.canal) where.canal = filtros.canal
  if (filtros.processoId) where.processoId = filtros.processoId
  if (filtros.de || filtros.ate) {
    where.ocorridoEm = {
      ...(filtros.de && { gte: new Date(filtros.de) }),
      ...(filtros.ate && { lte: fimDoPeriodo(filtros.ate) }),
    }
  }
  if (busca) {
    where.OR = [
      { assunto: { contains: busca, mode: 'insensitive' } },
      { conteudo: { contains: busca, mode: 'insensitive' } },
    ]
  }
  return where
}

// "ate" só com a data inclui o dia inteiro
function fimDoPeriodo(ate: string): Date {
  return ate.length === 10 ? new Date(`${ate}T23:59:59.999Z`) : new Date(ate)
}

function toDTO(row: Row): AtendimentoHistoricoDTO {
  return {
    id: row.id,
    clienteId: row.clienteId,
    usuarioId: row.usuarioId,
    processoId: row.processoId,
    assunto: row.assunto,
    conteudo: row.conteudo,
    canal: row.canal,
    ocorridoEm: row.ocorridoEm.toISOString(),
    createdAt: row.criadoEm.toISOString(),
    usuario: row.usuario,
    processo: row.processo,
  }
}
