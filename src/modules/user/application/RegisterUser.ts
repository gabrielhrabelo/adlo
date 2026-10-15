import type { EventBus } from "../../../shared/application/EventBus.ts";
import { Email } from "../../../shared/domain/Email.ts";
import { EmailAlreadyInUseError } from "../domain/errors.ts";
import type { Papel } from "../domain/Papel.ts";
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
    senha: string
    papel?: Papel
  }) {
    const email = Email.create(input.email)
    const password = Password.create(input.senha)

    if (await this.users.findByEmail(email.value)) {
      throw new EmailAlreadyInUseError()
    }

    const user = User.create({
      nome: input.nome,
      email,
      senhaHash: await this.hasher.hash(password.value),
      ...(input.papel && { papel: input.papel })
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
