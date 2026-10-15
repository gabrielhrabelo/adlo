import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { InMemoryEventBus } from "../../../shared/infrastructure/InMemoryEventBus.ts";
import { EmailAlreadyInUseError, InvalidCredentialsError, UserNotFoundError } from "../domain/errors.ts";
import { User } from "../domain/User.ts";
import type { UserRepository } from "../domain/UserRepository.ts";
import { ScryptPasswordHasher } from "../infrastructure/ScryptPasswordHasher.ts";
import { AuthenticateUser } from "./AuthenticateUser.ts";
import { ChangePassword } from "./ChangePassword.ts";
import { GetUserProfile } from "./GetUserProfile.ts";
import type { TokenService } from "./ports.ts";
import { RegisterUser } from "./RegisterUser.ts";
import { UpdateUserProfile } from "./UpdateUserProfile.ts";

class InMemoryUserRepository implements UserRepository {
  readonly rows = new Map<string, User>()

  async save(user: User) {
    this.rows.set(user.id, user)
    user.markPersisted(user.version + 1)
  }

  async findById(id: string) {
    return this.rows.get(id) ?? null
  }

  async findByEmail(email: string) {
    return [...this.rows.values()].find(u => u.email === email) ?? null
  }
}

const tokens: TokenService = {
  sign: (userId) => `token:${userId}`,
  verify: (token) => ({ userId: token.replace('token:', '') }),
}

describe('casos de uso de usuário', () => {
  const hasher = new ScryptPasswordHasher()
  let users: InMemoryUserRepository
  let events: InMemoryEventBus
  let published: string[]

  beforeEach(() => {
    users = new InMemoryUserRepository()
    events = new InMemoryEventBus()
    published = []
    for (const name of ['user.user-registered', 'user.user-updated', 'user.password-changed']) {
      events.subscribe(name, async (e) => { published.push(e.name) })
    }
  })

  const register = () => new RegisterUser(users, hasher, events)
    .execute({ nome: 'Ana', email: 'Ana@X.com', senha: 'senha123' })

  it('cadastra usuário com senha com hash e publica evento', async () => {
    const out = await register()
    const saved = await users.findById(out.id)

    assert.equal(out.email, 'ana@x.com')
    assert.notEqual(saved?.senhaHash, 'senha123')
    assert.deepEqual(published, ['user.user-registered'])
  })

  it('não cadastra email repetido', async () => {
    await register()
    await assert.rejects(register(), EmailAlreadyInUseError)
  })

  it('autentica com credenciais válidas e rejeita senha errada', async () => {
    const { id } = await register()
    const auth = new AuthenticateUser(users, hasher, tokens)

    assert.deepEqual(await auth.execute({ email: ' ANA@x.com', senha: 'senha123' }), { token: `token:${id}` })
    await assert.rejects(auth.execute({ email: 'ana@x.com', senha: 'errada123' }), InvalidCredentialsError)
    await assert.rejects(auth.execute({ email: 'ninguem@x.com', senha: 'senha123' }), InvalidCredentialsError)
  })

  it('consulta perfil e falha para id inexistente', async () => {
    const { id } = await register()
    const profile = new GetUserProfile(users)

    assert.equal((await profile.execute(id)).nome, 'Ana')
    await assert.rejects(profile.execute('nao-existe'), UserNotFoundError)
  })

  it('atualiza perfil sem permitir email de outro usuário', async () => {
    const { id } = await register()
    await new RegisterUser(users, hasher, events).execute({ nome: 'Bia', email: 'bia@x.com', senha: 'senha123' })
    const update = new UpdateUserProfile(users, events)

    assert.equal((await update.execute({ userId: id, nome: 'Ana Maria' })).nome, 'Ana Maria')
    await assert.rejects(update.execute({ userId: id, email: 'bia@x.com' }), EmailAlreadyInUseError)
  })

  it('altera senha somente com a senha atual correta', async () => {
    const { id } = await register()
    const change = new ChangePassword(users, hasher, events)
    const auth = new AuthenticateUser(users, hasher, tokens)

    await assert.rejects(change.execute({ userId: id, senhaAtual: 'errada123', novaSenha: 'nova12345' }), InvalidCredentialsError)
    await change.execute({ userId: id, senhaAtual: 'senha123', novaSenha: 'nova12345' })

    await assert.rejects(auth.execute({ email: 'ana@x.com', senha: 'senha123' }), InvalidCredentialsError)
    assert.ok(await auth.execute({ email: 'ana@x.com', senha: 'nova12345' }))
    assert.ok(published.includes('user.password-changed'))
  })
})
