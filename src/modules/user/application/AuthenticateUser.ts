import { Email } from "../../../shared/domain/Email.ts";
import { InvalidCredentialsError } from "../domain/errors.ts";
import type { UserRepository } from "../domain/UserRepository.ts";
import type { PasswordHasher, TokenService } from "./ports.ts";

export class AuthenticateUser {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) { }

  async execute(input: {
    email: string,
    senha: string,
  }): Promise<{ token: string }> {

    const user = await this.users.findByEmail(Email.normalize(input.email))

    if (!user || !user.ativo || !(await this.hasher.compare(input.senha, user.senhaHash))) {
      throw new InvalidCredentialsError()
    }
    return { token: this.tokens.sign(user.id) }
  }
}
