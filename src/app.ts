import Fastify from "fastify";
import { createClienteModule } from "./modules/cliente/index.ts";
import { createUserModule } from "./modules/user/index.ts";
import { db } from "./prisma/db.ts";
import { InMemoryEventBus } from "./shared/infrastructure/InMemoryEventBus.ts";
import { auditoria } from "./shared/infrastructure/http/auditoria.ts";
import { errorHandler } from "./shared/infrastructure/http/errorHandler.ts";

export function buildApp() {
  const app = Fastify({ logger: true })
  const events = new InMemoryEventBus()

  const user = createUserModule({ db, events, jwtSecret: requireEnv('JWT_SECRET') })
  const cliente = createClienteModule({ db, events })

  app.setErrorHandler(errorHandler)
  app.register(user.routes)

  // Rotas que exigem usuário autenticado (RNF06)
  app.register(async (protegido) => {
    protegido.addHook('preHandler', user.authenticate)
    protegido.addHook('onResponse', auditoria(db))

    protegido.register(cliente.routes)
  })

  app.addHook('onClose', async () => { await db.$disconnect() })

  return app
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Variável de ambiente ${name} não definida`)
  return value
}
