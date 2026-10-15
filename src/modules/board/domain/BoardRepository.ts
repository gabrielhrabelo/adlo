import type { Board } from "./Board.ts";

export interface BoardRepository {
  save(board: Board): Promise<void>
  findById(id: string): Promise<Board | null>
  // Boards que possuem card do processo (para sincronizar o status)
  findByProcesso(processoId: string): Promise<Board[]>
  delete(board: Board): Promise<void>
}
