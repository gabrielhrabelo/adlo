import type { EventBus } from "../../../shared/application/EventBus.ts";
import { Email } from "../../../shared/domain/Email.ts";
import { EmailAlreadyInUseError, UserNotFoundError } from "../domain/errors.ts";
import type { UserRepository } from "../domain/UserRepository.ts";

export class UpdateUserProfile {
  constructor(
    private readonly users: UserRepository,
    private readonly events: EventBus
  ) { }

  async execute(input: {
    userId: string
    nome?: string
    email?: string
  }) {
    const user = await this.users.findById(input.userId)

    if (!user) throw new UserNotFoundError()

    const email = input.email !== undefined ? Email.create(input.email) : undefined

    if (email && email.value !== user.email) {
      const owner = await this.users.findByEmail(email.value)
      if (owner && owner.id !== user.id) {
        throw new EmailAlreadyInUseError()
      }
    }

    user.atualizar({
      ...(input.nome !== undefined && { nome: input.nome }),
      ...(email && { email })
    })
    await this.users.save(user)
    await this.events.publish(user.pullEvents())
    return {
      id: user.id,
      nome: user.nome,
      email: user.email,
      papel: user.papel
    }
  }
}
