const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3333').replace(/\/+$/, '')

export interface UserProfile {
  id: string
  nome: string
  email: string
  papel: 'ADVOGADO' | 'ESTAGIARIO' | 'ADMINISTRATIVO'
}

export interface BoardSummary {
  id: string
  nome: string
  totalColunas: number
  totalCards: number
}

export interface BoardCard {
  id: string
  colunaId: string
  titulo: string
  ordem: number
  processo: {
    id: string
    numeroProcesso: string | null
    titulo: string
    area: 'INSS' | 'DPVAT'
    status: string
    cliente: { id: string; nome: string }
    proximoAgendamento: { id: string; titulo: string; tipo: string; dataHora: string } | null
  }
}

export interface BoardDetail {
  id: string
  nome: string
  colunas: { id: string; nome: string; ordem: number; status: string | null; cards: BoardCard[] }[]
}

export interface ProcessoResumo {
  id: string
  clienteId: string
  numeroProcesso: string | null
  titulo: string
  area: 'INSS' | 'DPVAT'
  status: string
  cliente: { id: string; nome: string }
}

export interface ClienteResumo {
  id: string
  nome: string
  ativo: boolean
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers })
  } catch {
    throw new ApiError(`Não foi possível acessar a API em ${API_URL}. Confira se o backend está em execução e se VITE_API_URL está correto.`, 0)
  }

  if (response.status === 204) return undefined as T
  const payload = await response.json().catch(() => null) as { message?: string } | null
  if (!response.ok) throw new ApiError(payload?.message ?? `A API respondeu com erro ${response.status}.`, response.status)
  return payload as T
}

export const api = {
  login: (email: string, senha: string) => request<{ token: string }>('/auth/login', undefined, {
    method: 'POST', body: JSON.stringify({ email, senha }),
  }),
  profile: (token: string) => request<UserProfile>('/usuarios/me', token),
  boards: (token: string) => request<BoardSummary[]>('/boards', token),
  board: (token: string, id: string) => request<BoardDetail>(`/boards/${encodeURIComponent(id)}`, token),
  createBoard: (token: string, nome: string) => request<{ id: string }>('/boards', token, {
    method: 'POST', body: JSON.stringify({ nome }),
  }),
  clients: (token: string, usuarioId: string) => request<{ items: ClienteResumo[] }>(`/clientes?page=1&pageSize=100&ativo=true&usuarioId=${encodeURIComponent(usuarioId)}&ordenarPor=nome`, token),
  createProcess: (token: string, input: { clienteId: string; titulo: string; area: 'INSS' | 'DPVAT' }) => request<ProcessoResumo>('/processos', token, {
    method: 'POST', body: JSON.stringify(input),
  }),
  addCard: (token: string, boardId: string, processoId: string) => request<unknown>(`/boards/${encodeURIComponent(boardId)}/cards`, token, {
    method: 'POST', body: JSON.stringify({ processoId }),
  }),
  moveCard: (token: string, boardId: string, cardId: string, colunaId: string, posicao: number) => request<unknown>(
    `/boards/${encodeURIComponent(boardId)}/cards/${encodeURIComponent(cardId)}/mover`, token, {
      method: 'POST', body: JSON.stringify({ colunaId, posicao }),
    }),
}

export const apiUrl = API_URL

