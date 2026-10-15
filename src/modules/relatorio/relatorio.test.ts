import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { GerarRelatorioDeAudiencias } from "./application/GerarRelatorioDeAudiencias.ts";
import { GerarRelatorioDeClientes } from "./application/GerarRelatorioDeClientes.ts";
import { GerarRelatorioDeProcessos } from "./application/GerarRelatorioDeProcessos.ts";
import { ObterIndicadores } from "./application/ObterIndicadores.ts";
import {
  fimDoDia, formatarCpfCnpj, formatarData, formatarDataHora, formatarDataIso, formatarTelefone,
  hojeNoEscritorio, inicioDoDia, inicioDoMes, somarDias,
} from "./application/formatacao.ts";
import { comObservacao, LIMITE_DE_LINHAS, nomeDeArquivo, resumoDeTotal } from "./application/limites.ts";
import type {
  AudienciaLinha, ClienteLinha, DadosDosIndicadores, DocumentoDeRelatorio, FiltrosAudiencias, FiltrosClientes,
  FiltrosProcessos, GeradorDePdf, JanelasDosIndicadores, ProcessoLinha, RelatorioQueries,
} from "./application/ports.ts";
import { FiltroDeRelatorioInvalidoError } from "./domain/errors.ts";
import { PdfKitGeradorDePdf } from "./infrastructure/PdfKitGeradorDePdf.ts";

// 09:00 em Brasília
const AGORA = new Date('2026-10-15T12:00:00.000Z')
const agora = () => AGORA

const cliente = (input: Partial<ClienteLinha> = {}): ClienteLinha => ({
  nome: 'Maria da Silva',
  cpfCnpj: '52998224725',
  email: 'maria@x.com',
  telefone: '62999991234',
  cidade: 'Goiânia',
  uf: 'GO',
  responsavel: 'Ana',
  totalProcessos: 2,
  ativo: true,
  criadoEm: new Date('2026-01-05T15:00:00.000Z'),
  ...input,
})

class FakeQueries implements RelatorioQueries {
  clientes: ClienteLinha[] = []
  processos: ProcessoLinha[] = []
  audiencias: AudienciaLinha[] = []
  dados: DadosDosIndicadores = {
    clientesAtivos: 0, processosPorStatus: {}, processosPorArea: {}, proximosPorTipo: {},
    atrasados: 0, proximosEventos: [], atendimentosPorUsuario: [], processosConcluidosNoMes: 0,
  }

  readonly chamadas: { metodo: string, filtros: unknown, limite?: number }[] = []

  async listarClientes(filtros: FiltrosClientes, limite: number) {
    this.chamadas.push({ metodo: 'clientes', filtros, limite })
    return this.clientes.slice(0, limite)
  }

  async listarProcessos(filtros: FiltrosProcessos, limite: number) {
    this.chamadas.push({ metodo: 'processos', filtros, limite })
    return this.processos.slice(0, limite)
  }

  async listarAudiencias(filtros: FiltrosAudiencias, limite: number) {
    this.chamadas.push({ metodo: 'audiencias', filtros, limite })
    return this.audiencias.slice(0, limite)
  }

  async indicadores(janelas: JanelasDosIndicadores) {
    this.chamadas.push({ metodo: 'indicadores', filtros: janelas })
    return this.dados
  }

  async nomeDoUsuario(id: string) {
    return id === 'u1' ? 'Ana' : null
  }

  async nomeDoCliente(id: string) {
    return id === 'cli-1' ? 'Maria da Silva' : null
  }
}

class FakePdf implements GeradorDePdf {
  ultimo: DocumentoDeRelatorio | null = null

  async gerar(documento: DocumentoDeRelatorio) {
    this.ultimo = documento
    return Buffer.from('%PDF-fake')
  }

  get documento(): DocumentoDeRelatorio {
    assert.ok(this.ultimo, 'nenhum PDF foi gerado')
    return this.ultimo
  }

  filtro(rotulo: string): string | undefined {
    return this.documento.filtros.find(([r]) => r === rotulo)?.[1]
  }
}

describe('formatação', () => {
  it('formata CPF/CNPJ, telefone e datas', () => {
    assert.equal(formatarCpfCnpj('52998224725'), '529.982.247-25')
    assert.equal(formatarCpfCnpj('11222333000181'), '11.222.333/0001-81')
    assert.equal(formatarCpfCnpj(null), '-')
    assert.equal(formatarTelefone('62999991234'), '(62) 99999-1234')
    assert.equal(formatarTelefone('6232101234'), '(62) 3210-1234')
    assert.equal(formatarData(new Date('2026-01-05T00:00:00.000Z')), '05/01/2026')
    assert.equal(formatarDataIso('2026-10-15'), '15/10/2026')
    assert.match(formatarDataHora(new Date('2026-10-15T17:00:00.000Z')), /15\/10\/2026.*14:00/)
  })

  it('calcula dias no fuso do escritório (UTC-3)', () => {
    assert.equal(hojeNoEscritorio(new Date('2026-10-16T02:00:00.000Z')), '2026-10-15')
    assert.equal(inicioDoDia('2026-10-15').toISOString(), '2026-10-15T03:00:00.000Z')
    assert.equal(fimDoDia('2026-10-15').toISOString(), '2026-10-16T02:59:59.999Z')
    assert.equal(inicioDoMes(AGORA).toISOString(), '2026-10-01T03:00:00.000Z')
    assert.equal(somarDias('2026-12-31', 1), '2027-01-01')
    assert.equal(somarDias('2026-03-01', -1), '2026-02-28')
  })

  it('monta resumo, observação de limite e nome do arquivo', () => {
    assert.equal(resumoDeTotal(1), 'Total: 1 registro')
    assert.equal(resumoDeTotal(2), 'Total: 2 registros')
    assert.match(resumoDeTotal(LIMITE_DE_LINHAS + 1), /^Total: 5\.000\+ registros$/)
    assert.deepEqual(comObservacao(LIMITE_DE_LINHAS), {})
    assert.ok(comObservacao(LIMITE_DE_LINHAS + 1).observacao)
    assert.equal(nomeDeArquivo('clientes', '2026-10-15'), 'relatorio-clientes-2026-10-15.pdf')
  })
})

describe('GerarRelatorioDeClientes', () => {
  let queries: FakeQueries
  let pdf: FakePdf

  beforeEach(() => {
    queries = new FakeQueries()
    pdf = new FakePdf()
  })

  it('formata as linhas e descreve os filtros', async () => {
    queries.clientes = [
      cliente(),
      cliente({ nome: 'João', cpfCnpj: null, email: null, telefone: null, cidade: null, uf: null, ativo: false }),
    ]

    const arquivo = await new GerarRelatorioDeClientes(queries, pdf, agora).execute({ ativo: true, usuarioId: 'u1' })

    assert.equal(arquivo.nomeArquivo, 'relatorio-clientes-2026-10-15.pdf')
    assert.deepEqual(pdf.documento.linhas, [
      ['Maria da Silva', '529.982.247-25', '(62) 99999-1234', 'maria@x.com', 'Goiânia/GO', 'Ana', '2', '05/01/2026'],
      ['João (inativo)', '-', '-', '-', '-', 'Ana', '2', '05/01/2026'],
    ])
    assert.equal(pdf.filtro('Situação'), 'Ativos')
    assert.equal(pdf.filtro('Área'), 'Todas')
    assert.equal(pdf.filtro('Responsável'), 'Ana')
    assert.equal(pdf.documento.resumo, 'Total: 2 registros')
    assert.equal(pdf.documento.colunas.reduce((total, c) => total + c.largura, 0).toFixed(2), '1.00')
  })

  it('consulta uma linha além do limite e avisa quando ele é ultrapassado', async () => {
    queries.clientes = Array.from({ length: LIMITE_DE_LINHAS + 10 }, (_, i) => cliente({ nome: `Cliente ${i}` }))

    await new GerarRelatorioDeClientes(queries, pdf, agora).execute({})

    assert.equal(queries.chamadas[0]?.limite, LIMITE_DE_LINHAS + 1)
    assert.equal(pdf.documento.linhas.length, LIMITE_DE_LINHAS)
    assert.ok(pdf.documento.observacao)
    assert.equal(pdf.filtro('Situação'), 'Todos')
  })

  it('indica responsável inexistente', async () => {
    await new GerarRelatorioDeClientes(queries, pdf, agora).execute({ usuarioId: 'nao-existe' })

    assert.equal(pdf.filtro('Responsável'), 'Usuário não encontrado')
    assert.equal(pdf.documento.resumo, 'Total: 0 registros')
  })
})

describe('GerarRelatorioDeProcessos', () => {
  let queries: FakeQueries
  let pdf: FakePdf

  beforeEach(() => {
    queries = new FakeQueries()
    pdf = new FakePdf()
  })

  it('converte o período de abertura e formata as linhas', async () => {
    queries.processos = [{
      numeroProcesso: null, titulo: 'Pensão por morte', cliente: 'Maria', area: 'INSS',
      status: 'EM_ANDAMENTO', tribunal: null, dataAbertura: new Date('2026-02-10T00:00:00.000Z'),
    }]

    await new GerarRelatorioDeProcessos(queries, pdf, agora).execute({
      status: 'EM_ANDAMENTO', clienteId: 'cli-1', abertoDe: '2026-01-01', abertoAte: '2026-06-30',
    })

    assert.deepEqual(queries.chamadas[0]?.filtros, {
      status: 'EM_ANDAMENTO',
      clienteId: 'cli-1',
      abertoDe: new Date('2026-01-01T00:00:00.000Z'),
      abertoAte: new Date('2026-06-30T00:00:00.000Z'),
    })
    assert.deepEqual(pdf.documento.linhas, [['Sem número', 'Pensão por morte', 'Maria', 'INSS', 'Em andamento', '-', '10/02/2026']])
    assert.equal(pdf.filtro('Status'), 'Em andamento')
    assert.equal(pdf.filtro('Cliente'), 'Maria da Silva')
    assert.equal(pdf.filtro('Abertura'), '01/01/2026 a 30/06/2026')
  })

  it('descreve períodos abertos e rejeita período invertido', async () => {
    const gerar = new GerarRelatorioDeProcessos(queries, pdf, agora)

    await gerar.execute({ abertoDe: '2026-01-01' })
    assert.equal(pdf.filtro('Abertura'), 'A partir de 01/01/2026')

    await gerar.execute({})
    assert.equal(pdf.filtro('Abertura'), 'Qualquer data')

    await assert.rejects(gerar.execute({ abertoDe: '2026-06-30', abertoAte: '2026-01-01' }), FiltroDeRelatorioInvalidoError)
  })
})

describe('GerarRelatorioDeAudiencias', () => {
  let queries: FakeQueries
  let pdf: FakePdf

  beforeEach(() => {
    queries = new FakeQueries()
    pdf = new FakePdf()
  })

  it('usa por padrão de hoje até 30 dias à frente, no fuso do escritório', async () => {
    const arquivo = await new GerarRelatorioDeAudiencias(queries, pdf, agora).execute({})

    assert.deepEqual(queries.chamadas[0]?.filtros, {
      de: new Date('2026-10-15T03:00:00.000Z'),
      ate: new Date('2026-11-15T02:59:59.999Z'),
    })
    assert.equal(pdf.filtro('Período'), '15/10/2026 a 14/11/2026')
    assert.equal(arquivo.nomeArquivo, 'relatorio-audiencias-2026-10-15.pdf')
  })

  it('formata as audiências e aplica responsável e status', async () => {
    queries.audiencias = [{
      dataHora: new Date('2026-10-20T17:00:00.000Z'), titulo: 'Audiência de instrução', cliente: 'Maria',
      numeroProcesso: '0000001-06.2026.4.01.0001', responsavel: 'Ana', status: 'CONFIRMADO',
    }]

    await new GerarRelatorioDeAudiencias(queries, pdf, agora).execute({
      de: '2026-10-01', ate: '2026-10-31', usuarioId: 'u1', status: 'CONFIRMADO',
    })

    const linha = pdf.documento.linhas[0]!
    assert.match(linha[0]!, /20\/10\/2026.*14:00/)
    assert.deepEqual(linha.slice(1), ['Audiência de instrução', 'Maria', '0000001-06.2026.4.01.0001', 'Ana', 'Confirmado'])
    assert.equal(pdf.filtro('Responsável'), 'Ana')
    assert.equal(pdf.filtro('Status'), 'Confirmado')
  })

  it('rejeita período invertido ou maior que o máximo', async () => {
    const gerar = new GerarRelatorioDeAudiencias(queries, pdf, agora)

    await assert.rejects(gerar.execute({ de: '2026-10-31', ate: '2026-10-01' }), FiltroDeRelatorioInvalidoError)
    await assert.rejects(gerar.execute({ de: '2026-01-01', ate: '2027-06-01' }), FiltroDeRelatorioInvalidoError)
    assert.equal(queries.chamadas.length, 0)
  })
})

describe('ObterIndicadores', () => {
  it('passa as janelas de tempo e consolida os totais', async () => {
    const queries = new FakeQueries()
    queries.dados = {
      clientesAtivos: 12,
      processosPorStatus: { TRIAGEM: 3, EM_ANDAMENTO: 4, CONCLUIDO: 5, ARQUIVADO: 1 },
      processosPorArea: { INSS: 6 },
      proximosPorTipo: { PRAZO: 2, AUDIENCIA: 1 },
      atrasados: 1,
      proximosEventos: [{
        id: 'a1', titulo: 'Audiência', tipo: 'AUDIENCIA', dataHora: new Date('2026-10-16T13:00:00.000Z'),
        cliente: 'Maria', responsavel: 'Ana',
      }],
      atendimentosPorUsuario: [
        { usuarioId: 'u1', nome: 'Ana', total: 3 },
        { usuarioId: 'u2', nome: 'Bia', total: 8 },
      ],
      processosConcluidosNoMes: 2,
    }

    const indicadores = await new ObterIndicadores(queries, agora).execute()

    assert.deepEqual(queries.chamadas[0]?.filtros, {
      agora: AGORA,
      limiteProximos: new Date('2026-10-22T12:00:00.000Z'),
      inicioAtendimentos: new Date('2026-09-15T03:00:00.000Z'),
      inicioDoMes: new Date('2026-10-01T03:00:00.000Z'),
    })
    assert.equal(indicadores.clientesAtivos, 12)
    assert.equal(indicadores.processos.ativos, 7)
    assert.equal(indicadores.processos.porStatus.DOCUMENTACAO, 0)
    assert.deepEqual(indicadores.processos.porArea, { INSS: 6, DPVAT: 0 })
    assert.deepEqual(indicadores.agenda.proximos, { prazos: 2, audiencias: 1, compromissos: 0, total: 3 })
    assert.equal(indicadores.agenda.proximosEventos[0]?.dataHora, '2026-10-16T13:00:00.000Z')
    assert.deepEqual(indicadores.produtividade.atendimentosPorUsuario.map(u => u.nome), ['Bia', 'Ana'])
    assert.equal(indicadores.produtividade.totalAtendimentos, 11)
  })
})

describe('PdfKitGeradorDePdf', () => {
  const documento = (linhas: string[][]): DocumentoDeRelatorio => ({
    titulo: 'Relatório de Teste',
    orientacao: 'paisagem',
    filtros: [['Situação', 'Ativos']],
    colunas: [
      { titulo: 'Nome', largura: 0.5 },
      { titulo: 'Cidade', largura: 0.3 },
      { titulo: 'Processos', largura: 0.2, alinhamento: 'right' },
    ],
    linhas,
    resumo: `Total: ${linhas.length} registros`,
    geradoEm: AGORA,
  })

  const paginas = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type \/Page[^s]/g) ?? []).length

  it('gera um PDF válido mesmo sem linhas', async () => {
    const pdf = await new PdfKitGeradorDePdf().gerar(documento([]))

    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
    assert.equal(paginas(pdf), 1)
  })

  it('quebra a tabela em várias páginas quando há muitas linhas', async () => {
    const linhas = Array.from({ length: 300 }, (_, i) => [`Cliente ${i} com acentuação`, 'Aparecida de Goiânia', String(i)])
    const pdf = await new PdfKitGeradorDePdf().gerar(documento(linhas))

    assert.ok(paginas(pdf) > 1)
  })
})
