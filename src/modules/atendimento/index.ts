import type { PrismaClient } from "../../generated/prisma/client.ts";
import type { EventBus } from "../../shared/application/EventBus.ts";
import { ConsultarAtendimentos } from "./application/ConsultarAtendimentos.ts";
import { ExcluirAtendimento } from "./application/ExcluirAtendimento.ts";
import { RegistrarAtendimento } from "./application/RegistrarAtendimento.ts";
import { atendimentoRoutes } from "./infrastructure/http/atendimentoRoutes.ts";
import { PostgresAtendimentoQueries } from "./infrastructure/PostgresAtendimentoQueries.ts";
import { PostgresAtendimentoRepository } from "./infrastructure/PostgresAtendimentoRepository.ts";
import { PostgresReferenciasDoAtendimento } from "./infrastructure/PostgresReferenciasDoAtendimento.ts";

export function createAtendimentoModule(deps: { db: PrismaClient, events: EventBus }) {
  const atendimentos = new PostgresAtendimentoRepository(deps.db)
  const referencias = new PostgresReferenciasDoAtendimento(deps.db)

  const useCases = {
    registrarAtendimento: new RegistrarAtendimento(atendimentos, referencias, deps.events),
    excluirAtendimento: new ExcluirAtendimento(atendimentos, referencias, deps.events),
    consultarAtendimentos: new ConsultarAtendimentos(new PostgresAtendimentoQueries(deps.db), referencias),
  }

  return {
    useCases,
    routes: atendimentoRoutes(useCases),
  }
}
