import type { EventBus } from "../../../shared/application/EventBus.ts";
import { EmailAlreadyInUseError } from "../domain/errors.ts";
import { Password } from "../domain/Password.ts";
import { User } from "../domain/User.ts";
import type { UserRepository } from "../domain/UserRepository.ts";
import type { PasswordHasher } from "./ports.ts";

export class RegisterUser {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly events: EventBus
  ) { }

  async execute(input: {
    nome: string
    email: string
    password: string
  }) {
    const password = Password.create(input.password)

    if (await this.users.findByEmail(input.email)) {
      throw new EmailAlreadyInUseError()
    }

    const user = User.create({
      nome: input.nome,
      email: input.email,
      senhaHash: await this.hasher.hash(password.value)
    })
    await this.users.save(user)
    await this.events.publish(user.pullEvents())
    return {
      id: user.id,
      nome: user.nome,
      email: user.email
    }
  }


}
