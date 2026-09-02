# Módulo de Lives

> **De onde este documento veio.** Ele nasceu no `dashboard-agencia`, que foi arquivado em
> set/26. Veio junto com o worker porque é o manual de operação dele — e o worker é a parte
> que continua rodando.
>
> **O que mudou desde que foi escrito:** o painel não é mais o `lives.html` estático; é
> `/agencia/lives` no hub, sobre as tabelas `live_materials` (era `client_materials`) e
> `live_sessions`, ambas só-agência (`is_agency()`), com `org_id` no lugar de `client_id` e
> bucket `materials` **privado** (a coluna guarda caminho, não URL — quem abre assina na
> hora). Os arquivos que o texto cita pelo nome — `lives.html`, `admin.html`, `css/style.css`,
> `lives-setup.sql` — eram do painel antigo e só existem no repo arquivado
> `github.com/erobino91/dashboards`.
>
> **O que continua valendo palavra por palavra:** tudo sobre o worker, o ffmpeg, o RTMPS, as
> manhas do IG Live Producer, a lição de egress e o que falta fazer.


Transmite um vídeo (ou foto) em **loop** no Instagram Live, por cliente, simulando uma live pra ganhar destaque na fila de Stories. Não é câmera ao vivo — é material promocional rodando em loop, até 4h, com corte automático aos 3h50.

---

## Visão geral (como funciona)

```
  Painel (navegador)          Supabase                 Worker (máquina local)
  lives.html          <-->    live_sessions     <-->   node + ffmpeg  --RTMPS-->  Instagram
                              client_materials
                              bucket "materials"
```

- **Painel**: página estática (HTML/JS), fala direto com o Supabase. Sem servidor.
- **Supabase**: é o "quadro de avisos" entre painel e worker. O painel escreve intenção (iniciar/encerrar), o worker lê e age.
- **Worker**: programa Node que roda numa máquina sempre-ligada. Sobe um `ffmpeg` por live e empurra pro Instagram. **Sem worker rodando, nenhuma live vai ao ar.**

Não existe servidor de API. O Supabase coordena tudo.

---

## Como operar (passo a passo do usuário)

1. No topo do dashboard, aba **Lives**.
2. **Iniciar Live** → escolhe o cliente → surge um card.
3. No card:
   - **Upload**: sobe o vídeo/foto. Ele entra como *"Convertendo…"* e vira *"Pronto"* sozinho (o worker converte pro formato do Instagram).
   - No **Instagram Live Producer**, gera uma transmissão nova e copia **os dois** campos: **Stream URL** (servidor) e **Stream key** (chave). Os dois trocam a cada live.
   - **Conexão**: cola o Stream URL em cima e a chave embaixo.
   - Escolhe o material no dropdown → liga o **toggle**.
4. Card vira **"Ao vivo há HH:MM:SS"**. No Live Producer aparece a prévia — aí você clica **"Go live"** no Instagram pra publicar.
5. **Encerrar**: desliga o toggle (ou corta sozinho aos 3h50).

Várias lives ao mesmo tempo: cada cliente tem seu card independente.

---

## Arquivos

| Arquivo | Papel |
|---|---|
| `lives.html` | Tela de Lives (global). Cards, upload, conexão, cronômetro. |
| `admin.html` | Ganhou a barra de navegação **Clientes / Lives** no topo. |
| `css/style.css` | Componente `.top-nav` (a barra Clientes/Lives). |
| `lives-setup.sql` | Cria tabelas, segurança (RLS), bucket. Rodar no Supabase SQL Editor. |
| ~~`lives-worker/`~~ | O programa que transmite (Node + ffmpeg). **Saiu daqui** — agora é `momentum-hub/worker/`. |

> `periods.html` e `pricing.html` **não** têm Lives — Lives é global, não por cliente.

---

## Banco de dados (Supabase)

**`client_materials`** — os vídeos/fotos de cada cliente
- `source_url` = arquivo cru (como foi subido)
- `file_url` = arquivo já convertido pro Instagram (preenchido pelo worker)
- `status` = `processing` → `ready` (ou `error`)

**`live_sessions`** — cada transmissão
- `stream_url` + `stream_key` = servidor + chave do Live Producer (trocam a cada live)
- `status` = `starting` → `live` → `ending`/`ended` (ou `error`)
- `started_at`, `ended_at`, `auto_cutoff_at` (início + 3h50)
- `material_id` fica nulo se o material for apagado (histórico preservado)

**Bucket `materials`** (Storage) — leitura pública, upload autenticado. Pastas: `<cliente>/raw/` (cru) e `<cliente>/ready/` (convertido).

---

## O worker

Fica em `momentum-hub/worker/` (era `lives-worker/` aqui até set/26). Ver `momentum-hub/worker/README.md` pra setup e execução.

O que ele faz:
- **Converte** materiais novos (`processing` → `ready`) pro formato do Instagram — 1 vez, no upload.
- **Sobe o ffmpeg** quando uma live entra como `starting`; se o material já está convertido, só **copia** (stream-copy → CPU quase zero).
- **Baixa o material 1x pra `tmp/` e transmite do disco.** Streamar direto da URL do Storage faria o ffmpeg re-baixar o arquivo a cada volta do loop (uma live de 3h50 com vídeo de 15s gerou ~12 GB de egress e estourou o free tier do Supabase em jul/26). Cache fica em `tmp/stream-<materialId>.*`; entradas sem uso há 30 dias são limpas no boot.
- **Corte automático** aos 3h50. **Encerramento** manual mata o processo.
- **Watchdog**: ffmpeg cai → tenta religar; não volta → marca `error` (card fica vermelho).
- **Reconciliação no boot**: live "fantasma" sem processo vira `error`.
- **Trava de instância única** (`worker.lock`): impede 2 workers rodando (eles brigariam e derrubariam lives).
- **Nunca grava a `stream_key` em log.**

---

## Fatos importantes (aprendidos na prática)

- **O servidor do Instagram é dinâmico.** O Live Producer dá um Stream URL diferente por transmissão (ex: `rtmps://edgetee-upload-gru2-2.xx.fbcdn.net:443/rtmp/`). Por isso o card pede o URL + a chave a cada live — não dá pra fixar.
- **É RTMPS na porta 443** (seguro), não RTMP 80.
- **Limite de 50 MB no upload** (Supabase free). O arquivo **cru** precisa caber em 50 MB — a conversão é depois. Vídeo maior: comprimir antes (o Claude comprime com ffmpeg aqui e devolve ≤50 MB) ou subir o plano do Supabase.
- Só quem está **logado** vê/inicia lives (RLS). O worker usa a chave admin (`service_role`) no `.env`, nunca no painel.
- **O painel era a 2ª fonte de egress** (descoberto em 10–11/jul/26): o refresh de 5s reconstruía o board com `innerHTML`, recriando os `<video>` das thumbs — o navegador re-baixava o vídeo do CDN a cada recriação (GBs/dia com a aba aberta, mesmo sem live). Fix: `reload()` só re-renderiza se o estado mudou (`lastRenderKey`), e uploads sobem com `cacheControl` de 1 ano (arquivos são imutáveis por id). **Não reintroduzir rebuild incondicional no polling.**

- **Spec de vídeo da Meta para live (1080p@30):** 3.000–6.000 Kbps, H.264 High **Level 4.1**, GOP ≤2s, AAC-LC 128k estéreo 44.1/48kHz. A conversão usa CRF 19 com `maxrate 5000k` — CRF sem teto gerava ~8 Mbps, acima da faixa, e o Instagram degradava a entrega (qualidade "terrível" na live de 10/07 apesar do arquivo bom).

**Constantes:** duração máx 4h (14400s) · corte automático 3h50 (13800s).

---

## Status

### ✅ Pronto e testado
- Painel completo (tela Lives, cards, upload, conexão, cronômetro, várias lives juntas).
- Streaming real no Instagram (foto e vídeo), RTMPS estável, iniciar/encerrar/corte.
- Conversão automática no upload + stream-copy (CPU baixa).
- Trava de instância única no worker.
- Exclusão de material (com limpeza do storage).

### ▶️ Como ligar o worker

O painel (navegador) **não pode** ligar o worker sozinho — por segurança, um site não abre programas no PC. E o worker precisa já estar rodando pra "escutar" quando uma live começa. Porém: o **ffmpeg** (a parte pesada) já liga/desliga sozinho a cada live; só o "vigia" (levíssimo, ~0 CPU parado) precisa estar de pé.

Duas formas:
- **Atalho de 1 clique (pronto):** `momentum-hub/worker/iniciar-lives.bat`. Abre quando for fazer lives, fecha quando terminar. Combina com "ligo quando subo, desligo quando encerro".
- **Sempre ligado (falta configurar):** pra rodar 24/7 sem pensar, **Agendador de Tarefas do Windows** apontando pro `iniciar-lives.bat` na inicialização (ou **pm2** pra reiniciar se cair). Como o vigia não pesa parado, é tranquilo deixar sempre.

### ⏳ Falta fazer
- **Persistência 24/7 automática** (opcional): configurar o Agendador de Tarefas do Windows pra subir o `iniciar-lives.bat` no boot. Só necessário se quiser que rode sem ninguém abrir o atalho.

### 💡 Ideias futuras (não urgentes)
- Permissão por cliente no RLS (hoje qualquer operador logado vê todos).
- Rodízio automático de materiais numa mesma live.
- Se o volume de lives simultâneas crescer muito, isolar tráfego por proxy/VPS (todas saem do mesmo IP hoje) — reavaliar só se necessário.
