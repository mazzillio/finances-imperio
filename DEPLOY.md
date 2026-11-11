# Como subir o Império Finanças

Passo a passo para colocar o sistema no ar pela primeira vez.

## Visão geral

| Parte | Onde fica | Por quê |
| --- | --- | --- |
| Banco de dados | **Neon** (Postgres) | O projeto já usa o driver do Neon |
| API (`apps/api`, NestJS) | **Vercel** | A API precisa de um servidor Node |
| Front (`apps/web`, React + Vite) | **Cloudflare Workers** (arquivos estáticos) | É um site estático depois do build |

**Por que a API não vai no Cloudflare:** o front sobe no Cloudflare só como arquivos prontos (HTML, CSS
e JavaScript). A API é um servidor NestJS, que precisa rodar em Node. Os Workers até rodam código de
servidor, mas este projeto não foi testado lá, e o plano gratuito limita o processamento de cada
chamada a poucos milissegundos, o que não comporta o cálculo do hash da senha no login. Na Vercel a API
sobe sem configuração, do mesmo jeito que a do `imperio-poker-ranking`.

A ordem importa, porque cada parte precisa do endereço da anterior:

1. Código no GitHub
2. Banco no Neon
3. Seed (tabelas e usuário administrador)
4. API na Vercel
5. Front no Cloudflare Workers
6. Liberar o front na API (CORS)
7. Testar

---

## 1. Código no GitHub

O repositório `git@github.com:mazzillio/finances-imperio.git` já está configurado como `origin`, mas
ainda não tem nenhum commit.

```bash
cd ~/Documentos/personal/finances-imperio
git add .
git status          # confira que nenhum arquivo .env aparece na lista
git commit -m "Versão inicial"
git push -u origin main
```

Os arquivos `.env` estão no `.gitignore` e não devem ir para o GitHub. As senhas ficam só nos painéis
do Neon, da Vercel e do Cloudflare.

---

## 2. Banco no Neon

1. Crie a conta em <https://neon.com> (dá para entrar com o GitHub).
2. Crie um projeto:
   - **Nome:** `imperio-financas`
   - **Cloud provider:** AWS
   - **Region:** **AWS South America (São Paulo)**, id `aws-sa-east-1`. A região **não pode ser
     trocada depois**, então escolha esta agora.
   - Versão do Postgres: a padrão.
3. O Neon cria um banco chamado `neondb` e um branch chamado `production`. Pode usar esses mesmos.
4. Pegue as **duas** connection strings. No painel do projeto, clique em **Connect**. Abre a janela
   "Connect to your branch", com a chave **Connection pooling**:

   | Chave "Connection pooling" | Endereço | Para que serve |
   | --- | --- | --- |
   | **Ligada** (padrão) | tem `-pooler` no nome: `ep-xxxx-pooler.sa-east-1.aws.neon.tech` | `DATABASE_URL` da API |
   | **Desligada** | sem `-pooler`: `ep-xxxx.sa-east-1.aws.neon.tech` | Seed e migrations |

   Copie as duas e guarde num lugar seguro (gerenciador de senhas). Elas contêm a senha do banco.

   Exemplo do formato:
   ```
   postgresql://neondb_owner:SENHA@ep-xxxx-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
   ```

Limites do plano gratuito do Neon que afetam o uso: 1 GB de armazenamento por projeto, 100 horas de
computação por mês e o banco "dorme" depois de 5 minutos sem uso. A primeira chamada depois disso
demora um ou dois segundos a mais.

---

## 3. Seed: tabelas e usuário administrador

O arquivo do seed fica **fora** do projeto, em `~/Documentos/personal/imperio-financas-seed-producao.sh`.

```bash
bash ~/Documentos/personal/imperio-financas-seed-producao.sh
```

Ele pergunta, nesta ordem:

1. A connection string **direta** do Neon (a **sem** `-pooler`). O texto colado não aparece na tela.
2. O nome do administrador (Enter para `admin`).
3. A senha, duas vezes (não aparece na tela; mínimo de 8 caracteres).
4. Se você quer as categorias padrão. Responda `n` se preferir criar as suas pela tela.
5. Uma confirmação, mostrando o servidor onde vai gravar.

Depois ele cria as tabelas, as categorias (se você pediu) e o administrador. A senha é transformada em
hash bcrypt antes de ir para o banco. O script não altera o seu `.env` nem o banco local do Docker.

Rodar de novo é seguro: as tabelas só recebem o que falta, e se o usuário já existir nada é alterado.

---

## 4. API na Vercel

1. Em <https://vercel.com>, **Add New… → Project** e importe o repositório `finances-imperio`.
2. Em **Root Directory**, clique em **Edit** e escolha `apps/api`.
3. O framework **NestJS** é detectado sozinho (a Vercel acha o `src/main.ts`). Não mude os comandos.
4. Em **Environment Variables**, adicione:

   | Nome | Valor |
   | --- | --- |
   | `DATABASE_URL` | A connection string **com** `-pooler` |
   | `JWT_SECRET` | Um texto aleatório longo. Gere com `openssl rand -base64 48` |
   | `WEB_ORIGIN` | Deixe para o passo 6 |

   **Não deixe o `JWT_SECRET` sem valor.** Sem ele a API usa um segredo de desenvolvimento conhecido,
   e qualquer pessoa conseguiria fabricar um login.
5. Clique em **Deploy**.
6. Região: em **Settings → Functions → Function Regions**, escolha **São Paulo (`gru1`)**, para a API
   ficar perto do banco. O padrão é Washington (`iad1`). Depois de mudar, faça um novo deploy
   (**Deployments → ⋯ → Redeploy**).
7. Anote o endereço da API, por exemplo `https://finances-imperio-api.vercel.app`, e teste no
   navegador: `https://SUA-API.vercel.app/health` deve responder `{"ok":true}`.

Se o `/health` der erro de conexão com o banco, tire o trecho `&channel_binding=require` do fim da
`DATABASE_URL`, se ele existir, e faça um novo deploy.

---

## 5. Front no Cloudflare Workers

O painel do Cloudflare hoje abre o fluxo de **Workers** ao criar uma aplicação a partir do Git (o
antigo fluxo de Pages não aparece mais por padrão). O front sobe como um Worker só de arquivos
estáticos, configurado pelo arquivo `wrangler.jsonc` na raiz do repositório.

**Antes de começar:** o `wrangler.jsonc` precisa estar no GitHub (`git push`). Sem ele, o deploy não
publica o site: o Cloudflare tenta configurar o projeto sozinho e abre um pull request no repositório.

1. No painel do Cloudflare, abra **Workers & Pages** e clique em **Create application**.
2. Escolha importar um repositório do **GitHub**, autorize se for pedido e selecione
   `mazzillio/finances-imperio`.
3. Na tela **Set up your application**, preencha:

   | Campo | Valor |
   | --- | --- |
   | Project name | `finances-imperio` (tem que ser igual ao `name` do `wrangler.jsonc`) |
   | Build command | `pnpm --filter @imperio/web build` |
   | Deploy command | `npx wrangler deploy` (o padrão) |
   | Preview command | `npx wrangler preview` (o padrão) |
   | Enable Preview builds | Ligado ou desligado, tanto faz (veja "Previews" mais abaixo) |
   | Protect with Cloudflare Access | Desligado |

4. Abra **Advanced settings** e preencha:

   | Campo | Valor |
   | --- | --- |
   | Path | `/` (o padrão) |
   | API token | **Create new token** (o padrão). Pode deixar o **API token name** vazio |
   | Variable name | `VITE_API_URL` |
   | Variable value | O endereço da API do passo 4, **sem** `/` no fim |

   O **Path fica em `/` de propósito**. O `pnpm-lock.yaml` e o `wrangler.jsonc` estão na raiz do
   repositório, e o Cloudflare instala as dependências e roda os comandos a partir dessa pasta.

   Não é preciso informar as versões: o Node vem do arquivo `.node-version` (22) e o pnpm vem do campo
   `packageManager` do `package.json` (10.28.0).
5. Clique em **Deploy** e acompanhe o log do build.
6. Anote o endereço do site: `https://finances-imperio.SEU-SUBDOMINIO.workers.dev`. Ele aparece no fim
   do log e na página do Worker.

**Se o build falhar na instalação** (o log reclama da versão do pnpm), em **Settings → Build →
Build variables and secrets** adicione `SKIP_DEPENDENCY_INSTALL` = `1` e troque o Build command para:

```bash
npm install -g pnpm@10.28.0 && pnpm install --frozen-lockfile && pnpm --filter @imperio/web build
```

**Rotas do sistema** (`/categorias`, `/usuarios`, `/convite`): funcionam ao recarregar a página por
causa da linha `"not_found_handling": "single-page-application"` do `wrangler.jsonc`, que devolve o
`index.html` para qualquer caminho que não seja um arquivo.

**Opcional, para não gastar builds à toa:** em **Settings → Build → Build watch paths**, coloque
`apps/web/*` e `wrangler.jsonc` em *Include paths*. Assim, mudanças só na API não refazem o build do
front.

---

## 6. Liberar o front na API (CORS)

A API só aceita chamadas do endereço indicado em `WEB_ORIGIN`.

1. Na Vercel, no projeto da API: **Settings → Environment Variables**.
2. Adicione `WEB_ORIGIN` = `https://finances-imperio.SEU-SUBDOMINIO.workers.dev` (sem `/` no fim).
   Para mais de um endereço, como um domínio próprio, separe por vírgula.
3. Faça um novo deploy da API (**Deployments → ⋯ → Redeploy**). A variável só vale depois disso.

Sem esse passo, o login falha com "Não foi possível falar com o servidor".

---

## 7. Testar

| O que fazer | O que deve acontecer |
| --- | --- |
| Abrir `https://SUA-API.vercel.app/health` | `{"ok":true}` |
| Abrir o site e entrar com o administrador do seed | Abre o painel |
| Criar um lançamento | Os cards e o gráfico atualizam |
| Clicar em **Exportar Excel** | Baixa a planilha |
| Em **Usuários**, gerar um convite e abrir o link numa janela anônima | Aparece a tela de criar senha |
| Recarregar a página em `/categorias` | Continua em Categorias, sem erro 404 |

Gere os convites **pelo site publicado**. O link usa o endereço que está aberto no navegador: um
convite gerado em `localhost` só abre no seu computador.

---

## Depois que estiver no ar

### Publicar uma mudança
`git push` na `main`. A Vercel e o Cloudflare refazem o deploy sozinhos.

### Mudança no banco (nova migration)
Aplique no Neon **antes** de publicar o código que depende dela, usando a connection string direta:

```bash
cd ~/Documentos/personal/finances-imperio
DATABASE_URL_UNPOOLED="postgresql://...sem-pooler..." NEON_LOCAL_PROXY="" pnpm db:migrate
```

O `NEON_LOCAL_PROXY=""` é necessário: sem ele, o comando usaria o proxy do Docker local que está no
seu `.env`. Para não deixar a senha no histórico do terminal, comece a linha com um espaço (se o seu
bash estiver configurado para isso) ou rode de novo o script do seed, que também aplica as migrations.

### Mudou o endereço da API?
O `VITE_API_URL` entra no site **durante o build**. Troque o valor no Cloudflare em **Settings → Build →
Build variables and secrets** e depois rode um novo build do front (refaça o último build ou dê um
`git push`).

### Domínio próprio
- **Front:** no Cloudflare, na página do Worker: **Settings → Domains & Routes → Add → Custom domain**.
  O domínio precisa estar na mesma conta do Cloudflare; o registro de DNS é criado sozinho.
- **API:** na Vercel, **Settings → Domains**.
- Depois, inclua o novo endereço do front em `WEB_ORIGIN` e refaça o deploy da API.

### Previews
Com **Enable Preview builds** ligado, o Cloudflare cria um endereço de teste para cada branch que não
seja a `main`. Esses endereços **não** estão em `WEB_ORIGIN`, então o login não funciona neles. Eles também apontam
para a API e o banco de produção. Use para ver o visual, não para testar dados.

### Voltar atrás
- **Código:** a Vercel (**Instant Rollback**) e o Cloudflare (**Deployments**, escolhendo uma
  versão anterior) voltam para um deploy anterior.
- **Banco:** o plano gratuito do Neon guarda as últimas 6 horas para restauração. Antes de uma
  migration que apaga dados, crie um branch no Neon (**Branches → New Branch**) como cópia de segurança.

### Avisos
- **Plano gratuito da Vercel (Hobby):** os termos dela restringem o uso comercial. Para uso do clube
  no dia a dia, confira se o plano atende ou considere o Pro.
- **HTTPS:** os endereços `*.vercel.app` e `*.workers.dev` já vêm com HTTPS. Não use o sistema por HTTP
  em produção, porque as senhas trafegariam sem criptografia.

---

## Fontes

- Cloudflare Workers: [Builds: configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/),
  [Build image](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/),
  [Single Page Application](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
- Neon: [Regions](https://neon.com/docs/introduction/regions),
  [Connection pooling](https://neon.com/docs/connect/connection-pooling),
  [Connect from any app](https://neon.com/docs/connect/connect-from-any-app),
  [Plans](https://neon.com/docs/introduction/plans)
- Vercel: [NestJS](https://vercel.com/docs/frameworks/backend/nestjs),
  [Monorepos](https://vercel.com/docs/monorepos),
  [Function regions](https://vercel.com/docs/functions/configuring-functions/region)
