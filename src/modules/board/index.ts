import type { PrismaClient } from "../../generated/prisma/client.ts";
import type { EventBus } from "../../shared/application/EventBus.ts";
import type { DomainEvent } from "../../shared/domain/DomainEvent.ts";
import { ConsultarBoard } from "./application/ConsultarBoard.ts";
import { ManterBoard } from "./application/ManterBoard.ts";
import { ManterCards } from "./application/ManterCards.ts";
import { ManterColunas } from "./application/ManterColunas.ts";
import { SincronizarCardsDoProcesso } from "./application/SincronizarCardsDoProcesso.ts";
import type { StatusDoProcesso } from "./domain/StatusDoProcesso.ts";
import { boardRoutes } from "./infrastructure/http/boardRoutes.ts";
import { PostgresBoardQueries } from "./infrastructure/PostgresBoardQueries.ts";
import { PostgresBoardRepository } from "./infrastructure/PostgresBoardRepository.ts";
import { PostgresProcessosDoBoard } from "./infrastructure/PostgresProcessosDoBoard.ts";

// Formato do evento 'processo.status-alterado' publicado pelo módulo de processos
interface StatusDoProcessoAlterado extends DomainEvent {
  processoId: string
  para: StatusDoProcesso
}

export function createBoardModule(deps: {
  db: PrismaClient
  events: EventBus
  alterarStatusDoProcesso: (input: { id: string, status: StatusDoProcesso }) => Promise<unknown>
}) {
  const boards = new PostgresBoardRepository(deps.db)
  const processos = new PostgresProcessosDoBoard(deps.db, deps.alterarStatusDoProcesso)

  const useCases = {
    manterBoard: new ManterBoard(boards, deps.events),
    manterColunas: new ManterColunas(boards, deps.events),
    manterCards: new ManterCards(boards, processos, deps.events),
    consultarBoard: new ConsultarBoard(new PostgresBoardQueries(deps.db)),
    sincronizarCards: new SincronizarCardsDoProcesso(boards, deps.events),
  }

  deps.events.subscribe<StatusDoProcessoAlterado>('processo.status-alterado', (event) =>
    useCases.sincronizarCards.execute({ processoId: event.processoId, status: event.para }))

  return {
    useCases,
    routes: boardRoutes(useCases),
  }
}
