import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { DomainError, type ErrorKind } from "../../domain/DomainError.ts";

const STATUS: Record<ErrorKind, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
}

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof DomainError) {
    return reply.status(STATUS[error.kind]).send({ code: error.code, message: error.message })
  }

  if (error.validation) {
    return reply.status(400).send({ code: 'INVALID_REQUEST', message: error.message })
  }

  if (error.statusCode && error.statusCode < 500) {
    return reply.status(error.statusCode).send({ code: error.code, message: error.message })
  }

  request.log.error(error)
  return reply.status(500).send({ code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' })
}
