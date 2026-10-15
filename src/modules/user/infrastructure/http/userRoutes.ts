import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AuthenticateUser } from "../../application/AuthenticateUser.ts";
import type { ChangePassword } from "../../application/ChangePassword.ts";
import type { GetUserProfile } from "../../application/GetUserProfile.ts";
import type { RegisterUser } from "../../application/RegisterUser.ts";
import type { UpdateUserProfile } from "../../application/UpdateUserProfile.ts";
import { ForbiddenError } from "../../domain/errors.ts";
import { PAPEIS, type Papel } from "../../domain/Papel.ts";

interface UserUseCases {
  registerUser: RegisterUser
  authenticateUser: AuthenticateUser
  getUserProfile: GetUserProfile
  updateUserProfile: UpdateUserProfile
  changePassword: ChangePassword
}

const str = (maxLength: number) => ({ type: 'string', minLength: 1, maxLength }) as const

export function userRoutes(useCases: UserUseCases, authenticate: (request: FastifyRequest) => Promise<void>) {
  return async (app: FastifyInstance) => {
    app.post<{ Body: { email: string, senha: string } }>('/auth/login', {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'senha'],
          additionalProperties: false,
          properties: { email: str(254), senha: str(128) }
        }
      }
    }, async (request) => useCases.authenticateUser.execute(request.body))

    app.post<{ Body: { nome: string, email: string, senha: string, papel?: Papel } }>('/usuarios', {
      preHandler: authenticate,
      schema: {
        body: {
          type: 'object',
          required: ['nome', 'email', 'senha'],
          additionalProperties: false,
          properties: { nome: str(120), email: str(254), senha: str(128), papel: { type: 'string', enum: PAPEIS } }
        }
      }
    }, async (request, reply) => {
      const current = await useCases.getUserProfile.execute(request.userId)

      // Somente o advogado responsável cadastra novos acessos ao sistema
      if (current.papel !== 'ADVOGADO') throw new ForbiddenError()

      const user = await useCases.registerUser.execute(request.body)
      return reply.status(201).send(user)
    })

    app.get('/usuarios/me', { preHandler: authenticate }, async (request) =>
      useCases.getUserProfile.execute(request.userId))

    app.patch<{ Body: { nome?: string, email?: string } }>('/usuarios/me', {
      preHandler: authenticate,
      schema: {
        body: {
          type: 'object',
          minProperties: 1,
          additionalProperties: false,
          properties: { nome: str(120), email: str(254) }
        }
      }
    }, async (request) => useCases.updateUserProfile.execute({ userId: request.userId, ...request.body }))

    app.put<{ Body: { senhaAtual: string, novaSenha: string } }>('/usuarios/me/senha', {
      preHandler: authenticate,
      schema: {
        body: {
          type: 'object',
          required: ['senhaAtual', 'novaSenha'],
          additionalProperties: false,
          properties: { senhaAtual: str(128), novaSenha: str(128) }
        }
      }
    }, async (request, reply) => {
      await useCases.changePassword.execute({ userId: request.userId, ...request.body })
      return reply.status(204).send()
    })
  }
}
