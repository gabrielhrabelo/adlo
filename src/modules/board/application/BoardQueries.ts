import type { StatusDoProcesso } from "../domain/StatusDoProcesso.ts";

export interface BoardResumoDTO {
  id: string
  nome: string
  usuario: { id: string, nome: string }
  totalColunas: number
  totalCards: number
  createdAt: string
}

export interface CardDetalheDTO {
  id: string
  colunaId: string
  titulo: string
  ordem: number
  processo: {
    id: string
    numeroProcesso: string | null
    titulo: string
    area: 'INSS' | 'DPVAT'
    status: StatusDoProcesso
    cliente: { id: string, nome: string }
    proximoAgendamento: { id: string, titulo: string, tipo: string, dataHora: string } | null
  }
}

export interface BoardDetalheDTO {
  id: string
  nome: string
  usuario: { id: string, nome: string }
  createdAt: string
  colunas: {
    id: string
    nome: string
    ordem: number
    status: StatusDoProcesso | null
    cards: CardDetalheDTO[]
  }[]
}

// RF16 - Visualizar quadro kanban de processos
export interface BoardQueries {
  listar(filtros: { usuarioId?: string }): Promise<BoardResumoDTO[]>
  detalhar(id: string): Promise<BoardDetalheDTO | null>
}
