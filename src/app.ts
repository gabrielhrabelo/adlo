import Fastify from "fastify";
import { createAgendamentoModule } from "./modules/agendamento/index.ts";
import { EmailNotificador } from "./modules/agendamento/infrastructure/notificadores.ts";
import { createAtendimentoModule } from "./modules/atendimento/index.ts";
import { createBoardModule } from "./modules/board/index.ts";
import { createClienteModule } from "./modules/cliente/index.ts";
import { createDocumentoModule } from "./modules/documento/index.ts";
import { createProcessoModule } from "./modules/processo/index.ts";
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
  const processo = createProcessoModule({ db, events })
  const atendimento = createAtendimentoModule({ db, events })
  const board = createBoardModule({
    db,
    events,
    alterarStatusDoProcesso: (input) => processo.useCases.alterarStatus.execute(input),
  })
  const documento = createDocumentoModule({
    db,
    events,
    diretorio: process.env['DOCUMENTOS_DIR'] ?? 'storage/documentos',
    segredoDeCriptografia: requireEnv('DOCUMENTOS_SECRET'),
  })
  const agendamento = createAgendamentoModule({
    db,
    events,
    logger: app.log,
    ...(process.env['ALERTAS_INTERVALO_MS'] && { intervaloDosAlertasMs: Number(process.env['ALERTAS_INTERVALO_MS']) }),
    ...(process.env['SMTP_HOST'] && { notificador: criarNotificadorDeEmail(process.env['SMTP_HOST']) }),
  })

  app.setErrorHandler(errorHandler)
  app.register(user.routes)

  // Rotas que exigem usuário autenticado (RNF06)
  app.register(async (protegido) => {
    protegido.addHook('preHandler', user.authenticate)
    protegido.addHook('onResponse', auditoria(db))

    protegido.register(cliente.routes)
    protegido.register(processo.routes)
    protegido.register(atendimento.routes)
    protegido.register(agendamento.routes)
    protegido.register(documento.routes)
    protegido.register(board.routes)
  })

  app.addHook('onReady', async () => { agendamento.alertas.iniciar() })
  app.addHook('onClose', async () => { await agendamento.alertas.parar() })
  app.addHook('onClose', async () => { await db.$disconnect() })

  return app
}

function criarNotificadorDeEmail(host: string): EmailNotificador {
  const port = Number(process.env['SMTP_PORT'] ?? 587)
  const user = process.env['SMTP_USER']
  const pass = process.env['SMTP_PASS']

  return new EmailNotificador({
    host,
    port,
    secure: port === 465,
    from: process.env['SMTP_FROM'] ?? user ?? 'adlo@localhost',
    ...(user && { user }),
    ...(pass && { pass }),
  })
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Variável de ambiente ${name} não definida`)
  return value
}
