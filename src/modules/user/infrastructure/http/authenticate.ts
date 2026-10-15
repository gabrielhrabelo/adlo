import type { FastifyRequest } from "fastify";
import type { TokenService } from "../../application/ports.ts";
import { InvalidTokenError } from "../../domain/errors.ts";

declare module 'fastify' {
  interface FastifyRequest {
    userId: string
  }
}

export function authenticate(tokens: TokenService) {
  return async (request: FastifyRequest) => {
    const [scheme, token] = request.headers.authorization?.split(' ') ?? []

    if (scheme !== 'Bearer' || !token) {
      throw new InvalidTokenError()
    }
    request.userId = tokens.verify(token).userId
  }
}
