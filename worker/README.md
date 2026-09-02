# Lives Worker

Programa que faz a transmissão de verdade. Roda na máquina sempre-ligada, separado do painel.
Fala com o Supabase (mesmo banco do dashboard) e sobe um `ffmpeg` por live ativa.

> Visão geral do módulo inteiro: ver `../LIVES.md`.

## Pré-requisitos
- Node.js
- ffmpeg no PATH (`ffmpeg -version` tem que responder)

## Setup (uma vez)
1. Instale as dependências:
   ```
   npm install
   ```
2. Crie o `.env` a partir do exemplo:
   ```
   copy .env.example .env
   ```
   Abra o `.env` e cole o `SUPABASE_SERVICE_ROLE`
   (Supabase → Project Settings → API → **service_role** secret).
   > Segredo. Fica só aqui. Nunca no git, nunca no chat.

## Rodar
Duas formas:
- **1 clique (recomendado no dia a dia):** dê 2 cliques em `iniciar-lives.bat`. Abre uma janela com o log; deixe aberta durante as lives, feche quando terminar. Instala as dependências sozinho na primeira vez.
- **Terminal:** `npm start`.

Deixe a janela aberta enquanto quiser que as lives funcionem.
Encerra com Ctrl+C ou fechando a janela (mata os ffmpegs ativos e libera a trava).
Encerre as lives no painel antes de fechar, pro ffmpeg sair limpo.

## O que ele faz
- **Converte** material novo (`processing` → `ready`) pro formato do Instagram (H.264/AAC), 1 vez, no upload.
- **Sobe o ffmpeg** quando uma live entra como `starting`:
  - material convertido (`/ready/`) → **stream-copy** (`-c copy`, CPU quase zero);
  - foto antiga ou material cru → re-encoda ao vivo (fallback).
- **Corte automático** aos 3h50 (`AUTO_CUTOFF_SECONDS`).
- **Encerramento** manual: painel marca `ending` → worker mata o processo → `ended`.
- **Watchdog**: ffmpeg cai → religa até `MAX_RESTARTS`; se não voltar → `error`.
- **Reconciliação no boot**: live `live`/`starting` órfã (sem processo) → `error`; `ending` → `ended`.
- **Trava de instância única** (`worker.lock`): um segundo worker se auto-encerra. Não rode dois.
- **Nunca grava a `stream_key` em log.**

## Configuração (.env)
| Var | Padrão | O que é |
|---|---|---|
| `SUPABASE_URL` | (a do dashboard) | Projeto Supabase |
| `SUPABASE_SERVICE_ROLE` | — | Chave admin (secret). **Obrigatória.** |
| `INSTAGRAM_RTMP_URL` | `rtmps://live-upload.instagram.com:443/rtmp/` | Só fallback — o servidor real vem do Live Producer por live. |
| `AUTO_CUTOFF_SECONDS` | 13800 | Corte de segurança (3h50) |
| `POLL_MS` | 3000 | Frequência de leitura do banco |
| `MAX_RESTARTS` | 3 | Tentativas de religar o ffmpeg |
| `FFMPEG_PATH` | ffmpeg | Caminho do ffmpeg |

## Arquivos gerados em runtime (ignorados no git)
- `worker.lock` — PID da instância ativa (trava).
- `tmp/` — arquivos temporários da conversão.

## Importante
- Antes de rodar o worker real, `USE_MOCK_WORKER` deve estar `false` em `lives.html`.
- Rodar em produção 24/7: ainda **falta** configurar pra iniciar sozinho (Agendador de Tarefas do Windows ou pm2). Ver `../LIVES.md` → "Falta fazer".
