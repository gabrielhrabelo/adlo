import { ClienteNotFoundError } from "../domain/errors.ts";
import type { ClienteQueries, FiltrosDeCliente } from "./ClienteQueries.ts";

export class ConsultarCliente {
  constructor(private readonly queries: ClienteQueries) { }

  async detalhar(id: string) {
    const cliente = await this.queries.detalhar(id)

    if (!cliente) throw new ClienteNotFoundError()

    return cliente
  }

  listar(filtros: FiltrosDeCliente) {
    return this.queries.listar(filtros)
  }
}
