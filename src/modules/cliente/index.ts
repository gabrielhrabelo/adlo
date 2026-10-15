import type { PrismaClient } from "../../generated/prisma/client.ts";
import type { EventBus } from "../../shared/application/EventBus.ts";
import { AlterarSituacaoDoCliente } from "./application/AlterarSituacaoDoCliente.ts";
import { AtualizarCliente } from "./application/AtualizarCliente.ts";
import { CadastrarCliente } from "./application/CadastrarCliente.ts";
import { ConsultarCliente } from "./application/ConsultarCliente.ts";
import { clienteRoutes } from "./infrastructure/http/clienteRoutes.ts";
import { PostgresClienteQueries } from "./infrastructure/PostgresClienteQueries.ts";
import { PostgresClienteRepository } from "./infrastructure/PostgresClienteRepository.ts";

export function createClienteModule(deps: { db: PrismaClient, events: EventBus }) {
  const clientes = new PostgresClienteRepository(deps.db)

  const useCases = {
    cadastrarCliente: new CadastrarCliente(clientes, deps.events),
    atualizarCliente: new AtualizarCliente(clientes, deps.events),
    alterarSituacao: new AlterarSituacaoDoCliente(clientes, deps.events),
    consultarCliente: new ConsultarCliente(new PostgresClienteQueries(deps.db)),
  }

  return {
    useCases,
    routes: clienteRoutes(useCases),
  }
}
