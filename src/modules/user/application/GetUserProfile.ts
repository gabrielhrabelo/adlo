import { UserNotFoundError } from "../domain/errors.ts";
import type { UserRepository } from "../domain/UserRepository.ts";

export class GetUserProfile {
  constructor(private readonly users: UserRepository) { }

  async execute(userId: string) {
    const user = await this.users.findById(userId)

    if (!user) throw new UserNotFoundError()

    return {
      id: user.id,
      nome: user.nome,
      email: user.email,
      createdAt: user.createdAt.toISOString()
    }
  }
}
