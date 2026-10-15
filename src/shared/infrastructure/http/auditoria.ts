import type { FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "../../../generated/prisma/client.ts";

const METODOS_DE_ESCRITA = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// Registra em LogAuditoria toda operação de escrita bem-sucedida feita por um usuário autenticado
export function auditoria(db: PrismaClient) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!METODOS_DE_ESCRITA.has(request.method) || reply.statusCode >= 400 || !request.userId) return

    const rota = request.routeOptions.url ?? request.url
    const params = request.params as Record<string, string> | undefined

    try {
      await db.logAuditoria.create({
        data: {
          usuarioId: request.userId,
          acao: `${request.method} ${rota}`,
          tipoEntidade: rota.split('/')[1] ?? 'desconhecido',
          entidadeId: params?.['id'] ?? null,
          enderecoIp: request.ip,
        }
      })
    } catch (err) {
      request.log.error({ err }, 'Falha ao registrar auditoria')
    }
  }
}
