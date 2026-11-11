# Império Finanças

Controle de entradas e saídas do clube, separado por categoria.

Monorepo **pnpm** com duas aplicações:

| Pasta | O que é | Stack |
| --- | --- | --- |
| `apps/api` | API REST | NestJS 12, Drizzle ORM, Neon (Postgres), JWT |
| `apps/web` | Painel | React 19, Vite, TypeScript, TanStack Query, React Router, Tailwind 4 |

```
imperio-financas/
├── package.json          # scripts que rodam as duas aplicações
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── apps/
│   ├── api/
│   │   ├── drizzle/              # migrations SQL (revisadas)
│   │   ├── scripts/              # seed.ts, create-user.ts
│   │   └── src/
│   │       ├── main.ts, app.module.ts
│   │       ├── db/               # client (Neon), db.module, schema.ts
│   │       ├── auth/             # login JWT + AuthGuard
│   │       ├── categories/
│   │       ├── transactions/     # CRUD, lista com cursor, resumo
│   │       └── health/
│   └── web/
│       └── src/
│           ├── lib/              # api.ts, session.ts, types.ts, money.ts
│           ├── pages/            # login, dashboard, categorias
│           └── components/       # resumo, formulário, lista paginada, gráficos, calendários
```

## Requisitos

- Node 22 ou mais novo
- pnpm 10 (`corepack enable` já instala a versão do `packageManager`)
- Um projeto no [Neon](https://neon.tech)

## Primeira vez

```bash
pnpm install:all                 # instala as dependências da API e do front
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# preencha DATABASE_URL e DATABASE_URL_UNPOOLED no apps/api/.env com as strings do Neon
pnpm db:migrate                  # cria as tabelas no Neon
pnpm db:seed                     # categorias padrão do clube
pnpm --filter @imperio/api user:create admin "uma-senha-forte"
pnpm dev                         # sobe API (porta 3000) e front (porta 5173) juntos
```

## Comandos na raiz

| Comando | O que faz |
| --- | --- |
| `pnpm install:all` | Instala as dependências das duas aplicações |
| `pnpm install:api` / `pnpm install:web` | Instala as dependências de uma só |
| `pnpm add:api <pacote>` / `pnpm add:web <pacote>` | Adiciona um pacote só na API ou só no front |
| `pnpm dev` | Roda API e front ao mesmo tempo |
| `pnpm dev:api` / `pnpm dev:web` | Roda uma só |
| `pnpm dev:lan` | Roda as duas visíveis para a rede local (outros aparelhos no mesmo Wi-Fi). Mostra o endereço no terminal. Outro IP: `LAN_HOST=192.168.0.10 pnpm dev:lan` |
| `pnpm build` | Compila as duas |
| `pnpm typecheck` | Checa os tipos das duas |
| `pnpm db:generate` / `db:migrate` / `db:seed` / `db:studio` | Banco (repassa para a API) |
| `pnpm db:studio:lan` | Drizzle Studio visível para a rede local. Nos outros aparelhos, libere "Conteúdo não seguro" para local.drizzle.studio nas configurações do site |

## Comandos dentro de cada app

Entre na pasta (`cd apps/api` ou `cd apps/web`):

| Comando | O que faz |
| --- | --- |
| `pnpm deps` | Instala só as dependências desta aplicação |
| `pnpm add <pacote>` | Adiciona um pacote só nesta aplicação (`-D` para dev) |
| `pnpm dev` | Roda em modo desenvolvimento |
| `pnpm build` | Compila |
| `pnpm typecheck` | Checa os tipos |

Só na API: `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:studio`, `pnpm db:seed` e `pnpm user:create <usuario> <senha>`.

## Banco de dados (Neon)

- **Duas URLs:** a API usa a conexão **com pooler** (`DATABASE_URL`, host com `-pooler`). As migrations usam a **direta** (`DATABASE_URL_UNPOOLED`), porque o pooler não aceita comandos de sessão.
- **Driver:** `@neondatabase/serverless` com `Pool` via WebSocket. Funciona em Node e na Vercel e suporta transações interativas.
- **Branches:** crie um branch do Neon para desenvolvimento e outro para produção. Cada um tem a sua URL.

### Por que aguenta muito volume e responde rápido

1. **Dinheiro em centavos** (`integer`) e somas em `bigint`. Não há erro de arredondamento.
2. **IDs UUID v7**, que são ordenados no tempo, então o índice cresce no fim em vez de se fragmentar.
3. **Índice `(occurred_on, id)` parcial** (só lançamentos ativos), usado pela lista e pela paginação por cursor. Num teste com 500 mil lançamentos, a página leva **0,08 ms** (sem o índice certo levava 27 ms).
4. **Paginação por cursor** (keyset): as páginas finais custam o mesmo que a primeira. O seletor 20/50/100/200 continua igual.
5. **Busca por descrição** com índice GIN `pg_trgm`, para o `ilike '%texto%'` não varrer a tabela (8 ms em 500 mil linhas).
6. **`daily_totals`:** um resumo por dia e categoria, atualizado na mesma transação de cada lançamento. Cards, gráficos e a contagem de páginas leem dele.
7. **Nada é apagado:** excluir grava `deleted_at`. Toda criação, alteração e exclusão vai para `transaction_audit`, com o antes e o depois.
8. **Linha travada na edição** (`SELECT ... FOR UPDATE`), para duas edições simultâneas não bagunçarem os totais.

Quando passar de algumas dezenas de milhões de linhas, o próximo passo é particionar `transactions` por mês.

## API

Todas as rotas, exceto `POST /auth/login` e `GET /health`, exigem `Authorization: Bearer <token>`.

### Usuários e convites

- `pnpm --filter @imperio/api user:create <usuario> <senha>` cria um **administrador** (primeiro acesso do dono).
- Colaboradores entram por **convite**: o admin informa o nome na tela Usuários e recebe um link `…/convite#<token>` para enviar. O colaborador abre o link e cria a senha.
- O token tem 256 bits aleatórios, vale 7 dias e uma vez só. O banco guarda apenas o hash (SHA-256), e o token fica depois do `#` para não ir a logs de servidor. Gerar outro convite para o mesmo nome invalida o anterior.
- Colaborador usa o sistema normalmente, mas não gera convites.

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/auth/login` | `{ username, password }` → `{ accessToken, username }` |
| GET | `/auth/me` | `{ username, isAdmin }` de quem está logado |
| GET | `/invites` | (admin) Lista os convites |
| POST | `/invites` | (admin) `{ username }` → `{ id, username, expiresAt, token }`. O token só aparece aqui |
| DELETE | `/invites/:id` | (admin) Cancela um convite ainda não usado (204) |
| POST | `/invites/lookup` | (público) `{ token }` → `{ username, expiresAt }` |
| POST | `/invites/accept` | (público) `{ token, password }` → cria a conta e devolve `{ accessToken, username }` |
| GET | `/categories` | Lista as categorias |
| POST | `/categories` | Cria `{ name, type, color? }` |
| PATCH | `/categories/:id` | Altera `{ name?, color?, archived? }` |
| GET | `/transactions` | Lista com filtros `from`, `to`, `type`, `categoryId`, `q`, `limit` (20/50/100/200) e `cursor` → `{ items, nextCursor, totals }` |
| GET | `/transactions/summary?from&to` | Totais, por categoria e por mês |
| GET | `/transactions/export` | Planilha `.xlsx` (abas Lançamentos e Resumo) com os mesmos filtros da lista, gerada em streaming |
| POST | `/transactions` | Cria `{ type, categoryId, amountCents, description?, occurredOn }` |
| PATCH | `/transactions/:id` | Altera qualquer campo acima |
| DELETE | `/transactions/:id` | Exclusão lógica (204) |

`type`: `entrada` ou `saida`.

## Próximos passos sugeridos

- Testes e2e com `@nestjs/testing` + supertest e um Postgres real (Testcontainers ou um branch do Neon).
- Pacote compartilhado `packages/shared` com os tipos e enums usados pela API e pelo front.
