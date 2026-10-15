import type { Prisma, PrismaClient } from "../../../generated/prisma/client.ts";
import { normalizePage, type Page } from "../../../shared/application/Pagination.ts";
import type { FiltrosDeProcesso, ProcessoDetalheDTO, ProcessoQueries, ProcessoResumoDTO } from "../application/ProcessoQueries.ts";

const include = { cliente: { select: { id: true, nome: true } } } as const

type ProcessoRow = Prisma.ProcessoGetPayload<{ include: typeof include }>

export class PostgresProcessoQueries implements ProcessoQueries {
  constructor(private readonly db: PrismaClient) {

  }

  async listar(filtros: FiltrosDeProcesso): Promise<Page<ProcessoResumoDTO>> {
    const { page, pageSize, skip } = normalizePage(filtros)
    const where = buildWhere(filtros)
    const orderBy: Prisma.ProcessoOrderByWithRelationInput =
      filtros.ordenarPor === 'titulo' ? { titulo: 'asc' }
        : filtros.ordenarPor === 'dataAbertura' ? { dataAbertura: 'desc' }
          : { criadoEm: 'desc' }

    const [total, rows] = await Promise.all([
      this.db.processo.count({ where }),
      this.db.processo.findMany({ where, skip, take: pageSize, orderBy, include }),
    ])

    return { total, page, pageSize, items: rows.map(toResumo) }
  }

  async detalhar(id: string): Promise<ProcessoDetalheDTO | null> {
    const row = await this.db.processo.findUnique({
      where: { id },
      include: {
        ...include,
        _count: { select: { agendamentos: true, atendimentos: true } },
        agendamentos: {
          where: { status: { in: ['PENDENTE', 'CONFIRMADO'] }, dataHora: { gte: new Date() } },
          orderBy: { dataHora: 'asc' },
          take: 1,
          select: { id: true, titulo: true, tipo: true, dataHora: true },
        },
      },
    })

    if (!row) return null

    const proximo = row.agendamentos[0]

    return {
      ...toResumo(row),
      proximoAgendamento: proximo
        ? { id: proximo.id, titulo: proximo.titulo, tipo: proximo.tipo, dataHora: proximo.dataHora.toISOString() }
        : null,
      totais: { agendamentos: row._count.agendamentos, atendimentos: row._count.atendimentos },
    }
  }
}

function toResumo(row: ProcessoRow): ProcessoResumoDTO {
  return {
    id: row.id,
    clienteId: row.clienteId,
    numeroProcesso: row.numeroProcesso,
    titulo: row.titulo,
    area: row.area,
    status: row.status,
    tribunal: row.tribunal,
    descricao: row.descricao,
    dataAbertura: row.dataAbertura.toISOString().slice(0, 10),
    createdAt: row.criadoEm.toISOString(),
    cliente: row.cliente,
  }
}

function buildWhere(filtros: FiltrosDeProcesso): Prisma.ProcessoWhereInput {
  const and: Prisma.ProcessoWhereInput[] = []
  const busca = filtros.busca?.trim()

  if (busca) {
    const or: Prisma.ProcessoWhereInput[] = [
      { titulo: { contains: busca, mode: 'insensitive' } },
      { cliente: { nome: { contains: busca, mode: 'insensitive' } } },
    ]
    const digitos = busca.replace(/\D/g, '')
    if (digitos.length >= 3) or.push({ numeroProcesso: { contains: busca } })
    and.push({ OR: or })
  }
  if (filtros.clienteId) and.push({ clienteId: filtros.clienteId })
  if (filtros.area) and.push({ area: filtros.area })
  if (filtros.status?.length) {
    and.push({ status: { in: filtros.status } })
  } else if (!filtros.incluirArquivados) {
    and.push({ status: { not: 'ARQUIVADO' } })
  }

  return { AND: and }
}
