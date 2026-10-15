import type { FastifyInstance } from "fastify";
import { pageQuerySchema } from "../../../../shared/application/Pagination.ts";
import type { AlterarSituacaoDoCliente } from "../../application/AlterarSituacaoDoCliente.ts";
import type { AtualizarCliente } from "../../application/AtualizarCliente.ts";
import type { CadastrarCliente } from "../../application/CadastrarCliente.ts";
import type { FiltrosDeCliente } from "../../application/ClienteQueries.ts";
import type { ConsultarCliente } from "../../application/ConsultarCliente.ts";
import type { DadosDoClienteInput } from "../../application/input.ts";
import { TIPOS_ENDERECO, TIPOS_TELEFONE, UFS } from "../../domain/Contato.ts";

interface ClienteUseCases {
  cadastrarCliente: CadastrarCliente
  atualizarCliente: AtualizarCliente
  alterarSituacao: AlterarSituacaoDoCliente
  consultarCliente: ConsultarCliente
}

const nullableString = (maxLength: number) => ({ type: ['string', 'null'], maxLength }) as const

const telefoneSchema = {
  type: 'object',
  required: ['numero'],
  additionalProperties: false,
  properties: {
    tipo: { type: 'string', enum: TIPOS_TELEFONE },
    numero: { type: 'string', minLength: 8, maxLength: 20 },
  },
} as const

const enderecoSchema = {
  type: 'object',
  required: ['rua', 'cep', 'cidade', 'uf'],
  additionalProperties: false,
  properties: {
    tipo: { type: 'string', enum: TIPOS_ENDERECO },
    rua: { type: 'string', minLength: 1, maxLength: 200 },
    numero: nullableString(20),
    complemento: nullableString(120),
    bairro: nullableString(120),
    cep: { type: 'string', minLength: 8, maxLength: 9 },
    cidade: { type: 'string', minLength: 1, maxLength: 120 },
    uf: { type: 'string', enum: UFS },
  },
} as const

const clienteProperties = {
  usuarioId: { type: 'string', minLength: 1 },
  nome: { type: 'string', minLength: 2, maxLength: 160 },
  cpfCnpj: nullableString(18),
  email: nullableString(254),
  dataNascimento: { type: ['string', 'null'], format: 'date' },
  observacoes: nullableString(5000),
  telefones: { type: 'array', maxItems: 10, items: telefoneSchema },
  enderecos: { type: 'array', maxItems: 5, items: enderecoSchema },
} as const

const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1 } },
} as const

export function clienteRoutes(useCases: ClienteUseCases) {
  return async (app: FastifyInstance) => {
    // RF02 - Cadastrar cliente
    app.post<{ Body: DadosDoClienteInput & { nome: string } }>('/clientes', {
      schema: {
        body: { type: 'object', required: ['nome'], additionalProperties: false, properties: clienteProperties }
      }
    }, async (request, reply) => {
      const cliente = await useCases.cadastrarCliente.execute({ ...request.body, usuarioLogadoId: request.userId })
      return reply.status(201).send(cliente)
    })

    // RF03 - Consultar cliente (busca avançada e filtros)
    app.get<{ Querystring: FiltrosDeCliente }>('/clientes', {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ...pageQuerySchema,
            busca: { type: 'string', maxLength: 160 },
            ativo: { type: 'boolean' },
            usuarioId: { type: 'string' },
            area: { type: 'string', enum: ['INSS', 'DPVAT'] },
            cidade: { type: 'string', maxLength: 120 },
            ordenarPor: { type: 'string', enum: ['nome', 'criadoEm'] },
          }
        }
      }
    }, async (request) => useCases.consultarCliente.listar(request.query))

    app.get<{ Params: { id: string } }>('/clientes/:id', { schema: { params: idParams } },
      async (request) => useCases.consultarCliente.detalhar(request.params.id))

    // RF04 - Editar cliente
    app.patch<{ Params: { id: string }, Body: DadosDoClienteInput }>('/clientes/:id', {
      schema: {
        params: idParams,
        body: { type: 'object', minProperties: 1, additionalProperties: false, properties: clienteProperties }
      }
    }, async (request) => useCases.atualizarCliente.execute({ ...request.body, id: request.params.id }))

    // RF05 - Inativar cliente
    app.post<{ Params: { id: string } }>('/clientes/:id/inativar', { schema: { params: idParams } },
      async (request) => useCases.alterarSituacao.execute({ id: request.params.id, ativo: false }))

    app.post<{ Params: { id: string } }>('/clientes/:id/ativar', { schema: { params: idParams } },
      async (request) => useCases.alterarSituacao.execute({ id: request.params.id, ativo: true }))
  }
}
