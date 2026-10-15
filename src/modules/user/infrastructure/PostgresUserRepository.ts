import type { PrismaClient, Usuario } from "../../../generated/prisma/client.ts";
import { ConcurrencyError } from "../../../shared/domain/ConcurrencyError.ts";
import { isUniqueViolation } from "../../../shared/infrastructure/prismaErrors.ts";
import { EmailAlreadyInUseError } from "../domain/errors.ts";
import { User } from "../domain/User.ts";
import type { UserRepository } from "../domain/UserRepository.ts";

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly db: PrismaClient) {

  }

  async save(user: User): Promise<void> {
    const data = {
      nome: user.nome,
      email: user.email,
      senhaHash: user.senhaHash,
      papel: user.papel,
      ativo: user.ativo,
    }

    try {
      if (user.version === 0) {
        await this.db.usuario.create({
          data: { ...data, id: user.id, criadoEm: user.createdAt, versao: 1 }
        })
        user.markPersisted(1)
        return
      }

      const { count } = await this.db.usuario.updateMany({
        where: { id: user.id, versao: user.version },
        data: { ...data, versao: { increment: 1 } }
      })

      if (count === 0) {
        throw new ConcurrencyError('Usuário')
      }
      user.markPersisted(user.version + 1)
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new EmailAlreadyInUseError()
      }
      throw err
    }
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.db.usuario.findUnique({ where: { id } })

    return row ? toDomain(row) : null
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db.usuario.findUnique({ where: { email } })

    return row ? toDomain(row) : null
  }
}

function toDomain(row: Usuario): User {
  return User.restore({
    id: row.id,
    nome: row.nome,
    email: row.email,
    senhaHash: row.senhaHash,
    papel: row.papel,
    ativo: row.ativo,
    createdAt: row.criadoEm,
  }, row.versao)
}
