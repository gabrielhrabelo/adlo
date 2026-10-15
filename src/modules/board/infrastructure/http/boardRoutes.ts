import type { FastifyInstance } from "fastify";
import type { ConsultarBoard } from "../../application/ConsultarBoard.ts";
import type { ManterBoard } from "../../application/ManterBoard.ts";
import type { ManterCards } from "../../application/ManterCards.ts";
import type { ManterColunas } from "../../application/ManterColunas.ts";
import { MAXIMO_DE_COLUNAS } from "../../domain/Board.ts";
import { STATUS_DO_PROCESSO, type StatusDoProcesso } from "../../domain/StatusDoProcesso.ts";

interface BoardUseCases {
  manterBoard: ManterBoard
  manterColunas: ManterColunas
  manterCards: ManterCards
  consultarBoard: ConsultarBoard
}

const id = { type: 'string', minLength: 1 } as const
const posicao = { type: 'integer', minimum: 0 } as const
const statusDaColuna = { anyOf: [{ type: 'string', enum: STATUS_DO_PROCESSO }, { type: 'null' }] } as const

const colunaProperties = {
  nome: { type: 'string', minLength: 1, maxLength: 60 },
  status: statusDaColuna,
} as const

const params = (...nomes: string[]) => ({
  type: 'object',
  required: nomes,
  properties: Object.fromEntries(nomes.map(nome => [nome, id])),
})

export function boardRoutes(useCases: BoardUseCases) {
  return async (app: FastifyInstance) => {
    // Incluir board. Sem colunas, cria uma coluna por etapa do processo
    app.post<{ Body: { nome: string, colunas?: { nome: string, status?: StatusDoProcesso | null }[] } }>('/boards', {
      schema: {
        body: {
          type: 'object',
          required: ['nome'],
          additionalProperties: false,
          properties: {
            nome: { type: 'string', minLength: 2, maxLength: 80 },
            colunas: {
              type: 'array',
              maxItems: MAXIMO_DE_COLUNAS,
              items: { type: 'object', required: ['nome'], additionalProperties: false, properties: colunaProperties },
            },
          }
        }
      }
    }, async (request, reply) => {
      const board = await useCases.manterBoard.criar({ ...request.body, usuarioLogadoId: request.userId })
      return reply.status(201).send(board)
    })

    // Consultar boards
    app.get<{ Querystring: { usuarioId?: string } }>('/boards', {
      schema: {
        querystring: { type: 'object', additionalProperties: false, properties: { usuarioId: { type: 'string' } } }
      }
    }, async (request) => useCases.consultarBoard.listar(request.query))

    // RF16 - Visualizar quadro kanban de processos
    app.get<{ Params: { id: string } }>('/boards/:id', { schema: { params: params('id') } },
      async (request) => useCases.consultarBoard.detalhar(request.params.id))

    // Alterar board
    app.patch<{ Params: { id: string }, Body: { nome: string } }>('/boards/:id', {
      schema: {
        params: params('id'),
        body: {
          type: 'object',
          required: ['nome'],
          additionalProperties: false,
          properties: { nome: { type: 'string', minLength: 2, maxLength: 80 } },
        }
      }
    }, async (request) => useCases.manterBoard.renomear({ id: request.params.id, nome: request.body.nome }))

    // Excluir board
    app.delete<{ Params: { id: string } }>('/boards/:id', { schema: { params: params('id') } },
      async (request, reply) => {
        await useCases.manterBoard.excluir(request.params.id)
        return reply.status(204).send()
      })

    // ---------------------------------------------------------------- colunas

    app.post<{ Params: { id: string }, Body: { nome: string, status?: StatusDoProcesso | null, posicao?: number } }>('/boards/:id/colunas', {
      schema: {
        params: params('id'),
        body: { type: 'object', required: ['nome'], additionalProperties: false, properties: { ...colunaProperties, posicao } },
      }
    }, async (request, reply) => {
      const board = await useCases.manterColunas.incluir({ ...request.body, boardId: request.params.id })
      return reply.status(201).send(board)
    })

    app.patch<{ Params: { id: string, colunaId: string }, Body: { nome?: string, status?: StatusDoProcesso | null, posicao?: number } }>('/boards/:id/colunas/:colunaId', {
      schema: {
        params: params('id', 'colunaId'),
        body: { type: 'object', minProperties: 1, additionalProperties: false, properties: { ...colunaProperties, posicao } },
      }
    }, async (request) => useCases.manterColunas.alterar({
      ...request.body,
      boardId: request.params.id,
      colunaId: request.params.colunaId,
    }))

    app.delete<{ Params: { id: string, colunaId: string } }>('/boards/:id/colunas/:colunaId', {
      schema: { params: params('id', 'colunaId') }
    }, async (request) => useCases.manterColunas.excluir({ boardId: request.params.id, colunaId: request.params.colunaId }))

    // ---------------------------------------------------------------- cards

    app.post<{ Params: { id: string }, Body: { processoId: string, titulo?: string, colunaId?: string, posicao?: number } }>('/boards/:id/cards', {
      schema: {
        params: params('id'),
        body: {
          type: 'object',
          required: ['processoId'],
          additionalProperties: false,
          properties: { processoId: id, titulo: { type: 'string', minLength: 1, maxLength: 200 }, colunaId: id, posicao },
        },
      }
    }, async (request, reply) => {
      const board = await useCases.manterCards.incluir({ ...request.body, boardId: request.params.id })
      return reply.status(201).send(board)
    })

    app.patch<{ Params: { id: string, cardId: string }, Body: { titulo: string } }>('/boards/:id/cards/:cardId', {
      schema: {
        params: params('id', 'cardId'),
        body: {
          type: 'object',
          required: ['titulo'],
          additionalProperties: false,
          properties: { titulo: { type: 'string', minLength: 1, maxLength: 200 } },
        },
      }
    }, async (request) => useCases.manterCards.alterar({
      boardId: request.params.id,
      cardId: request.params.cardId,
      titulo: request.body.titulo,
    }))

    // RF17 - Atualizar status do processo por meio do kanban
    app.post<{ Params: { id: string, cardId: string }, Body: { colunaId: string, posicao?: number } }>('/boards/:id/cards/:cardId/mover', {
      schema: {
        params: params('id', 'cardId'),
        body: { type: 'object', required: ['colunaId'], additionalProperties: false, properties: { colunaId: id, posicao } },
      }
    }, async (request) => useCases.manterCards.mover({
      ...request.body,
      boardId: request.params.id,
      cardId: request.params.cardId,
    }))

    app.delete<{ Params: { id: string, cardId: string } }>('/boards/:id/cards/:cardId', {
      schema: { params: params('id', 'cardId') }
    }, async (request) => useCases.manterCards.excluir({ boardId: request.params.id, cardId: request.params.cardId }))
  }
}
