// Cria um usuário direto no banco. Usado para o primeiro acesso, já que
// a rota POST /usuarios exige um advogado autenticado.
// Uso: pnpm user:create "<nome>" <email> <senha> [ADVOGADO|ESTAGIARIO|ADMINISTRATIVO]
import 'dotenv/config';
import { createUserModule } from "../modules/user/index.ts";
import { PAPEIS, type Papel } from "../modules/user/domain/Papel.ts";
import { db } from "../prisma/db.ts";
import { InMemoryEventBus } from "../shared/infrastructure/InMemoryEventBus.ts";

const [nome, email, senha, papel = 'ADVOGADO'] = process.argv.slice(2)

if (!nome || !email || !senha || !PAPEIS.includes(papel as Papel)) {
  console.error('Uso: pnpm user:create "<nome>" <email> <senha> [ADVOGADO|ESTAGIARIO|ADMINISTRATIVO]')
  process.exit(1)
}

const { useCases } = createUserModule({ db, events: new InMemoryEventBus(), jwtSecret: process.env['JWT_SECRET'] ?? '' })

try {
  const user = await useCases.registerUser.execute({ nome, email, senha, papel: papel as Papel })
  console.log('Usuário criado:', user)
} finally {
  await db.$disconnect()
}
