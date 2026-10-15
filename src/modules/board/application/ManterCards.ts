import type { EventBus } from "../../../shared/application/EventBus.ts";
import type { Board } from "../domain/Board.ts";
import type { BoardRepository } from "../domain/BoardRepository.ts";
import { BoardNotFoundError, ProcessoDoCardNotFoundError } from "../domain/errors.ts";
import { toBoardDTO } from "./dto.ts";
import type { ProcessosDoBoard } from "./ports.ts";

// Inclui, altera, movimenta e exclui cards (Figura 3). Mover um card para uma
// coluna vinculada a um status atualiza o status do processo (RF17)
export class ManterCards {
  constructor(
    private readonly boards: BoardRepository,
    private readonly processos: ProcessosDoBoard,
    private readonly events: EventBus
  ) { }

  async incluir(input: { boardId: string, processoId: string, titulo?: string, colunaId?: string, posicao?: number }) {
    const processo = await this.processos.resumo(input.processoId)
    if (!processo) throw new ProcessoDoCardNotFoundError()

    const board = await this.carregar(input.boardId)
    // Sem coluna informada, o card entra na coluna do status atual do processo
    const colunaId = input.colunaId ?? board.colunas.find(c => c.status === processo.status)?.id

    board.incluirCard({
      processoId: input.processoId,
      titulo: input.titulo ?? (processo.numeroProcesso ? `${processo.numeroProcesso} - ${processo.titulo}` : processo.titulo),
      ...(colunaId !== undefined && { colunaId }),
      ...(input.posicao !== undefined && { posicao: input.posicao }),
    })

    return this.salvar(board)
  }

  async alterar(input: { boardId: string, cardId: string, titulo: string }) {
    const board = await this.carregar(input.boardId)

    board.alterarCard(input.cardId, { titulo: input.titulo })

    return this.salvar(board)
  }

  // RF17 - Atualizar status do processo por meio do kanban
  async mover(input: { boardId: string, cardId: string, colunaId: string, posicao?: number }) {
    const board = await this.carregar(input.boardId)
    const { processoId, status } = board.moverCard(input.cardId, input.colunaId, input.posicao)
    const dto = await this.salvar(board)

    if (status) await this.processos.alterarStatus(processoId, status)

    return dto
  }

  async excluir(input: { boardId: string, cardId: string }) {
    const board = await this.carregar(input.boardId)

    board.excluirCard(input.cardId)

    return this.salvar(board)
  }

  private async carregar(id: string): Promise<Board> {
    const board = await this.boards.findById(id)
    if (!board) throw new BoardNotFoundError()
    return board
  }

  private async salvar(board: Board) {
    await this.boards.save(board)
    await this.events.publish(board.pullEvents())

    return toBoardDTO(board)
  }
}
