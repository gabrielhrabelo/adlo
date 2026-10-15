import type { EventBus } from "../../../shared/application/EventBus.ts";
import type { Board } from "../domain/Board.ts";
import type { BoardRepository } from "../domain/BoardRepository.ts";
import { BoardNotFoundError } from "../domain/errors.ts";
import type { StatusDoProcesso } from "../domain/StatusDoProcesso.ts";
import { toBoardDTO } from "./dto.ts";

// Inclui, altera (nome, status vinculado e posição) e exclui colunas (Figura 3)
export class ManterColunas {
  constructor(
    private readonly boards: BoardRepository,
    private readonly events: EventBus
  ) { }

  incluir(input: { boardId: string, nome: string, status?: StatusDoProcesso | null, posicao?: number }) {
    return this.alterarBoard(input.boardId, board => {
      board.incluirColuna({
        nome: input.nome,
        ...(input.status !== undefined && { status: input.status }),
        ...(input.posicao !== undefined && { posicao: input.posicao }),
      })
    })
  }

  alterar(input: { boardId: string, colunaId: string, nome?: string, status?: StatusDoProcesso | null, posicao?: number }) {
    return this.alterarBoard(input.boardId, board => {
      board.alterarColuna(input.colunaId, {
        ...(input.nome !== undefined && { nome: input.nome }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.posicao !== undefined && { posicao: input.posicao }),
      })
    })
  }

  excluir(input: { boardId: string, colunaId: string }) {
    return this.alterarBoard(input.boardId, board => board.excluirColuna(input.colunaId))
  }

  private async alterarBoard(boardId: string, alteracao: (board: Board) => void) {
    const board = await this.boards.findById(boardId)
    if (!board) throw new BoardNotFoundError()

    alteracao(board)
    await this.boards.save(board)
    await this.events.publish(board.pullEvents())

    return toBoardDTO(board)
  }
}
