import { ProcessoNotFoundError } from "../domain/errors.ts";
import type { FiltrosDeProcesso, ProcessoQueries } from "./ProcessoQueries.ts";

export class ConsultarProcesso {
  constructor(private readonly queries: ProcessoQueries) { }

  async detalhar(id: string) {
    const processo = await this.queries.detalhar(id)

    if (!processo) throw new ProcessoNotFoundError()

    return processo
  }

  listar(filtros: FiltrosDeProcesso) {
    return this.queries.listar(filtros)
  }
}
