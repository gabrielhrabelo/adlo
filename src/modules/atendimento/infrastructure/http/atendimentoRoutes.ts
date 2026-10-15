import type { FastifyInstance } from "fastify";
import { pageQuerySchema } from "../../../../shared/application/Pagination.ts";
import type { FiltrosDeAtendimento } from "../../application/AtendimentoQueries.ts";
import type { ConsultarAtendimentos } from "../../application/ConsultarAtendimentos.ts";
import type { ExcluirAtendimento } from "../../application/ExcluirAtendimento.ts";
import type { RegistrarAtendimento } from "../../application/RegistrarAtendimento.ts";
import { CANAIS, type CanalDeAtendimento } from "../../domain/Atendimento.ts";

interface AtendimentoUseCases {
  registrarAtendimento: RegistrarAtendimento
  excluirAtendimento: ExcluirAtendimento
  consultarAtendimentos: ConsultarAtendimentos
}

const clienteParams = {
  type: 'object',
  required: ['clienteId'],
  properties: { clienteId: { type: 'string', minLength: 1 } },
} as const

const atendimentoParams = {
  type: 'object',
  required: ['clienteId', 'id'],
  properties: { clienteId: { type: 'string', minLength: 1 }, id: { type: 'string', minLength: 1 } },
} as const

interface RegistrarBody {
  processoId?: string | null
  assunto: string
  conteudo: string
  canal?: CanalDeAtendimento
  ocorridoEm?: string
}

export function atendimentoRoutes(useCases: AtendimentoUseCases) {
  return async (app: FastifyInstance) => {
    // RF10 - Registrar atendimento (incluir nota do cliente)
    app.post<{ Params: { clienteId: string }, Body: RegistrarBody }>('/clientes/:clienteId/atendimentos', {
      schema: {
        params: clienteParams,
        body: {
          type: 'object',
          required: ['assunto', 'conteudo'],
          additionalProperties: false,
          properties: {
            processoId: { type: ['string', 'null'] },
            assunto: { type: 'string', minLength: 2, maxLength: 200 },
            conteudo: { type: 'string', minLength: 1, maxLength: 20000 },
            canal: { type: 'string', enum: CANAIS },
            ocorridoEm: { type: 'string', format: 'date-time' },
          }
        }
      }
    }, async (request, reply) => {
      const atendimento = await useCases.registrarAtendimento.execute({
        ...request.body,
        clienteId: request.params.clienteId,
        usuarioLogadoId: request.userId,
      })
      return reply.status(201).send(atendimento)
    })

    // RF11 - Consultar histórico de atendimentos por cliente
    app.get<{ Params: { clienteId: string }, Querystring: Omit<FiltrosDeAtendimento, 'clienteId'> }>('/clientes/:clienteId/atendimentos', {
      schema: {
        params: clienteParams,
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ...pageQuerySchema,
            canal: { type: 'string', enum: CANAIS },
            processoId: { type: 'string' },
            de: { anyOf: [{ type: 'string', format: 'date' }, { type: 'string', format: 'date-time' }] },
            ate: { anyOf: [{ type: 'string', format: 'date' }, { type: 'string', format: 'date-time' }] },
            busca: { type: 'string', maxLength: 200 },
          }
        }
      }
    }, async (request) => useCases.consultarAtendimentos.historico({ ...request.query, clienteId: request.params.clienteId }))

    app.get<{ Params: { clienteId: string, id: string } }>('/clientes/:clienteId/atendimentos/:id', {
      schema: { params: atendimentoParams }
    }, async (request) => useCases.consultarAtendimentos.detalhar(request.params.id, request.params.clienteId))

    // Excluir nota do cliente (Figura 4): somente o autor ou um advogado
    app.delete<{ Params: { clienteId: string, id: string } }>('/clientes/:clienteId/atendimentos/:id', {
      schema: { params: atendimentoParams }
    }, async (request, reply) => {
      await useCases.excluirAtendimento.execute({
        id: request.params.id,
        clienteId: request.params.clienteId,
        usuarioLogadoId: request.userId,
      })
      return reply.status(204).send()
    })
  }
}
