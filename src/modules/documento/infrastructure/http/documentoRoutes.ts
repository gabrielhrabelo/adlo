import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import { pageQuerySchema } from "../../../../shared/application/Pagination.ts";
import type { AnexarDocumento } from "../../application/AnexarDocumento.ts";
import type { ConsultarDocumentos } from "../../application/ConsultarDocumentos.ts";
import type { FiltrosDeDocumento } from "../../application/DocumentoQueries.ts";
import type { ExcluirDocumento } from "../../application/ExcluirDocumento.ts";
import { TAMANHO_MAXIMO_BYTES } from "../../domain/Documento.ts";
import { DocumentoInvalidoError } from "../../domain/errors.ts";
import { TIPOS_PERMITIDOS } from "../../domain/TipoDeArquivo.ts";

interface DocumentoUseCases {
  anexarDocumento: AnexarDocumento
  excluirDocumento: ExcluirDocumento
  consultarDocumentos: ConsultarDocumentos
}

const clienteParams = {
  type: 'object',
  required: ['clienteId'],
  properties: { clienteId: { type: 'string', minLength: 1 } },
} as const

const documentoParams = {
  type: 'object',
  required: ['clienteId', 'id'],
  properties: { clienteId: { type: 'string', minLength: 1 }, id: { type: 'string', minLength: 1 } },
} as const

// Só PDF e imagens são exibidos no navegador; os demais são sempre baixados
const EXIBIVEIS_INLINE = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])

export function documentoRoutes(useCases: DocumentoUseCases) {
  return async (app: FastifyInstance) => {
    await app.register(multipart, { limits: { fileSize: TAMANHO_MAXIMO_BYTES, files: 1 } })

    // RF12 - Anexar documento a um cliente (multipart/form-data, campo "arquivo")
    app.post<{ Params: { clienteId: string } }>('/clientes/:clienteId/documentos', {
      schema: { params: clienteParams }
    }, async (request, reply) => {
      const arquivo = await request.file()

      if (!arquivo || arquivo.fieldname !== 'arquivo') {
        throw new DocumentoInvalidoError('Envie o arquivo no campo "arquivo" (multipart/form-data)')
      }

      const documento = await useCases.anexarDocumento.execute({
        clienteId: request.params.clienteId,
        usuarioLogadoId: request.userId,
        nomeArquivo: arquivo.filename,
        tipoDeclarado: arquivo.mimetype,
        conteudo: await arquivo.toBuffer(),
      })
      return reply.status(201).send(documento)
    })

    // Consultar documentos do cliente
    app.get<{ Params: { clienteId: string }, Querystring: Omit<FiltrosDeDocumento, 'clienteId'> }>('/clientes/:clienteId/documentos', {
      schema: {
        params: clienteParams,
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ...pageQuerySchema,
            busca: { type: 'string', maxLength: 255 },
            tipo: { type: 'string', enum: TIPOS_PERMITIDOS },
          }
        }
      }
    }, async (request) => useCases.consultarDocumentos.listar({ ...request.query, clienteId: request.params.clienteId }))

    app.get<{ Params: { clienteId: string, id: string } }>('/clientes/:clienteId/documentos/:id', {
      schema: { params: documentoParams }
    }, async (request) => useCases.consultarDocumentos.detalhar(request.params.id, request.params.clienteId))

    // visualizar() e baixar() do diagrama de classes
    app.get<{ Params: { clienteId: string, id: string }, Querystring: { download?: boolean } }>('/clientes/:clienteId/documentos/:id/conteudo', {
      schema: {
        params: documentoParams,
        querystring: { type: 'object', additionalProperties: false, properties: { download: { type: 'boolean' } } },
      }
    }, async (request, reply) => {
      const arquivo = await useCases.consultarDocumentos.baixar(request.params.id, request.params.clienteId)
      const inline = !request.query.download && EXIBIVEIS_INLINE.has(arquivo.tipo)

      return reply
        .header('Content-Type', arquivo.tipo)
        .header('Content-Length', arquivo.conteudo.length)
        .header('Content-Disposition', contentDisposition(inline ? 'inline' : 'attachment', arquivo.nomeArquivo))
        .header('X-Content-Type-Options', 'nosniff')
        .header('Cache-Control', 'private, no-store')
        .send(arquivo.conteudo)
    })

    // RF13 - Excluir documento
    app.delete<{ Params: { clienteId: string, id: string } }>('/clientes/:clienteId/documentos/:id', {
      schema: { params: documentoParams }
    }, async (request, reply) => {
      await useCases.excluirDocumento.execute({
        id: request.params.id,
        clienteId: request.params.clienteId,
        usuarioLogadoId: request.userId,
      })
      return reply.status(204).send()
    })
  }
}

// RFC 6266: nome ASCII de reserva e o nome original em UTF-8
function contentDisposition(tipo: 'inline' | 'attachment', nome: string): string {
  const ascii = nome.normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '') || 'documento'
  return `${tipo}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`
}
