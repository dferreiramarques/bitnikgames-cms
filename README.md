# bitnikgames CMS

Um mini CMS git-based para sites Astro com content collections — sem base de
dados, sem servidor persistente. É só um formulário protegido por password
que escreve ficheiros `.md` diretamente no repositório do site via API do
GitHub, e deixa o deploy automático existente (Vercel a partir de `main`)
fazer o resto.

Construído a pensar no [bitnikgames.vercel.app](https://bitnikgames.vercel.app),
mas o único ficheiro que sabe alguma coisa específica desse site é
[`api/_lib/collections.js`](api/_lib/collections.js) — apontar isto a outro
projeto Astro com content collections é trocar esse ficheiro (e as env vars
`GITHUB_OWNER`/`GITHUB_REPO`).

## Como funciona

```
public/index.html    → login (utilizador + password)
public/admin.html     → lista as coleções, edita/cria/apaga entradas
api/login.js           → valida a password (bcrypt) e assina uma cookie de sessão
api/session.js          → confirma se a cookie ainda é válida
api/collections.js       → lista as entradas de cada coleção (via GitHub API)
api/entry.js               → GET/PUT/DELETE de uma entrada (pt+en em conjunto)
api/_lib/auth.js             → sessão assinada com HMAC (sem base de dados)
api/_lib/github.js             → chamadas diretas à Contents API do GitHub via fetch()
api/_lib/collections.js          → schema das 3 coleções do bitnikgames (games, pnp, posts)
```

`_lib` fica dentro de `api/` (não `lib/` na raiz) de propósito — os ficheiros
partilhados só ficam disponíveis de forma fiável dentro do bundle de cada
função quando estão dentro da árvore que o bundler do Vercel já está a
analisar; fora de `api/`, o include automático não é garantido.

Cada entrada é sempre editada/criada/apagada como **par pt+en em conjunto**
— a regra mais importante do bitnikgames (nunca conteúdo só num idioma) fica
garantida pela própria ferramenta, não só por disciplina manual.

Quando gravas, o CMS faz *commit* direto no branch configurado
(`GITHUB_BRANCH`, por omissão `main`). Isso dispara o deploy automático que
já existe no Vercel do site — não há passo extra.

## Limitação conhecida

Gravar um par pt+en é **dois commits sequenciais** (um por ficheiro), não
uma operação atómica. Se o segundo falhar depois do primeiro ter sucesso
(raro — só em caso de falha de rede a meio), a entrada fica temporariamente
só num idioma. O admin mostra "falta EN"/equivalente na lista nesse caso;
basta voltar a gravar para corrigir. Uma versão atómica exigiria a Git Data
API (blob + tree + commit) em vez da Contents API — fora do âmbito desta
primeira versão.

## Setup

### 1. Instalar

```bash
npm install
```

### 2. Gerar a password (hash, nunca texto simples)

```bash
node scripts/hash-password.js "a-tua-password-aqui"
```

Copia o hash gerado — vai para `CMS_PASSWORD_HASH`. A password em texto
simples não fica guardada em lado nenhum, só o hash bcrypt.

### 3. Gerar o segredo de sessão

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Criar um GitHub Personal Access Token

No repositório do site (ex. `bitnikgames`): Settings → Developer settings →
Personal access tokens. Um **fine-grained token** com acesso só a esse
repositório e permissão `Contents: Read and write` é suficiente e mais
seguro do que um token clássico com `repo` completo.

### 5. Variáveis de ambiente

Copia `.env.example` para `.env` (para `vercel dev` local) e preenche tudo.
Para produção, mete as mesmas variáveis em Vercel → Project → Settings →
Environment Variables.

### 6. Correr localmente

```bash
npx vercel dev
```

Abre `http://localhost:3000`.

### 7. Deploy

```bash
npx vercel --prod
```

(ou liga o repositório ao Vercel pela dashboard, como qualquer outro
projeto — o deploy automático a partir de `main` fica configurado lá.)

## Segurança — o que isto é e não é

- Um único utilizador/password fixo (não é um sistema de contas). A
  password nunca é guardada em texto simples — só o hash bcrypt.
- A sessão é uma cookie `httpOnly` assinada com HMAC-SHA256, sem estado no
  servidor (não há sessões para invalidar em massa; expira sozinha ao fim
  de 12h).
- O `GITHUB_TOKEN` vive só no servidor (env var do Vercel) — nunca chega ao
  browser. Mas quem tiver a password da CMS consegue, através dela,
  escrever no repositório com o alcance desse token — por isso o
  fine-grained token scoped a um único repo, e uma password forte, importam
  mais aqui do que num CMS normal.
- Não há proteção contra força bruta no login além do custo do bcrypt.
  Para um projeto pessoal com uma password forte isto é aceitável; não é
  pensado para um público maior.

## Estender para outro projeto

1. Copia o repositório.
2. Edita `api/_lib/collections.js` com as coleções/schema do novo projeto
   (`basePath` tem de bater certo com `src/content/config.ts` desse site).
3. Aponta `GITHUB_OWNER`/`GITHUB_REPO` ao repositório certo.
4. Gera uma password e segredo de sessão novos — não reutilizes os do
   bitnikgames.
