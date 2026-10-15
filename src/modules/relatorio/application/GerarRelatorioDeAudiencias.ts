import { FiltroDeRelatorioInvalidoError } from "../domain/errors.ts";
import {
  fimDoDia, formatarDataHora, formatarDataIso, hojeNoEscritorio, inicioDoDia, ROTULOS_STATUS_AGENDAMENTO, somarDias,
} from "./formatacao.ts";
import { LIMITE_DE_LINHAS, nomeDeArquivo, comObservacao, PERIODO_MAXIMO_DIAS, resumoDeTotal } from "./limites.ts";
import type { ArquivoDeRelatorio, GeradorDePdf, RelatorioQueries, StatusDoAgendamento } from "./ports.ts";

export interface FiltrosDoRelatorioDeAudiencias {
  // YYYY-MM-DD no fuso do escritório; padrão: hoje até 30 dias à frente
  de?: string
  ate?: string
  usuarioId?: string
  status?: StatusDoAgendamento
}

export class GerarRelatorioDeAudiencias {
  constructor(
    private readonly queries: RelatorioQueries,
    private readonly pdf: GeradorDePdf,
    private readonly agora: () => Date = () => new Date()
  ) { }

  async execute(filtros: FiltrosDoRelatorioDeAudiencias): Promise<ArquivoDeRelatorio> {
    const agora = this.agora()
    const hoje = hojeNoEscritorio(agora)
    const de = filtros.de ?? hoje
    const ate = filtros.ate ?? somarDias(de, 30)

    if (de > ate) {
      throw new FiltroDeRelatorioInvalidoError('A data inicial precisa ser anterior à data final')
    }
    if (ate > somarDias(de, PERIODO_MAXIMO_DIAS)) {
      throw new FiltroDeRelatorioInvalidoError(`O período não pode passar de ${PERIODO_MAXIMO_DIAS} dias`)
    }

    const linhas = await this.queries.listarAudiencias({
      de: inicioDoDia(de),
      ate: fimDoDia(ate),
      ...(filtros.usuarioId && { usuarioId: filtros.usuarioId }),
      ...(filtros.status && { status: filtros.status }),
    }, LIMITE_DE_LINHAS + 1)
    const responsavel = filtros.usuarioId ? await this.queries.nomeDoUsuario(filtros.usuarioId) : null

    const conteudo = await this.pdf.gerar({
      titulo: 'Relatório de Audiências',
      orientacao: 'paisagem',
      filtros: [
        ['Período', `${formatarDataIso(de)} a ${formatarDataIso(ate)}`],
        ['Responsável', filtros.usuarioId ? (responsavel ?? 'Usuário não encontrado') : 'Todos'],
        ['Status', filtros.status ? ROTULOS_STATUS_AGENDAMENTO[filtros.status]! : 'Todos'],
      ],
      colunas: [
        { titulo: 'Data/Hora', largura: 0.13, alinhamento: 'center' },
        { titulo: 'Audiência', largura: 0.25 },
        { titulo: 'Cliente', largura: 0.2 },
        { titulo: 'Processo', largura: 0.17 },
        { titulo: 'Responsável', largura: 0.15 },
        { titulo: 'Status', largura: 0.1 },
      ],
      linhas: linhas.slice(0, LIMITE_DE_LINHAS).map(a => [
        formatarDataHora(a.dataHora),
        a.titulo,
        a.cliente,
        a.numeroProcesso ?? '-',
        a.responsavel,
        ROTULOS_STATUS_AGENDAMENTO[a.status] ?? a.status,
      ]),
      resumo: resumoDeTotal(linhas.length),
      ...comObservacao(linhas.length),
      geradoEm: agora,
    })

    return { nomeArquivo: nomeDeArquivo('audiencias', hoje), conteudo }
  }
}
