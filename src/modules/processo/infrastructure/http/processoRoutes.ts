import type { FastifyInstance } from "fastify";
import { pageQuerySchema } from "../../../../shared/application/Pagination.ts";
import type { AlterarStatusDoProcesso } from "../../application/AlterarStatusDoProcesso.ts";
import type { AtualizarProcesso } from "../../application/AtualizarProcesso.ts";
import type { CadastrarProcesso } from "../../application/CadastrarProcesso.ts";
import type { ConsultarProcesso } from "../../application/ConsultarProcesso.ts";
import type { ExcluirProcesso } from "../../application/ExcluirProcesso.ts";
import type { DadosDoProcessoInput } from "../../application/input.ts";
import type { FiltrosDeProcesso } from "../../application/ProcessoQueries.ts";
import { AREAS, STATUS_DO_PROCESSO, type AreaDoProcesso, type StatusDoProcesso } from "../../domain/enums.ts";

interface ProcessoUseCases {
  cadastrarProcesso: CadastrarProcesso
  atualizarProcesso: AtualizarProcesso
  alterarStatus: AlterarStatusDoProcesso
  excluirProcesso: ExcluirProcesso
  consultarProcesso: ConsultarProcesso
}

const nullableString = (maxLength: number) => ({ type: ['string', 'null'], maxLength }) as const

const processoProperties = {
  numeroProcesso: nullableString(25),
  titulo: { type: 'string', minLength: 3, maxLength: 200 },
  area: { type: 'string', enum: AREAS },
  tribunal: nullableString(120),
  descricao: nullableString(10000),
  dataAbertura: { type: 'string', format: 'date' },
} as const

const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1 } },
} as const

export function processoRoutes(useCases: ProcessoUseCases) {
  return async (app: FastifyInstance) => {
    // RF06 - Cadastrar processo
    app.post<{ Body: DadosDoProcessoInput & { clienteId: string, titulo: string, area: AreaDoProcesso, status?: StatusDoProcesso } }>('/processos', {
      schema: {
        body: {
          type: 'object',
          required: ['clienteId', 'titulo', 'area'],
          additionalProperties: false,
          properties: {
            ...processoProperties,
            clienteId: { type: 'string', minLength: 1 },
            status: { type: 'string', enum: STATUS_DO_PROCESSO },
          }
        }
      }
    }, async (request, reply) => {
      const processo = await useCases.cadastrarProcesso.execute(request.body)
      return reply.status(201).send(processo)
    })

    // Consultar processo, com filtros
    app.get<{ Querystring: FiltrosDeProcesso }>('/processos', {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ...pageQuerySchema,
            busca: { type: 'string', maxLength: 200 },
            clienteId: { type: 'string' },
            status: { type: 'array', items: { type: 'string', enum: STATUS_DO_PROCESSO } },
            area: { type: 'string', enum: AREAS },
            incluirArquivados: { type: 'boolean' },
            ordenarPor: { type: 'string', enum: ['criadoEm', 'dataAbertura', 'titulo'] },
          }
        }
      }
    }, async (request) => useCases.consultarProcesso.listar(request.query))

    app.get<{ Params: { id: string } }>('/processos/:id', { schema: { params: idParams } },
      async (request) => useCases.consultarProcesso.detalhar(request.params.id))

    // RF07 - Editar processo
    app.patch<{ Params: { id: string }, Body: DadosDoProcessoInput }>('/processos/:id', {
      schema: {
        params: idParams,
        body: { type: 'object', minProperties: 1, additionalProperties: false, properties: processoProperties }
      }
    }, async (request) => useCases.atualizarProcesso.execute({ ...request.body, id: request.params.id }))

    // RF08 - Atualizar status do processo
    app.patch<{ Params: { id: string }, Body: { status: StatusDoProcesso } }>('/processos/:id/status', {
      schema: {
        params: idParams,
        body: {
          type: 'object',
          required: ['status'],
          additionalProperties: false,
          properties: { status: { type: 'string', enum: STATUS_DO_PROCESSO } }
        }
      }
    }, async (request) => useCases.alterarStatus.execute({ id: request.params.id, status: request.body.status }))

    // Inativar processo (Figura 1): arquiva
    app.post<{ Params: { id: string } }>('/processos/:id/arquivar', { schema: { params: idParams } },
      async (request) => useCases.alterarStatus.execute({ id: request.params.id, status: 'ARQUIVADO' }))

    // RF09 - Excluir processo (somente sem agendamentos/atendimentos)
    app.delete<{ Params: { id: string } }>('/processos/:id', { schema: { params: idParams } },
      async (request, reply) => {
        await useCases.excluirProcesso.execute(request.params.id)
        return reply.status(204).send()
      })
  }
}
