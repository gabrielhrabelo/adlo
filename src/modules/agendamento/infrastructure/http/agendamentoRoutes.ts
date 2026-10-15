import type { FastifyInstance } from "fastify";
import { pageQuerySchema } from "../../../../shared/application/Pagination.ts";
import type { FiltrosDeAgendamento } from "../../application/AgendamentoQueries.ts";
import type { AlterarAgendamento } from "../../application/AlterarAgendamento.ts";
import type { AcaoDeStatus, AlterarStatusDoAgendamento } from "../../application/AlterarStatusDoAgendamento.ts";
import type { ConsultarAgendamento } from "../../application/ConsultarAgendamento.ts";
import type { ExcluirAgendamento } from "../../application/ExcluirAgendamento.ts";
import type { IncluirAgendamento } from "../../application/IncluirAgendamento.ts";
import type { DadosDoAgendamentoInput } from "../../application/input.ts";
import { DURACAO_MAXIMA_MINUTOS, STATUS_AGENDAMENTO, TIPOS_AGENDAMENTO } from "../../domain/Agendamento.ts";

interface AgendamentoUseCases {
  incluirAgendamento: IncluirAgendamento
  alterarAgendamento: AlterarAgendamento
  alterarStatus: AlterarStatusDoAgendamento
  excluirAgendamento: ExcluirAgendamento
  consultarAgendamento: ConsultarAgendamento
}

const agendamentoProperties = {
  usuarioId: { type: 'string', minLength: 1 },
  processoId: { type: ['string', 'null'] },
  titulo: { type: 'string', minLength: 2, maxLength: 200 },
  tipo: { type: 'string', enum: TIPOS_AGENDAMENTO },
  dataHora: { type: 'string', format: 'date-time' },
  duracaoMinutos: { type: 'integer', minimum: 1, maximum: DURACAO_MAXIMA_MINUTOS },
  // Até 90 dias
  antecedenciaMinutos: { type: 'integer', minimum: 0, maximum: 90 * 24 * 60 },
} as const

const dataOuDataHora = { anyOf: [{ type: 'string', format: 'date' }, { type: 'string', format: 'date-time' }] } as const

const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1 } },
} as const

const ACOES: Record<string, AcaoDeStatus> = {
  confirmar: 'confirmar',
  concluir: 'concluir',
  cancelar: 'cancelar',
}

export function agendamentoRoutes(useCases: AgendamentoUseCases) {
  return async (app: FastifyInstance) => {
    // Incluir agendamento (Figura 5 / Figura 12)
    app.post<{ Body: DadosDoAgendamentoInput & { clienteId: string, titulo: string, dataHora: string } }>('/agendamentos', {
      schema: {
        body: {
          type: 'object',
          required: ['clienteId', 'titulo', 'dataHora'],
          additionalProperties: false,
          properties: { ...agendamentoProperties, clienteId: { type: 'string', minLength: 1 } },
        }
      }
    }, async (request, reply) => {
      const agendamento = await useCases.incluirAgendamento.execute({ ...request.body, usuarioLogadoId: request.userId })
      return reply.status(201).send(agendamento)
    })

    // Consultar agendamentos (lista e calendário, filtrando por período)
    app.get<{ Querystring: FiltrosDeAgendamento }>('/agendamentos', {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ...pageQuerySchema,
            clienteId: { type: 'string' },
            usuarioId: { type: 'string' },
            processoId: { type: 'string' },
            tipo: { type: 'string', enum: TIPOS_AGENDAMENTO },
            status: { type: 'array', items: { type: 'string', enum: STATUS_AGENDAMENTO } },
            de: dataOuDataHora,
            ate: dataOuDataHora,
          }
        }
      }
    }, async (request) => useCases.consultarAgendamento.listar(request.query))

    // RF14 - alertas na própria plataforma: atrasados e próximos. Por padrão, do usuário logado
    app.get<{ Querystring: { usuarioId?: string, todos?: boolean, dias?: number } }>('/agendamentos/alertas', {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            usuarioId: { type: 'string' },
            todos: { type: 'boolean' },
            dias: { type: 'integer', minimum: 1, maximum: 90 },
          }
        }
      }
    }, async (request) => {
      const { usuarioId, todos, dias } = request.query

      return useCases.consultarAgendamento.alertas({
        ...(!todos && { usuarioId: usuarioId ?? request.userId }),
        ...(dias !== undefined && { dias }),
      })
    })

    // "Verificar se o horário está ocupado" (Figura 5)
    app.get<{ Querystring: { usuarioId?: string, dataHora: string, duracaoMinutos?: number, ignorarId?: string } }>('/agendamentos/disponibilidade', {
      schema: {
        querystring: {
          type: 'object',
          required: ['dataHora'],
          additionalProperties: false,
          properties: {
            usuarioId: { type: 'string' },
            dataHora: { type: 'string', format: 'date-time' },
            duracaoMinutos: agendamentoProperties.duracaoMinutos,
            ignorarId: { type: 'string' },
          }
        }
      }
    }, async (request) => {
      const { usuarioId, dataHora, duracaoMinutos, ignorarId } = request.query

      return useCases.consultarAgendamento.disponibilidade({
        usuarioId: usuarioId ?? request.userId,
        dataHora,
        ...(duracaoMinutos !== undefined && { duracaoMinutos }),
        ...(ignorarId !== undefined && { ignorarId }),
      })
    })

    app.get<{ Params: { id: string } }>('/agendamentos/:id', { schema: { params: idParams } },
      async (request) => useCases.consultarAgendamento.detalhar(request.params.id))

    // Alterar agendamento
    app.patch<{ Params: { id: string }, Body: DadosDoAgendamentoInput }>('/agendamentos/:id', {
      schema: {
        params: idParams,
        body: { type: 'object', minProperties: 1, additionalProperties: false, properties: agendamentoProperties }
      }
    }, async (request) => useCases.alterarAgendamento.execute({ ...request.body, id: request.params.id }))

    // confirmar(), cancelar() e "Marcar agendamento como concluído"
    for (const [rota, acao] of Object.entries(ACOES)) {
      app.post<{ Params: { id: string } }>(`/agendamentos/:id/${rota}`, { schema: { params: idParams } },
        async (request) => useCases.alterarStatus.execute({ id: request.params.id, acao }))
    }

    // Excluir agendamento
    app.delete<{ Params: { id: string } }>('/agendamentos/:id', { schema: { params: idParams } },
      async (request, reply) => {
        await useCases.excluirAgendamento.execute(request.params.id)
        return reply.status(204).send()
      })
  }
}
