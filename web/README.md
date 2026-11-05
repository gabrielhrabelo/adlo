# ADLO Web

Frontend do ADLO, feito com React, TypeScript e Vite. O Kanban autentica na API e usa os quadros, processos e clientes registrados no banco do escritório. Clientes e Agendamento aparecem na navegação como recursos em breve.

## Desenvolvimento

Requer Node.js e pnpm instalados. Inicie o backend primeiro, configure `CORS_ORIGINS` no `.env` da raiz e crie um usuário e clientes reais.

```bash
cd web
Copy-Item .env.example .env
pnpm install
pnpm dev
```

Defina `VITE_API_URL` em `web/.env` se o backend não estiver em `http://localhost:3333`. A tela pede login e guarda o token apenas durante a sessão do navegador. O botão **Novo processo** cria um processo para um cliente ativo e o adiciona ao quadro.

## Build

```bash
pnpm build
pnpm preview
```

