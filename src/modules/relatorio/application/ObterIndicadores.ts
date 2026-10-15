import { hojeNoEscritorio, inicioDoMes, somarDias, inicioDoDia } from "./formatacao.ts";
import { STATUS_DO_PROCESSO, type Area, type RelatorioQueries, type StatusDoProcesso } from "./ports.ts";

const STATUS_ENCERRADOS: readonly StatusDoProcesso[] = ['CONCLUIDO', 'ARQUIVADO']
const DIAS_PROXIMOS = 7
const DIAS_ATENDIMENTOS = 30

// Indicadores do dashboard (seção 1.4): prazos próximos, processos ativos e produtividade da equipe
export class ObterIndicadores {
  constructor(
    private readonly queries: RelatorioQueries,
    private readonly agora: () => Date = () => new Date()
  ) { }

  async execute() {
    const agora = this.agora()
    const hoje = hojeNoEscritorio(agora)

    const dados = await this.queries.indicadores({
      agora,
      limiteProximos: new Date(agora.getTime() + DIAS_PROXIMOS * 24 * 60 * 60 * 1000),
      inicioAtendimentos: inicioDoDia(somarDias(hoje, -DIAS_ATENDIMENTOS)),
      inicioDoMes: inicioDoMes(agora),
    })

    const processosPorStatus = Object.fromEntries(
      STATUS_DO_PROCESSO.map(status => [status, dados.processosPorStatus[status] ?? 0])
    ) as Record<StatusDoProcesso, number>
    const processosPorArea: Record<Area, number> = {
      INSS: dados.processosPorArea.INSS ?? 0,
      DPVAT: dados.processosPorArea.DPVAT ?? 0,
    }
    const proximos = {
      prazos: dados.proximosPorTipo.PRAZO ?? 0,
      audiencias: dados.proximosPorTipo.AUDIENCIA ?? 0,
      compromissos: dados.proximosPorTipo.COMPROMISSO ?? 0,
    }

    return {
      geradoEm: agora.toISOString(),
      clientesAtivos: dados.clientesAtivos,
      processos: {
        ativos: STATUS_DO_PROCESSO
          .filter(s => !STATUS_ENCERRADOS.includes(s))
          .reduce((total, s) => total + processosPorStatus[s], 0),
        porStatus: processosPorStatus,
        porArea: processosPorArea,
        concluidosNoMes: dados.processosConcluidosNoMes,
      },
      agenda: {
        proximosDias: DIAS_PROXIMOS,
        proximos: { ...proximos, total: proximos.prazos + proximos.audiencias + proximos.compromissos },
        atrasados: dados.atrasados,
        proximosEventos: dados.proximosEventos.map(e => ({ ...e, dataHora: e.dataHora.toISOString() })),
      },
      produtividade: {
        periodoDias: DIAS_ATENDIMENTOS,
        atendimentosPorUsuario: [...dados.atendimentosPorUsuario].sort((a, b) => b.total - a.total),
        totalAtendimentos: dados.atendimentosPorUsuario.reduce((total, u) => total + u.total, 0),
      },
    }
  }
}
