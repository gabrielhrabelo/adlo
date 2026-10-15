import type { Prisma, PrismaClient } from "../../../generated/prisma/client.ts";
import type {
  AudienciaLinha, ClienteLinha, DadosDosIndicadores, FiltrosAudiencias, FiltrosClientes, FiltrosProcessos,
  JanelasDosIndicadores, ProcessoLinha, RelatorioQueries,
} from "../application/ports.ts";

const STATUS_ATIVOS_AGENDAMENTO = ['PENDENTE', 'CONFIRMADO'] as const
const STATUS_ENCERRADOS_PROCESSO = ['CONCLUIDO', 'ARQUIVADO'] as const
const LIMITE_PROXIMOS_EVENTOS = 10

export class PostgresRelatorioQueries implements RelatorioQueries {
  constructor(private readonly db: PrismaClient) {

  }

  async listarClientes(filtros: FiltrosClientes, limite: number): Promise<ClienteLinha[]> {
    const where: Prisma.ClienteWhereInput = {}

    if (filtros.ativo !== undefined) where.ativo = filtros.ativo
    if (filtros.usuarioId) where.usuarioId = filtros.usuarioId
    if (filtros.area) where.processos = { some: { area: filtros.area } }

    const rows = await this.db.cliente.findMany({
      where,
      orderBy: { nome: 'asc' },
      take: limite,
      include: {
        telefones: { take: 1 },
        enderecos: { take: 1 },
        usuario: { select: { nome: true } },
        _count: { select: { processos: true } },
      },
    })

    return rows.map(row => ({
      nome: row.nome,
      cpfCnpj: row.cpfCnpj,
      email: row.email,
      telefone: row.telefones[0]?.numero ?? null,
      cidade: row.enderecos[0]?.cidade ?? null,
      uf: row.enderecos[0]?.uf ?? null,
      responsavel: row.usuario.nome,
      totalProcessos: row._count.processos,
      ativo: row.ativo,
      criadoEm: row.criadoEm,
    }))
  }

  async listarProcessos(filtros: FiltrosProcessos, limite: number): Promise<ProcessoLinha[]> {
    const where: Prisma.ProcessoWhereInput = {}

    if (filtros.status) where.status = filtros.status
    if (filtros.area) where.area = filtros.area
    if (filtros.clienteId) where.clienteId = filtros.clienteId
    if (filtros.abertoDe || filtros.abertoAte) {
      where.dataAbertura = {
        ...(filtros.abertoDe && { gte: filtros.abertoDe }),
        ...(filtros.abertoAte && { lte: filtros.abertoAte }),
      }
    }

    const rows = await this.db.processo.findMany({
      where,
      orderBy: [{ dataAbertura: 'desc' }, { criadoEm: 'desc' }],
      take: limite,
      include: { cliente: { select: { nome: true } } },
    })

    return rows.map(row => ({
      numeroProcesso: row.numeroProcesso,
      titulo: row.titulo,
      cliente: row.cliente.nome,
      area: row.area,
      status: row.status,
      tribunal: row.tribunal,
      dataAbertura: row.dataAbertura,
    }))
  }

  async listarAudiencias(filtros: FiltrosAudiencias, limite: number): Promise<AudienciaLinha[]> {
    const rows = await this.db.agendamento.findMany({
      where: {
        tipo: 'AUDIENCIA',
        dataHora: { gte: filtros.de, lte: filtros.ate },
        ...(filtros.usuarioId && { usuarioId: filtros.usuarioId }),
        ...(filtros.status && { status: filtros.status }),
      },
      orderBy: { dataHora: 'asc' },
      take: limite,
      include: {
        cliente: { select: { nome: true } },
        processo: { select: { numeroProcesso: true } },
        usuario: { select: { nome: true } },
      },
    })

    return rows.map(row => ({
      dataHora: row.dataHora,
      titulo: row.titulo,
      cliente: row.cliente.nome,
      numeroProcesso: row.processo?.numeroProcesso ?? null,
      responsavel: row.usuario.nome,
      status: row.status,
    }))
  }

  async indicadores(janelas: JanelasDosIndicadores): Promise<DadosDosIndicadores> {
    const agendaAtiva = { status: { in: [...STATUS_ATIVOS_AGENDAMENTO] } }
    const janelaDosProximos = { ...agendaAtiva, dataHora: { gte: janelas.agora, lte: janelas.limiteProximos } }

    const [
      clientesAtivos, porStatus, porArea, porTipo, atrasados, proximosEventos, atendimentos, concluidosNoMes,
    ] = await Promise.all([
      this.db.cliente.count({ where: { ativo: true } }),
      this.db.processo.groupBy({ by: ['status'], _count: { _all: true } }),
      this.db.processo.groupBy({
        by: ['area'],
        where: { status: { notIn: [...STATUS_ENCERRADOS_PROCESSO] } },
        _count: { _all: true },
      }),
      this.db.agendamento.groupBy({ by: ['tipo'], where: janelaDosProximos, _count: { _all: true } }),
      this.db.agendamento.count({ where: { ...agendaAtiva, dataHora: { lt: janelas.agora } } }),
      this.db.agendamento.findMany({
        where: janelaDosProximos,
        orderBy: { dataHora: 'asc' },
        take: LIMITE_PROXIMOS_EVENTOS,
        include: { cliente: { select: { nome: true } }, usuario: { select: { nome: true } } },
      }),
      this.db.atendimento.groupBy({
        by: ['usuarioId'],
        where: { ocorridoEm: { gte: janelas.inicioAtendimentos } },
        _count: { _all: true },
      }),
      // Aproximação: processos concluídos cuja última alteração foi neste mês
      this.db.processo.count({ where: { status: 'CONCLUIDO', atualizadoEm: { gte: janelas.inicioDoMes } } }),
    ])

    const idsDosUsuarios = atendimentos.map(a => a.usuarioId).filter((id): id is string => id !== null)
    const usuarios = idsDosUsuarios.length
      ? await this.db.usuario.findMany({ where: { id: { in: idsDosUsuarios } }, select: { id: true, nome: true } })
      : []
    const nomes = new Map(usuarios.map(u => [u.id, u.nome]))

    return {
      clientesAtivos,
      processosPorStatus: Object.fromEntries(porStatus.map(g => [g.status, g._count._all])),
      processosPorArea: Object.fromEntries(porArea.map(g => [g.area, g._count._all])),
      proximosPorTipo: Object.fromEntries(porTipo.map(g => [g.tipo, g._count._all])),
      atrasados,
      proximosEventos: proximosEventos.map(e => ({
        id: e.id,
        titulo: e.titulo,
        tipo: e.tipo,
        dataHora: e.dataHora,
        cliente: e.cliente.nome,
        responsavel: e.usuario.nome,
      })),
      atendimentosPorUsuario: atendimentos.map(a => ({
        usuarioId: a.usuarioId,
        nome: a.usuarioId ? (nomes.get(a.usuarioId) ?? 'Usuário removido') : 'Usuário removido',
        total: a._count._all,
      })),
      processosConcluidosNoMes: concluidosNoMes,
    }
  }

  async nomeDoUsuario(id: string): Promise<string | null> {
    return (await this.db.usuario.findUnique({ where: { id }, select: { nome: true } }))?.nome ?? null
  }

  async nomeDoCliente(id: string): Promise<string | null> {
    return (await this.db.cliente.findUnique({ where: { id }, select: { nome: true } }))?.nome ?? null
  }
}
