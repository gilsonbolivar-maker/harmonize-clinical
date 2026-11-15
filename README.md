# Harmonize Clinical

Sistema de gestão para clínicas de estética e harmonização orofacial: prontuário,
mapeamento facial 2D de injetáveis, agenda de retoques, estoque com controle de
lote/ANVISA, financeiro e assistente de IA para protocolos e pós-cuidado.

Roda como **PWA**: instala na tela inicial e funciona offline.

## Rodando localmente

**Pré-requisitos:** Node.js 20+

```bash
npm install
cp .env.example .env        # opcional: a IA tem fallback sem chave
npm run dev                 # http://localhost:3000
```

| Script | O que faz |
| --- | --- |
| `npm run dev` | Servidor Express + Vite em modo desenvolvimento |
| `npm run build` | Build de produção (front em `dist/` + `dist/server.cjs`) |
| `npm run build:web` | Só o front — é o que o Netlify roda |
| `npm start` | Sobe o build de produção |
| `npm run lint` | Checagem de tipos (`tsc --noEmit`, modo strict) |

### Variáveis de ambiente

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `GEMINI_API_KEY` | Não | Chave do Gemini. Sem ela, as rotas de IA respondem com conteúdo de exemplo (`isMock: true`) em vez de falhar. |
| `GEMINI_MODEL` | Não | Modelo usado nas rotas de IA. Padrão: `gemini-2.5-flash`. |
| `APP_URL` | Não | URL pública onde o app está hospedado. |

## PWA

O service worker só é registrado no **build de produção** — em desenvolvimento
ele conflita com o HMR do Vite. Para testar a instalação e o modo offline:

```bash
npm run build && npm start
```

Arquivos envolvidos:

| Arquivo | Papel |
| --- | --- |
| `public/manifest.webmanifest` | Nome, ícones, cores, atalhos (`?module=…`) |
| `public/sw.js` | Cache da casca do app e estratégias de rede |
| `src/hooks/usePwa.ts` | Registro do SW, aviso de atualização, prompt de instalação, status offline |
| `src/components/PwaBanners.tsx` | Avisos flutuantes de offline / atualização / instalar |

**Estratégias de cache:** navegação usa *network-first* (pega a versão nova
assim que houver rede, cai no cache quando offline); `/assets/*` usa
*cache-first* porque os nomes têm hash; `/api/*` **nunca** é cacheado, para as
respostas de IA serem sempre reais.

Quando um novo build é publicado, o app mostra "Nova versão disponível" e o
usuário aplica com um clique — sem precisar desinstalar nada.

## Deploy no Netlify

O Netlify não roda o servidor Express: publica o `dist/` como site estático e
expõe `netlify/functions/` sob demanda. Por isso as rotas `/api/*` existem duas
vezes — no Express (`server.ts`) e como function — mas **a lógica é a mesma**,
em `lib/ai.ts`, para os dois ambientes não divergirem.

Tudo já vem configurado em `netlify.toml`. Ao conectar o repositório, o Netlify
lê o arquivo e preenche o build sozinho:

| Campo | Valor |
| --- | --- |
| Build command | `npm run build:web` |
| Publish directory | `dist` |
| Functions directory | `netlify/functions` |

**Variáveis de ambiente** (Site configuration → Environment variables): defina
`GEMINI_API_KEY` para a IA responder de verdade. Sem ela o site funciona, mas os
módulos de IA devolvem conteúdo de exemplo.

Depois do deploy, confira `https://SEU-SITE.netlify.app/api/health` — deve
responder `{"status":"ok"}`. Se vier o HTML do app, as functions não subiram.

## Deploy no GitHub Pages

O front também publica como site estático. O workflow
`.github/workflows/pages.yml` roda `npm run build:web` com
`BASE_PATH=/harmonize-clinical/` e envia o `dist/` para o GitHub Pages.

Endereço esperado:

`https://gilsonbolivar-maker.github.io/harmonize-clinical/`

Uma vez, em **Settings → Pages → Build and deployment**, a **Source** precisa
estar em **GitHub Actions**. O workflow dispara no push da `main` (e também
pode ser rodado à mão em Actions).

O plano gratuito do GitHub só serve Pages de repositório **público**. Este
repositório já está público. As telas clínicas funcionam no navegador (os
dados ficam no `localStorage` de cada aparelho). As rotas `/api/*` não existem
no Pages: a IA só responde no Netlify ou no `npm start` local. `GEMINI_API_KEY`
continua opcional e não entra no build.

## Backup dos dados

⚠️ **Todos os dados da clínica ficam no `localStorage` do navegador.** Não há
servidor de banco de dados. Limpar os dados de navegação, desinstalar o PWA ou
trocar de aparelho **apaga tudo**.

O botão **"Backup dos dados"** na barra lateral exporta o estado completo
(pacientes, agendamentos, estoque, procedimentos, financeiro e pontos de
mapeamento facial) para um `.json`, e restaura a partir dele em dois modos:

- **Mesclar** — mantém o que já existe e acrescenta só os registros novos (dedup por `id`);
- **Substituir** — descarta os dados atuais do aparelho.

Onde houver suporte (Chrome/Edge), o download usa a File System Access API para
o usuário escolher a pasta; nos demais navegadores cai no download convencional.

## Estrutura

```
src/
  App.tsx                 Estado global, navegação e persistência local
  types.ts                Modelos de domínio (paciente, agendamento, lote, …)
  data/mockData.ts        Dados iniciais de demonstração
  components/             Um módulo por área clínica + FaceMapStudio
  hooks/usePwa.ts         Integração com service worker e instalação
  utils/date.ts           Datas no fuso local (YYYY-MM-DD)
  utils/storage.ts        Leitura/escrita resiliente no localStorage
  utils/backup.ts         Serialização, validação e merge do backup
public/                   Manifest, service worker e ícones
server.ts                 Express: rotas de IA + entrega do build (local)
lib/ai.ts                 Lógica das rotas de IA, compartilhada
netlify/functions/        As mesmas rotas como Netlify Functions
netlify.toml              Build, redirects e headers do deploy
```
