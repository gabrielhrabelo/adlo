export type Area = 'INSS' | 'DPVAT'

export type StatusDoProcesso =
  'TRIAGEM' | 'DOCUMENTACAO' | 'PROTOCOLO' | 'EM_ANDAMENTO' | 'AGUARDANDO' | 'CONCLUIDO' | 'ARQUIVADO'

export const STATUS_DO_PROCESSO: readonly StatusDoProcesso[] =
  ['TRIAGEM', 'DOCUMENTACAO', 'PROTOCOLO', 'EM_ANDAMENTO', 'AGUARDANDO', 'CONCLUIDO', 'ARQUIVADO']

export const STATUS_DO_AGENDAMENTO = ['PENDENTE', 'CONFIRMADO', 'CONCLUIDO', 'CANCELADO'] as const
export type StatusDoAgendamento = typeof STATUS_DO_AGENDAMENTO[number]

export interface ClienteLinha {
  nome: string
  cpfCnpj: string | null
  email: string | null
  telefone: string | null
  cidade: string | null
  uf: string | null
  responsavel: string
  totalProcessos: number
  ativo: boolean
  criadoEm: Date
}

export interface ProcessoLinha {
  numeroProcesso: string | null
  titulo: string
  cliente: string
  area: Area
  status: StatusDoProcesso
  tribunal: string | null
  dataAbertura: Date
}

export interface AudienciaLinha {
  dataHora: Date
  titulo: string
  cliente: string
  numeroProcesso: string | null
  responsavel: string
  status: StatusDoAgendamento
}

export interface FiltrosClientes {
  ativo?: boolean
  area?: Area
  usuarioId?: string
}

export interface FiltrosProcessos {
  status?: StatusDoProcesso
  area?: Area
  clienteId?: string
  abertoDe?: Date
  abertoAte?: Date
}

export interface FiltrosAudiencias {
  de: Date
  ate: Date
  usuarioId?: string
  status?: StatusDoAgendamento
}

export interface JanelasDosIndicadores {
  agora: Date
  limiteProximos: Date
  inicioAtendimentos: Date
  inicioDoMes: Date
}

export interface DadosDosIndicadores {
  clientesAtivos: number
  processosPorStatus: Partial<Record<StatusDoProcesso, number>>
  processosPorArea: Partial<Record<Area, number>>
  proximosPorTipo: Partial<Record<'PRAZO' | 'AUDIENCIA' | 'COMPROMISSO', number>>
  atrasados: number
  proximosEventos: {
    id: string
    titulo: string
    tipo: 'PRAZO' | 'AUDIENCIA' | 'COMPROMISSO'
    dataHora: Date
    cliente: string
    responsavel: string
  }[]
  atendimentosPorUsuario: { usuarioId: string | null, nome: string, total: number }[]
  processosConcluidosNoMes: number
}

// Consultas de leitura usadas pelos relatórios (RF15) e pelo dashboard
export interface RelatorioQueries {
  listarClientes(filtros: FiltrosClientes, limite: number): Promise<ClienteLinha[]>
  listarProcessos(filtros: FiltrosProcessos, limite: number): Promise<ProcessoLinha[]>
  listarAudiencias(filtros: FiltrosAudiencias, limite: number): Promise<AudienciaLinha[]>
  indicadores(janelas: JanelasDosIndicadores): Promise<DadosDosIndicadores>
  nomeDoUsuario(id: string): Promise<string | null>
  nomeDoCliente(id: string): Promise<string | null>
}

export interface ColunaDoRelatorio {
  titulo: string
  // Proporção da largura útil da página
  largura: number
  alinhamento?: 'left' | 'center' | 'right'
}

export interface DocumentoDeRelatorio {
  titulo: string
  orientacao: 'retrato' | 'paisagem'
  filtros: [string, string][]
  colunas: ColunaDoRelatorio[]
  linhas: string[][]
  resumo: string
  observacao?: string
  geradoEm: Date
}

export interface GeradorDePdf {
  gerar(documento: DocumentoDeRelatorio): Promise<Buffer>
}

export interface ArquivoDeRelatorio {
  nomeArquivo: string
  conteudo: Buffer
}
