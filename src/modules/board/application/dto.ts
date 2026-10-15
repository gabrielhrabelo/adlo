import type { Board } from "../domain/Board.ts";
import type { StatusDoProcesso } from "../domain/StatusDoProcesso.ts";

export interface CardDTO {
  id: string
  colunaId: string
  processoId: string
  titulo: string
  ordem: number
}

export interface ColunaDTO {
  id: string
  nome: string
  ordem: number
  status: StatusDoProcesso | null
  cards: CardDTO[]
}

export interface BoardDTO {
  id: string
  usuarioId: string
  nome: string
  colunas: ColunaDTO[]
  createdAt: string
}

export function toBoardDTO(board: Board): BoardDTO {
  return {
    id: board.id,
    usuarioId: board.usuarioId,
    nome: board.nome,
    colunas: board.colunas.map(coluna => ({
      id: coluna.id,
      nome: coluna.nome,
      ordem: coluna.ordem,
      status: coluna.status,
      cards: board.cards
        .filter(card => card.colunaId === coluna.id)
        .sort((a, b) => a.ordem - b.ordem)
        .map(card => ({ ...card })),
    })),
    createdAt: board.createdAt.toISOString(),
  }
}
