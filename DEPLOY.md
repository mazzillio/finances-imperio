# Como subir o Império Finanças

Passo a passo para colocar o sistema no ar pela primeira vez.

## Visão geral

| Parte | Onde fica | Por quê |
| --- | --- | --- |
| Banco de dados | **Neon** (Postgres) | O projeto já usa o driver do Neon |
| API (`apps/api`, NestJS) | **Vercel** | O Cloudflare Pages só hospeda arquivos estáticos; a API precisa de um servidor Node |
| Front (`apps/web`, React + Vite) | **Cloudflare Pages** | É um site estático depois do build |

**Por que a API não vai no Cloudflare Pages:** o Pages serve HTML, CSS e JavaScript prontos. A API é um
servidor NestJS, que precisa rodar em Node. O Cloudflare tem os Workers para código de servidor, mas
este projeto não foi testado lá, e o plano gratuito dos Workers limita o processamento de cada chamada
a poucos milissegundos, o que não comporta o cálculo do hash da senha no login. Na Vercel a API sobe
sem configuração, do mesmo jeito que a do `imperio-poker-ranking`.

A ordem importa, porque cada parte precisa do endereço da anterior:

1. Código no GitHub
2. Banco no Neon
3. Seed (tabelas e usuário administrador)
4. API na Vercel
5. Front no Cloudflare Pages
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

## 5. Front no Cloudflare Pages

1. No painel do Cloudflare, abra **Workers & Pages**.
2. **Create application → Pages → Connect to Git**.
3. Escolha **GitHub**, autorize (**Install & Authorize**) e selecione o repositório
   `finances-imperio`. Clique em **Begin setup**.
4. Na tela **Set up builds and deployments**, preencha:

   | Campo | Valor |
   | --- | --- |
   | Production branch | `main` |
   | Framework preset | `None` |
   | Build command | `pnpm --filter @imperio/web build` |
   | Build output directory | `apps/web/dist` |
   | Root directory (advanced) → Path | **deixe vazio** |

   O **Root directory fica vazio de propósito**. O `pnpm-lock.yaml` está na raiz do repositório, e o
   Pages instala as dependências a partir da pasta indicada nesse campo. Com `apps/web` ali, ele não
   acharia o arquivo de versões das dependências.
5. Em **Environment variables (advanced)**, adicione:

   | Nome | Valor |
   | --- | --- |
   | `VITE_API_URL` | O endereço da API do passo 4, **sem** `/` no fim |
   | `PNPM_VERSION` | `10.28.0` |

   A versão do Node vem do arquivo `.node-version` (22), que já está na raiz do projeto.
6. Clique em **Save and Deploy** e acompanhe o log do build.
7. Anote o endereço do site: `https://NOME-DO-PROJETO.pages.dev`.

**Se o build falhar na instalação** (o log mostra `npm install` em vez de `pnpm install`, ou reclama
da versão do pnpm), em **Settings → Environment variables** adicione `SKIP_DEPENDENCY_INSTALL` = `1` e
troque o Build command para:

```bash
npm install -g pnpm@10.28.0 && pnpm install --frozen-lockfile && pnpm --filter @imperio/web build
```

**Rotas do sistema** (`/categorias`, `/usuarios`, `/convite`): funcionam ao recarregar a página sem
configuração extra. Como o projeto não tem um `404.html`, o Pages trata o site como uma aplicação de
página única e devolve o `index.html` para qualquer caminho.

**Opcional, para não gastar builds à toa:** em **Settings → Build → Build watch paths**, coloque
`apps/web/*` em *Include paths*. Assim, mudanças só na API não refazem o build do front.

---

## 6. Liberar o front na API (CORS)

A API só aceita chamadas do endereço indicado em `WEB_ORIGIN`.

1. Na Vercel, no projeto da API: **Settings → Environment Variables**.
2. Adicione `WEB_ORIGIN` = `https://NOME-DO-PROJETO.pages.dev` (sem `/` no fim).
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
O `VITE_API_URL` entra no site **durante o build**. Depois de trocar o valor no Cloudflare, é preciso
um novo deploy do front (**Deployments → Retry deployment**).

### Domínio próprio
- **Front:** no Cloudflare, no projeto do Pages: **Custom domains → Set up a domain**. Adicione o
  domínio por essa tela antes de criar o CNAME à mão, senão o site responde com erro 522.
- **API:** na Vercel, **Settings → Domains**.
- Depois, inclua o novo endereço do front em `WEB_ORIGIN` e refaça o deploy da API.

### Previews
O Cloudflare cria um endereço de teste para cada branch (`https://BRANCH.NOME-DO-PROJETO.pages.dev`).
Esses endereços **não** estão em `WEB_ORIGIN`, então o login não funciona neles. Eles também apontam
para a API e o banco de produção. Use para ver o visual, não para testar dados.

### Voltar atrás
- **Código:** a Vercel (**Instant Rollback**) e o Cloudflare (**Deployments → Rollback to this
  deployment**) voltam para um deploy anterior.
- **Banco:** o plano gratuito do Neon guarda as últimas 6 horas para restauração. Antes de uma
  migration que apaga dados, crie um branch no Neon (**Branches → New Branch**) como cópia de segurança.

### Avisos
- **Plano gratuito da Vercel (Hobby):** os termos dela restringem o uso comercial. Para uso do clube
  no dia a dia, confira se o plano atende ou considere o Pro.
- **Cloudflare Pages:** a documentação atual recomenda os Workers para projetos novos. O Pages continua
  funcionando e recebendo deploys; é só um aviso de para onde o Cloudflare está indo.
- **HTTPS:** os endereços `*.vercel.app` e `*.pages.dev` já vêm com HTTPS. Não use o sistema por HTTP
  em produção, porque as senhas trafegariam sem criptografia.

---

## Fontes

- Cloudflare Pages: [Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/),
  [Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/),
  [Build image](https://developers.cloudflare.com/pages/configuration/build-image/),
  [Monorepos](https://developers.cloudflare.com/pages/configuration/monorepos/),
  [Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/),
  [Build watch paths](https://developers.cloudflare.com/pages/configuration/build-watch-paths/),
  [Custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- Neon: [Regions](https://neon.com/docs/introduction/regions),
  [Connection pooling](https://neon.com/docs/connect/connection-pooling),
  [Connect from any app](https://neon.com/docs/connect/connect-from-any-app),
  [Plans](https://neon.com/docs/introduction/plans)
- Vercel: [NestJS](https://vercel.com/docs/frameworks/backend/nestjs),
  [Monorepos](https://vercel.com/docs/monorepos),
  [Function regions](https://vercel.com/docs/functions/configuring-functions/region)
