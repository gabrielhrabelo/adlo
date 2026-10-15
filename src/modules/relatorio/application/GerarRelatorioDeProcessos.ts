import { FiltroDeRelatorioInvalidoError } from "../domain/errors.ts";
import { formatarData, formatarDataIso, hojeNoEscritorio, ROTULOS_STATUS_PROCESSO } from "./formatacao.ts";
import { LIMITE_DE_LINHAS, nomeDeArquivo, comObservacao, resumoDeTotal } from "./limites.ts";
import type { Area, ArquivoDeRelatorio, GeradorDePdf, RelatorioQueries, StatusDoProcesso } from "./ports.ts";

export interface FiltrosDoRelatorioDeProcessos {
  status?: StatusDoProcesso
  area?: Area
  clienteId?: string
  // YYYY-MM-DD
  abertoDe?: string
  abertoAte?: string
}

export class GerarRelatorioDeProcessos {
  constructor(
    private readonly queries: RelatorioQueries,
    private readonly pdf: GeradorDePdf,
    private readonly agora: () => Date = () => new Date()
  ) { }

  async execute(filtros: FiltrosDoRelatorioDeProcessos): Promise<ArquivoDeRelatorio> {
    if (filtros.abertoDe && filtros.abertoAte && filtros.abertoDe > filtros.abertoAte) {
      throw new FiltroDeRelatorioInvalidoError('A data inicial precisa ser anterior à data final')
    }

    const agora = this.agora()
    const linhas = await this.queries.listarProcessos({
      ...(filtros.status && { status: filtros.status }),
      ...(filtros.area && { area: filtros.area }),
      ...(filtros.clienteId && { clienteId: filtros.clienteId }),
      // dataAbertura é @db.Date: compara com meia-noite UTC
      ...(filtros.abertoDe && { abertoDe: new Date(`${filtros.abertoDe}T00:00:00.000Z`) }),
      ...(filtros.abertoAte && { abertoAte: new Date(`${filtros.abertoAte}T00:00:00.000Z`) }),
    }, LIMITE_DE_LINHAS + 1)
    const cliente = filtros.clienteId ? await this.queries.nomeDoCliente(filtros.clienteId) : null

    const conteudo = await this.pdf.gerar({
      titulo: 'Relatório de Processos',
      orientacao: 'paisagem',
      filtros: [
        ['Status', filtros.status ? ROTULOS_STATUS_PROCESSO[filtros.status]! : 'Todos'],
        ['Área', filtros.area ?? 'Todas'],
        ['Cliente', filtros.clienteId ? (cliente ?? 'Cliente não encontrado') : 'Todos'],
        ['Abertura', periodo(filtros.abertoDe, filtros.abertoAte)],
      ],
      colunas: [
        { titulo: 'Número', largura: 0.17 },
        { titulo: 'Título', largura: 0.24 },
        { titulo: 'Cliente', largura: 0.2 },
        { titulo: 'Área', largura: 0.07, alinhamento: 'center' },
        { titulo: 'Status', largura: 0.11 },
        { titulo: 'Tribunal', largura: 0.12 },
        { titulo: 'Abertura', largura: 0.09, alinhamento: 'center' },
      ],
      linhas: linhas.slice(0, LIMITE_DE_LINHAS).map(p => [
        p.numeroProcesso ?? 'Sem número',
        p.titulo,
        p.cliente,
        p.area,
        ROTULOS_STATUS_PROCESSO[p.status] ?? p.status,
        p.tribunal ?? '-',
        formatarData(p.dataAbertura),
      ]),
      resumo: resumoDeTotal(linhas.length),
      ...comObservacao(linhas.length),
      geradoEm: agora,
    })

    return { nomeArquivo: nomeDeArquivo('processos', hojeNoEscritorio(agora)), conteudo }
  }
}

function periodo(de?: string, ate?: string): string {
  if (de && ate) return `${formatarDataIso(de)} a ${formatarDataIso(ate)}`
  if (de) return `A partir de ${formatarDataIso(de)}`
  if (ate) return `Até ${formatarDataIso(ate)}`
  return 'Qualquer data'
}
