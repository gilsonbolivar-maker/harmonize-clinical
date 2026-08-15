# Harmonize Clinical

## Como se comunicar com o autor deste projeto — leia primeiro

**Explique com recursos visuais.** Diagramas, tabelas, esquemas e imagens
funcionam muito melhor que parágrafos. Esta é a prioridade número um, não uma
sugestão de estilo.

Na prática:

- Comece pelo **desenho ou tabela**, use o texto para complementar — nunca o contrário.
- Prefira **diagramas** (fluxo, antes/depois, mapa de pastas) a descrições em prosa.
- Blocos longos de texto corrido se perdem. **Quebre em passos numerados e curtos.**
- Ao apresentar um resultado, mostre um **preview visível** (imagem, render, tabela),
  não só o caminho do arquivo.

**O autor não tem formação técnica em programação.** Ele constrói coisas que
funcionam e tem bom julgamento sobre produto, mas o vocabulário da área não é
familiar. Então:

- **Jargão só com tradução junto.** "Merge", "deploy", "lockfile", "mock" e afins
  precisam de uma frase em português explicando o que são, na primeira vez que
  aparecem na conversa.
- Ao propor uma mudança, diga **quais arquivos serão tocados e em que pasta**, com
  caminho completo. Onde as coisas moram não é óbvio para ele.
- Analogias do mundo real ajudam mais que definições formais.
- Nunca assuma que silêncio é entendimento — ofereça reexplicar de outro jeito.

Ele pediu explicitamente para isto ser tratado como prioridade permanente.

---

## O que é o projeto

Sistema de gestão para clínicas de estética e harmonização orofacial: prontuário,
mapeamento facial 2D de injetáveis, agenda de retoques, estoque com controle de
lote/ANVISA, financeiro e assistente de IA.

Roda como **PWA** — instala na tela inicial do celular e funciona sem internet.

Os dados vivem no **localStorage do navegador**. Não há banco de dados. Isso torna
o módulo de backup (`src/utils/backup.ts`) crítico: se ele falhar, o prontuário
some junto com os dados de navegação.

## Onde as coisas moram

| Pasta / arquivo | O que tem ali |
| --- | --- |
| `src/components/` | As telas: Pacientes, Agenda, Estoque, Financeiro, Mapa Facial |
| `src/utils/` | Funções auxiliares reaproveitadas por várias telas |
| `src/hooks/` | Comportamentos reutilizáveis de React (ex.: instalação do PWA) |
| `src/data/` | Dados de exemplo para testar sem cadastrar tudo à mão |
| `src/types.ts` | A "ficha" de cada coisa: o que um Paciente tem, o que um Agendamento tem |
| `public/` | Arquivos entregues como estão: ícones, service worker, manifest |
| `netlify/functions/` | Código que roda no servidor (a IA), não no navegador |
| `lib/` | Código compartilhado entre o app e o servidor |

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe o app local em http://localhost:3000 |
| `npm test` | Roda os testes uma vez |
| `npm run test:watch` | Roda os testes de novo a cada alteração salva |
| `npm run lint` | Confere os tipos (não roda o app) |
| `npm run build` | Gera a versão de produção |

## Testes

Ficam **na mesma pasta do arquivo que testam**, com o mesmo nome + `.test.ts`:

```
src/utils/backup.ts        ← o código
src/utils/backup.test.ts   ← o teste dele
```

Rodam com Vitest sobre jsdom. Ao mexer em `backup.ts`, rode `npm test` antes de
commitar — o backup é a única proteção do prontuário.

## Dependências

O lockfile do projeto é o **`bun.lock`**. O `package-lock.json` está no
`.gitignore`. Ao adicionar uma dependência, rode `bun install` para que o
`bun.lock` seja atualizado junto.
