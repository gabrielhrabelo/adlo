import type { PrismaClient } from "../../generated/prisma/client.ts";
import type { EventBus } from "../../shared/application/EventBus.ts";
import { AnexarDocumento } from "./application/AnexarDocumento.ts";
import { ConsultarDocumentos } from "./application/ConsultarDocumentos.ts";
import { ExcluirDocumento } from "./application/ExcluirDocumento.ts";
import { ArmazenamentoLocalCriptografado } from "./infrastructure/ArmazenamentoLocalCriptografado.ts";
import { documentoRoutes } from "./infrastructure/http/documentoRoutes.ts";
import { PostgresDocumentoQueries } from "./infrastructure/PostgresDocumentoQueries.ts";
import { PostgresDocumentoRepository } from "./infrastructure/PostgresDocumentoRepository.ts";
import { PostgresReferenciasDoDocumento } from "./infrastructure/PostgresReferenciasDoDocumento.ts";

export function createDocumentoModule(deps: {
  db: PrismaClient
  events: EventBus
  diretorio: string
  segredoDeCriptografia: string
}) {
  const documentos = new PostgresDocumentoRepository(deps.db)
  const referencias = new PostgresReferenciasDoDocumento(deps.db)
  const armazenamento = new ArmazenamentoLocalCriptografado(deps.diretorio, deps.segredoDeCriptografia)

  const useCases = {
    anexarDocumento: new AnexarDocumento(documentos, armazenamento, referencias, deps.events),
    excluirDocumento: new ExcluirDocumento(documentos, armazenamento, referencias, deps.events),
    consultarDocumentos: new ConsultarDocumentos(new PostgresDocumentoQueries(deps.db), documentos, armazenamento, referencias),
  }

  return {
    useCases,
    routes: documentoRoutes(useCases),
  }
}
