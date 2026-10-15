# ADLO

Sistema de gestão para escritórios de advocacia, desenvolvido para centralizar o cadastro de clientes, o acompanhamento de processos jurídicos e a organização da rotina do escritório.

> **Status:** em desenvolvimento. A estrutura do backend está sendo construída de forma modular; os recursos disponíveis podem variar conforme a etapa de implementação.

## Objetivos

- Centralizar informações de clientes e usuários do escritório.
- Apoiar a organização de atendimentos e agendamentos.
- Facilitar o registro e o acompanhamento de processos jurídicos.
- Criar uma base extensível para relatórios e futuras funcionalidades de gestão.

## Tecnologias

- **Node.js** e **TypeScript**
- **Fastify 5** para a camada HTTP
- **Prisma ORM 7** para acesso ao banco de dados
- **PostgreSQL 17** como banco de dados
- **JWT** para autenticação
- **pnpm 12** para gerenciamento de dependências
- **Docker Compose** para executar o PostgreSQL localmente

## Arquitetura

O backend segue uma organização modular inspirada em **Domain-Driven Design (DDD)**, separando responsabilidades de domínio, aplicação e infraestrutura. Os módulos de negócio ficam em `src/modules`, enquanto componentes compartilhados ficam em `src/shared`.

Estrutura principal:

```text
src/
├── app.ts                 # Configuração da aplicação Fastify e registro de módulos
├── main.ts                # Ponto de entrada
├── modules/
│   ├── agendamento/       # Agendamentos
│   ├── atendimento/       # Atendimentos
│   ├── board/             # Quadro kanban de processos
│   ├── cliente/           # Gestão de clientes
│   ├── documento/         # Documentos anexados aos clientes
│   ├── processo/          # Processos jurídicos
│   ├── relatorio/         # Relatórios
│   └── user/              # Usuários e autenticação
├── prisma/
│   ├── schema.prisma      # Modelo de dados
│   └── migrations/        # Migrações do banco
├── scripts/               # Scripts auxiliares
└── shared/
    ├── application/       # Componentes compartilhados da aplicação
    ├── domain/            # Abstrações de domínio
    └── infrastructure/    # Implementações técnicas compartilhadas
```

A estrutura acima representa a organização do projeto; nem todos os módulos listados necessariamente possuem funcionalidades completas.

O barramento de eventos compartilhado utiliza atualmente uma implementação em memória (`InMemoryEventBus`). Isso é útil para desacoplar módulos durante o desenvolvimento, mas não oferece persistência de eventos entre reinicializações.

## Pré-requisitos

- Node.js compatível com as versões utilizadas pelo projeto
- pnpm **12.11.2**
- Docker e Docker Compose

## Como executar localmente

### 1. Clone o repositório

```bash
git clone https://github.com/gabrielhrabelo/adlo.git
cd adlo
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite o arquivo `.env` e configure, no mínimo:

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DATABASE`
- `DATABASE_URL`
- `JWT_SECRET`
- `DOCUMENTOS_SECRET` (recomendado)

Use segredos fortes, com pelo menos 32 caracteres. Não compartilhe nem versione seu arquivo `.env`.

`DOCUMENTOS_SECRET` deriva a chave AES-256-GCM usada para cifrar os documentos anexados em disco. Se ele for trocado, os arquivos já enviados deixam de poder ser lidos. Sem ele, a aplicação usa o `JWT_SECRET` e registra um aviso no log; nesse caso, trocar o `JWT_SECRET` também torna os documentos ilegíveis.

Variáveis opcionais:

| Variável | Descrição |
| --- | --- |
| `DOCUMENTOS_DIR` | Diretório dos documentos anexados (padrão: `storage/documentos`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Envio dos alertas de prazos e audiências por e-mail. Sem `SMTP_HOST`, os alertas ficam apenas na plataforma e no log |
| `ALERTAS_INTERVALO_MS` | Intervalo da varredura de alertas (padrão: `60000`) |

Exemplo de formato para a conexão com o banco:

```env
DATABASE_URL="postgresql://adlo:sua-senha@localhost:5432/adlo"
JWT_SECRET="substitua-por-um-segredo-forte-com-pelo-menos-32-caracteres"
PORT=3333
```

Se a senha do banco contiver caracteres especiais, codifique-os corretamente na URL de conexão.

### 3. Inicie o PostgreSQL

```bash
docker compose up -d database
```

### 4. Instale as dependências

```bash
pnpm install
```

### 5. Gere o Prisma Client e aplique as migrações

```bash
pnpm db:generate
pnpm db:migrate
```

O comando de migração do Prisma pode solicitar um nome para a migração quando houver alterações pendentes no schema.

### 6. Inicie a aplicação

```bash
pnpm dev
```

A porta padrão configurada no exemplo de ambiente é `3333`. Confira os logs do servidor para confirmar a inicialização.

### 7. Crie o primeiro usuário e teste a API

```bash
pnpm user:create "Advogado" advogado@adlo.local Senha123
```

A pasta [`bruno/`](./bruno) contém uma coleção do [Bruno](https://www.usebruno.com/) com todas as rotas. Abra a pasta no Bruno, selecione o ambiente **Local** e execute **Auth > Login**; os ids criados nas requisições seguintes são salvos automaticamente nas variáveis de ambiente.

## Scripts disponíveis

| Comando | Descrição |
| --- | --- |
| `pnpm dev` | Executa a aplicação em modo de desenvolvimento com reinicialização automática |
| `pnpm start` | Inicia a aplicação |
| `pnpm typecheck` | Verifica os tipos TypeScript |
| `pnpm test` | Executa os testes |
| `pnpm db:generate` | Gera o Prisma Client |
| `pnpm db:migrate` | Executa o fluxo de migrações de desenvolvimento |
| `pnpm db:studio` | Abre o Prisma Studio |
| `pnpm user:create` | Executa o script de criação de usuário |

## Funcionalidades e módulos

A aplicação está sendo organizada para contemplar:

- **Usuários e autenticação** (`/auth`, `/usuarios`): autenticação por token e proteção de rotas.
- **Clientes** (`/clientes`): cadastro, busca, edição, inativação e reativação.
- **Processos jurídicos** (`/processos`): cadastro, edição, status, arquivamento e exclusão.
- **Atendimentos** (`/clientes/:clienteId/atendimentos`): histórico de atendimentos por cliente.
- **Agendamentos** (`/agendamentos`): prazos, audiências e compromissos, com verificação de horário ocupado e alertas automáticos na plataforma e por e-mail.
- **Documentos** (`/clientes/:clienteId/documentos`): anexos do cliente, cifrados em repouso.
- **Board** (`/boards`): quadro kanban de processos; mover um card atualiza o status do processo.
- **Relatórios** (`/relatorios`): relatórios de clientes, processos e audiências em PDF e indicadores do dashboard.

Consulte o código atual para verificar quais operações já estão implementadas.

## Segurança

- Configure valores reais e fortes no arquivo `.env`.
- Nunca envie credenciais, tokens ou dados reais de clientes para o repositório.
- Utilize dados fictícios em ambientes de desenvolvimento e testes.
- Antes de disponibilizar a aplicação em produção, revise autenticação, autorização, validação de entradas, logs, tratamento de erros e política de backups.

## Contribuição

Contribuições não são aceitas no momento. Apenas para os integrantes do projeto.

## Licença

Este projeto está licenciado sob a **MIT License**. Consulte o arquivo [`LICENSE`](./LICENSE) para ler o texto completo da licença.
