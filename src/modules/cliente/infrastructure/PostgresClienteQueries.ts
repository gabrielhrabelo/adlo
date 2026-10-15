import type { Prisma, PrismaClient } from "../../../generated/prisma/client.ts";
import { normalizePage, type Page } from "../../../shared/application/Pagination.ts";
import type { ClienteDetalheDTO, ClienteQueries, ClienteResumoDTO, FiltrosDeCliente } from "../application/ClienteQueries.ts";

export class PostgresClienteQueries implements ClienteQueries {
  constructor(private readonly db: PrismaClient) {

  }

  async listar(filtros: FiltrosDeCliente): Promise<Page<ClienteResumoDTO>> {
    const { page, pageSize, skip } = normalizePage(filtros)
    const where = buildWhere(filtros)

    const [total, rows] = await Promise.all([
      this.db.cliente.count({ where }),
      this.db.cliente.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: filtros.ordenarPor === 'criadoEm' ? { criadoEm: 'desc' } : { nome: 'asc' },
        include: {
          telefones: { take: 1 },
          _count: { select: { processos: true } },
        },
      }),
    ])

    return {
      total,
      page,
      pageSize,
      items: rows.map(row => ({
        id: row.id,
        nome: row.nome,
        cpfCnpj: row.cpfCnpj,
        email: row.email,
        telefonePrincipal: row.telefones[0]?.numero ?? null,
        ativo: row.ativo,
        usuarioId: row.usuarioId,
        totalProcessos: row._count.processos,
        createdAt: row.criadoEm.toISOString(),
      })),
    }
  }

  async detalhar(id: string): Promise<ClienteDetalheDTO | null> {
    const row = await this.db.cliente.findUnique({
      where: { id },
      include: {
        telefones: true,
        enderecos: true,
        usuario: { select: { id: true, nome: true } },
        _count: { select: { processos: true, atendimentos: true, documentos: true } },
      },
    })

    if (!row) return null

    const agendamentosPendentes = await this.db.agendamento.count({
      where: { clienteId: id, status: { in: ['PENDENTE', 'CONFIRMADO'] } },
    })

    return {
      id: row.id,
      usuarioId: row.usuarioId,
      nome: row.nome,
      cpfCnpj: row.cpfCnpj,
      email: row.email,
      dataNascimento: row.dataNascimento?.toISOString().slice(0, 10) ?? null,
      observacoes: row.observacoes,
      ativo: row.ativo,
      telefones: row.telefones.map(t => ({ tipo: t.tipo, numero: t.numero })),
      enderecos: row.enderecos.map(e => ({
        tipo: e.tipo, rua: e.rua, numero: e.numero, complemento: e.complemento,
        bairro: e.bairro, cep: e.cep, cidade: e.cidade, uf: e.uf,
      })),
      createdAt: row.criadoEm.toISOString(),
      responsavel: row.usuario,
      totais: {
        processos: row._count.processos,
        atendimentos: row._count.atendimentos,
        documentos: row._count.documentos,
        agendamentosPendentes,
      },
    }
  }
}

function buildWhere(filtros: FiltrosDeCliente): Prisma.ClienteWhereInput {
  const and: Prisma.ClienteWhereInput[] = []
  const busca = filtros.busca?.trim()

  if (busca) {
    const digitos = busca.replace(/\D/g, '')
    const or: Prisma.ClienteWhereInput[] = [
      { nome: { contains: busca, mode: 'insensitive' } },
      { email: { contains: busca, mode: 'insensitive' } },
    ]
    if (digitos.length >= 3) {
      or.push({ cpfCnpj: { contains: digitos } })
      or.push({ telefones: { some: { numero: { contains: digitos } } } })
    }
    and.push({ OR: or })
  }
  if (filtros.ativo !== undefined) and.push({ ativo: filtros.ativo })
  if (filtros.usuarioId) and.push({ usuarioId: filtros.usuarioId })
  if (filtros.area) and.push({ processos: { some: { area: filtros.area } } })
  if (filtros.cidade) and.push({ enderecos: { some: { cidade: { equals: filtros.cidade, mode: 'insensitive' } } } })

  return { AND: and }
}
