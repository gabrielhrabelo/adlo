import type { PrismaClient } from "../../generated/prisma/client.ts";
import { GerarRelatorioDeAudiencias } from "./application/GerarRelatorioDeAudiencias.ts";
import { GerarRelatorioDeClientes } from "./application/GerarRelatorioDeClientes.ts";
import { GerarRelatorioDeProcessos } from "./application/GerarRelatorioDeProcessos.ts";
import { ObterIndicadores } from "./application/ObterIndicadores.ts";
import { relatorioRoutes } from "./infrastructure/http/relatorioRoutes.ts";
import { PdfKitGeradorDePdf } from "./infrastructure/PdfKitGeradorDePdf.ts";
import { PostgresRelatorioQueries } from "./infrastructure/PostgresRelatorioQueries.ts";

export function createRelatorioModule(deps: { db: PrismaClient }) {
  const queries = new PostgresRelatorioQueries(deps.db)
  const pdf = new PdfKitGeradorDePdf()

  const useCases = {
    gerarRelatorioDeClientes: new GerarRelatorioDeClientes(queries, pdf),
    gerarRelatorioDeProcessos: new GerarRelatorioDeProcessos(queries, pdf),
    gerarRelatorioDeAudiencias: new GerarRelatorioDeAudiencias(queries, pdf),
    obterIndicadores: new ObterIndicadores(queries),
  }

  return {
    useCases,
    routes: relatorioRoutes(useCases),
  }
}
