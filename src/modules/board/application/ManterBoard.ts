import type { EventBus } from "../../../shared/application/EventBus.ts";
import { Board, type DadosDaColuna } from "../domain/Board.ts";
import type { BoardRepository } from "../domain/BoardRepository.ts";
import { BoardNotFoundError } from "../domain/errors.ts";
import { toBoardDTO } from "./dto.ts";

// "Manter Board" (Figura 3 / Figura 13): incluir, alterar e excluir board
export class ManterBoard {
  constructor(
    private readonly boards: BoardRepository,
    private readonly events: EventBus
  ) { }

  async criar(input: { usuarioLogadoId: string, nome: string, colunas?: DadosDaColuna[] }) {
    const board = Board.criar({
      usuarioId: input.usuarioLogadoId,
      nome: input.nome,
      ...(input.colunas && { colunas: input.colunas }),
    })

    await this.boards.save(board)
    await this.events.publish(board.pullEvents())

    return toBoardDTO(board)
  }

  async renomear(input: { id: string, nome: string }) {
    const board = await this.carregar(input.id)

    board.renomear(input.nome)
    await this.boards.save(board)
    await this.events.publish(board.pullEvents())

    return toBoardDTO(board)
  }

  async excluir(id: string): Promise<void> {
    const board = await this.carregar(id)

    board.excluir()
    await this.boards.delete(board)
    await this.events.publish(board.pullEvents())
  }

  private async carregar(id: string): Promise<Board> {
    const board = await this.boards.findById(id)
    if (!board) throw new BoardNotFoundError()
    return board
  }
}
