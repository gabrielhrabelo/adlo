import type { PrismaClient } from "../../generated/prisma/client.ts";
import type { EventBus } from "../../shared/application/EventBus.ts";
import { AlterarStatusDoProcesso } from "./application/AlterarStatusDoProcesso.ts";
import { AtualizarProcesso } from "./application/AtualizarProcesso.ts";
import { CadastrarProcesso } from "./application/CadastrarProcesso.ts";
import { ConsultarProcesso } from "./application/ConsultarProcesso.ts";
import { ExcluirProcesso } from "./application/ExcluirProcesso.ts";
import { processoRoutes } from "./infrastructure/http/processoRoutes.ts";
import { PostgresClienteLookup } from "./infrastructure/PostgresClienteLookup.ts";
import { PostgresProcessoQueries } from "./infrastructure/PostgresProcessoQueries.ts";
import { PostgresProcessoRepository } from "./infrastructure/PostgresProcessoRepository.ts";

export function createProcessoModule(deps: { db: PrismaClient, events: EventBus }) {
  const processos = new PostgresProcessoRepository(deps.db)

  const useCases = {
    cadastrarProcesso: new CadastrarProcesso(processos, new PostgresClienteLookup(deps.db), deps.events),
    atualizarProcesso: new AtualizarProcesso(processos, deps.events),
    alterarStatus: new AlterarStatusDoProcesso(processos, deps.events),
    excluirProcesso: new ExcluirProcesso(processos, deps.events),
    consultarProcesso: new ConsultarProcesso(new PostgresProcessoQueries(deps.db)),
  }

  return {
    useCases,
    routes: processoRoutes(useCases),
  }
}
