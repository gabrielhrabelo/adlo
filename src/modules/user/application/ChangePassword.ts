import type { EventBus } from "../../../shared/application/EventBus.ts";
import { InvalidCredentialsError, UserNotFoundError } from "../domain/errors.ts";
import { Password } from "../domain/Password.ts";
import type { UserRepository } from "../domain/UserRepository.ts";
import type { PasswordHasher } from "./ports.ts";

export class ChangePassword {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly events: EventBus
  ) { }

  async execute(input: {
    userId: string
    senhaAtual: string
    novaSenha: string
  }): Promise<void> {
    const user = await this.users.findById(input.userId)

    if (!user) throw new UserNotFoundError()

    if (!(await this.hasher.compare(input.senhaAtual, user.senhaHash))) {
      throw new InvalidCredentialsError()
    }

    const novaSenha = Password.create(input.novaSenha)

    user.alterarSenha(await this.hasher.hash(novaSenha.value))
    await this.users.save(user)
    await this.events.publish(user.pullEvents())
  }
}
