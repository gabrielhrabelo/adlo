import type { PrismaClient } from "../../generated/prisma/client.ts";
import type { EventBus } from "../../shared/application/EventBus.ts";
import { AlterarAgendamento } from "./application/AlterarAgendamento.ts";
import { AlterarStatusDoAgendamento } from "./application/AlterarStatusDoAgendamento.ts";
import { ConsultarAgendamento } from "./application/ConsultarAgendamento.ts";
import { EnviarAlertas, type Logger } from "./application/EnviarAlertas.ts";
import { ExcluirAgendamento } from "./application/ExcluirAgendamento.ts";
import { IncluirAgendamento } from "./application/IncluirAgendamento.ts";
import { systemClock, type Clock, type Notificador } from "./application/ports.ts";
import { VerificadorDeHorario } from "./application/VerificadorDeHorario.ts";
import { AgendadorDeAlertas } from "./infrastructure/AgendadorDeAlertas.ts";
import { agendamentoRoutes } from "./infrastructure/http/agendamentoRoutes.ts";
import { LogNotificador } from "./infrastructure/notificadores.ts";
import { PostgresAgendamentoQueries } from "./infrastructure/PostgresAgendamentoQueries.ts";
import { PostgresAgendamentoRepository } from "./infrastructure/PostgresAgendamentoRepository.ts";
import { PostgresAlertaStore } from "./infrastructure/PostgresAlertaStore.ts";
import { PostgresReferenciasDoAgendamento } from "./infrastructure/PostgresReferenciasDoAgendamento.ts";

export function createAgendamentoModule(deps: {
  db: PrismaClient
  events: EventBus
  logger: Logger
  // Sem notificador, os alertas ficam só na plataforma e no log
  notificador?: Notificador
  intervaloDosAlertasMs?: number
  clock?: Clock
}) {
  const clock = deps.clock ?? systemClock
  const agendamentos = new PostgresAgendamentoRepository(deps.db)
  const referencias = new PostgresReferenciasDoAgendamento(deps.db)
  const verificador = new VerificadorDeHorario(agendamentos)

  const useCases = {
    incluirAgendamento: new IncluirAgendamento(agendamentos, verificador, referencias, deps.events, clock),
    alterarAgendamento: new AlterarAgendamento(agendamentos, verificador, referencias, deps.events, clock),
    alterarStatus: new AlterarStatusDoAgendamento(agendamentos, deps.events, clock),
    excluirAgendamento: new ExcluirAgendamento(agendamentos, deps.events),
    consultarAgendamento: new ConsultarAgendamento(new PostgresAgendamentoQueries(deps.db), verificador, clock),
    enviarAlertas: new EnviarAlertas(
      new PostgresAlertaStore(deps.db),
      deps.notificador ?? new LogNotificador(deps.logger),
      clock,
      deps.logger,
    ),
  }

  return {
    useCases,
    routes: agendamentoRoutes(useCases),
    // RF14 - iniciado/parado pelo ciclo de vida da aplicação
    alertas: new AgendadorDeAlertas(useCases.enviarAlertas, deps.logger, deps.intervaloDosAlertasMs),
  }
}
