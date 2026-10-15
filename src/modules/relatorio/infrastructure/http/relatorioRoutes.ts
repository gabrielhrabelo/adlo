import type { FastifyInstance, FastifyReply } from "fastify";
import type { FiltrosDoRelatorioDeAudiencias, GerarRelatorioDeAudiencias } from "../../application/GerarRelatorioDeAudiencias.ts";
import type { GerarRelatorioDeClientes } from "../../application/GerarRelatorioDeClientes.ts";
import type { FiltrosDoRelatorioDeProcessos, GerarRelatorioDeProcessos } from "../../application/GerarRelatorioDeProcessos.ts";
import type { ObterIndicadores } from "../../application/ObterIndicadores.ts";
import { STATUS_DO_AGENDAMENTO, STATUS_DO_PROCESSO, type ArquivoDeRelatorio, type FiltrosClientes } from "../../application/ports.ts";

interface RelatorioUseCases {
  gerarRelatorioDeClientes: GerarRelatorioDeClientes
  gerarRelatorioDeProcessos: GerarRelatorioDeProcessos
  gerarRelatorioDeAudiencias: GerarRelatorioDeAudiencias
  obterIndicadores: ObterIndicadores
}

const AREAS = ['INSS', 'DPVAT'] as const
const data = { type: 'string', format: 'date' } as const

function enviarPdf(reply: FastifyReply, arquivo: ArquivoDeRelatorio) {
  return reply
    .header('Content-Type', 'application/pdf')
    .header('Content-Disposition', `attachment; filename="${arquivo.nomeArquivo}"`)
    .header('Cache-Control', 'private, no-store')
    .send(arquivo.conteudo)
}

export function relatorioRoutes(useCases: RelatorioUseCases) {
  return async (app: FastifyInstance) => {
    // RF15 - Gerar relatório de clientes (PDF)
    app.get<{ Querystring: FiltrosClientes }>('/relatorios/clientes', {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ativo: { type: 'boolean' },
            area: { type: 'string', enum: AREAS },
            usuarioId: { type: 'string' },
          }
        }
      }
    }, async (request, reply) => enviarPdf(reply, await useCases.gerarRelatorioDeClientes.execute(request.query)))

    // Relatório de processos (PDF)
    app.get<{ Querystring: FiltrosDoRelatorioDeProcessos }>('/relatorios/processos', {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            status: { type: 'string', enum: STATUS_DO_PROCESSO },
            area: { type: 'string', enum: AREAS },
            clienteId: { type: 'string' },
            abertoDe: data,
            abertoAte: data,
          }
        }
      }
    }, async (request, reply) => enviarPdf(reply, await useCases.gerarRelatorioDeProcessos.execute(request.query)))

    // Relatório de audiências (PDF); padrão: hoje até 30 dias à frente
    app.get<{ Querystring: FiltrosDoRelatorioDeAudiencias }>('/relatorios/audiencias', {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            de: data,
            ate: data,
            usuarioId: { type: 'string' },
            status: { type: 'string', enum: STATUS_DO_AGENDAMENTO },
          }
        }
      }
    }, async (request, reply) => enviarPdf(reply, await useCases.gerarRelatorioDeAudiencias.execute(request.query)))

    // Indicadores do dashboard: prazos próximos, processos ativos e produtividade da equipe
    app.get('/relatorios/indicadores', async () => useCases.obterIndicadores.execute())
  }
}
