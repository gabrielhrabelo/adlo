import type { Prisma, PrismaClient } from "../../../generated/prisma/client.ts";
import { normalizePage, type Page } from "../../../shared/application/Pagination.ts";
import type {
  AgendamentoDetalheDTO, AgendamentoQueries, FiltrosDeAgendamento, PainelDeAlertasDTO,
} from "../application/AgendamentoQueries.ts";
import { toAgendamentoDTO } from "../application/dto.ts";
import { STATUS_ATIVOS } from "../domain/Agendamento.ts";
import { toDomain } from "./PostgresAgendamentoRepository.ts";

const include = {
  cliente: { select: { id: true, nome: true } },
  usuario: { select: { id: true, nome: true } },
  processo: { select: { id: true, titulo: true, numeroProcesso: true } },
} as const

type Row = Prisma.AgendamentoGetPayload<{ include: typeof include }>

const DIA = 24 * 60 * 60 * 1000
const LIMITE_DO_PAINEL = 100

export class PostgresAgendamentoQueries implements AgendamentoQueries {
  constructor(private readonly db: PrismaClient) {

  }

  async listar(filtros: FiltrosDeAgendamento, agora: Date): Promise<Page<AgendamentoDetalheDTO>> {
    const { page, pageSize, skip } = normalizePage(filtros)
    const where = buildWhere(filtros)

    const [total, rows] = await Promise.all([
      this.db.agendamento.count({ where }),
      this.db.agendamento.findMany({ where, skip, take: pageSize, orderBy: { dataHora: 'asc' }, include }),
    ])

    return { total, page, pageSize, items: rows.map(row => toDetalhe(row, agora)) }
  }

  async detalhar(id: string, agora: Date): Promise<AgendamentoDetalheDTO | null> {
    const row = await this.db.agendamento.findUnique({ where: { id }, include })

    return row ? toDetalhe(row, agora) : null
  }

  async alertas(input: { usuarioId?: string, dias: number, agora: Date }): Promise<PainelDeAlertasDTO> {
    const base: Prisma.AgendamentoWhereInput = {
      status: { in: [...STATUS_ATIVOS] },
      ...(input.usuarioId && { usuarioId: input.usuarioId }),
    }
    const limite = new Date(input.agora.getTime() + input.dias * DIA)

    const [atrasados, proximos] = await Promise.all([
      this.db.agendamento.findMany({
        where: { ...base, dataHora: { lt: input.agora } },
        orderBy: { dataHora: 'asc' },
        take: LIMITE_DO_PAINEL,
        include,
      }),
      this.db.agendamento.findMany({
        where: { ...base, dataHora: { gte: input.agora, lte: limite } },
        orderBy: { dataHora: 'asc' },
        take: LIMITE_DO_PAINEL,
        include,
      }),
    ])

    return {
      geradoEm: input.agora.toISOString(),
      atrasados: atrasados.map(row => toDetalhe(row, input.agora)),
      proximos: proximos.map(row => toDetalhe(row, input.agora)),
    }
  }
}

function buildWhere(filtros: FiltrosDeAgendamento): Prisma.AgendamentoWhereInput {
  const where: Prisma.AgendamentoWhereInput = {}

  if (filtros.clienteId) where.clienteId = filtros.clienteId
  if (filtros.usuarioId) where.usuarioId = filtros.usuarioId
  if (filtros.processoId) where.processoId = filtros.processoId
  if (filtros.tipo) where.tipo = filtros.tipo
  if (filtros.status?.length) where.status = { in: filtros.status }
  if (filtros.de || filtros.ate) {
    where.dataHora = {
      ...(filtros.de && { gte: new Date(filtros.de) }),
      ...(filtros.ate && { lte: fimDoPeriodo(filtros.ate) }),
    }
  }
  return where
}

// "ate" só com a data inclui o dia inteiro
function fimDoPeriodo(ate: string): Date {
  return ate.length === 10 ? new Date(`${ate}T23:59:59.999Z`) : new Date(ate)
}

function toDetalhe(row: Row, agora: Date): AgendamentoDetalheDTO {
  return {
    ...toAgendamentoDTO(toDomain(row)),
    cliente: row.cliente,
    responsavel: row.usuario,
    processo: row.processo,
    atrasado: STATUS_ATIVOS.includes(row.status) && row.dataHora.getTime() < agora.getTime(),
  }
}
