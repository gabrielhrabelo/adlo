import type { PrismaClient } from "../../generated/prisma/client.ts";
import type { EventBus } from "../../shared/application/EventBus.ts";
import { AuthenticateUser } from "./application/AuthenticateUser.ts";
import { ChangePassword } from "./application/ChangePassword.ts";
import { GetUserProfile } from "./application/GetUserProfile.ts";
import { RegisterUser } from "./application/RegisterUser.ts";
import { UpdateUserProfile } from "./application/UpdateUserProfile.ts";
import { authenticate } from "./infrastructure/http/authenticate.ts";
import { userRoutes } from "./infrastructure/http/userRoutes.ts";
import { JwtTokenService } from "./infrastructure/JwtTokenService.ts";
import { PostgresUserRepository } from "./infrastructure/PostgresUserRepository.ts";
import { ScryptPasswordHasher } from "./infrastructure/ScryptPasswordHasher.ts";

export function createUserModule(deps: { db: PrismaClient, events: EventBus, jwtSecret: string }) {
  const users = new PostgresUserRepository(deps.db)
  const hasher = new ScryptPasswordHasher()
  const tokens = new JwtTokenService(deps.jwtSecret)

  const useCases = {
    registerUser: new RegisterUser(users, hasher, deps.events),
    authenticateUser: new AuthenticateUser(users, hasher, tokens),
    getUserProfile: new GetUserProfile(users),
    updateUserProfile: new UpdateUserProfile(users, deps.events),
    changePassword: new ChangePassword(users, hasher, deps.events),
  }
  const authenticateHook = authenticate(tokens)

  return {
    useCases,
    // Exposto para os demais módulos protegerem suas rotas
    authenticate: authenticateHook,
    routes: userRoutes(useCases, authenticateHook),
  }
}
