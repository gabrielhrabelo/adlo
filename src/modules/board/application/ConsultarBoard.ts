import { BoardNotFoundError } from "../domain/errors.ts";
import type { BoardQueries } from "./BoardQueries.ts";

export class ConsultarBoard {
  constructor(private readonly queries: BoardQueries) { }

  listar(filtros: { usuarioId?: string }) {
    return this.queries.listar(filtros)
  }

  async detalhar(id: string) {
    const board = await this.queries.detalhar(id)

    if (!board) throw new BoardNotFoundError()

    return board
  }
}
