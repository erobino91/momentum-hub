# Plano: WhatsApp da agência dentro do hub

> Criado em 06/10/2026. **Status: nada feito.** Decisões tomadas em 07/10 (ver "Decidido"). Aguarda o "go" da Fase 1; Luis vai comprar o chip (Fase 0).

**Objetivo:** um número de WhatsApp da agência, conectado pelo WhatsApp Web, que manda avisos nos grupos dos clientes a partir de uma tela só da agência no hub. Primeira versão só envia, sem ler nem responder mensagens.

## Como funciona
- Um programa novo na máquina que já roda o worker das lives, separado dele. Se o WhatsApp travar, as lives seguem no ar.
- Ele usa o **Baileys**, a biblioteca gratuita mais leve: não abre navegador e não precisa de Docker. A Evolution API faz o mesmo, mas exige instalar bem mais coisa.
- Hub e programa conversam pelo Supabase, como as lives. O hub grava a mensagem numa fila, o programa envia e marca como enviada ou com erro. O Vercel não precisa segurar conexão nenhuma.
- O login do WhatsApp fica numa pasta dessa máquina, fora do GitHub. Quem pegar essa pasta manda mensagem como a agência.

## Fases
Uma por vez, com o "go" entre elas e um commit por fase, como no resto do hub.

**Fase 0: preparação (parte do Luis)**
1. Separar um chip só para isso, nunca o número principal nem o da agência.
2. Instalar o WhatsApp Business num celular com esse chip, com nome e foto da Momentum.
3. Adicionar o número nos grupos dos clientes.
4. Usar o número normalmente por alguns dias antes de automatizar. Número novo que já sai disparando é o que mais toma bloqueio.

**Fase 1: banco**
- Três tabelas, que só a agência enxerga:
  - estado da conexão: conectado ou não, o QR Code da vez, horário do último sinal;
  - grupos do número, com o vínculo a cada empresa;
  - fila de envios: grupo, texto, situação, erro, quem mandou e quando.
- Pronto quando: um cliente logado não consegue ler nenhuma dessas tabelas. Testar com o mesmo script de RLS do hub.

**Fase 2: o programa do WhatsApp**
- Conecta e grava o QR Code no banco para aparecer na tela do hub.
- Puxa a lista de grupos sozinho.
- Envia a fila com intervalo aleatório de alguns segundos entre mensagens, para não parecer robô.
- Reconecta sozinho quando cai e avisa no banco se precisar ler o QR Code de novo.
- Só roda uma cópia por vez, com a mesma trava do worker das lives.
- Liga junto com o Windows, com um `.bat` igual ao das lives.
- Pronto quando: uma mensagem posta na fila chega num grupo de teste.

**Fase 3: tela no hub (`/agencia/whatsapp`)**
- Mostra se está conectado e, quando precisar, o QR Code para ler pelo celular.
- Lista os grupos, cada um com a empresa ligada a ele.
- Campo de mensagem com escolha de um ou vários grupos e botão enviar.
- Histórico do que foi enviado, com o que deu erro.
- Pronto quando: o Luis manda pela tela e a mensagem chega no grupo.

**Fase 4: aviso do mês fechado**
- Ao publicar o mês de uma empresa, aparece o botão **"Avisar cliente"**. Ele já vem com o texto e o link do dashboard (`/d/<token>`), prontos para enviar no grupo dela.
- Começar com botão, não com envio automático: se publicar errado, dá para corrigir antes de o cliente ver. Se depois de um mês der tudo certo, passa a ser automático.

## Decidido (07/10/2026)
1. **Chip:** novo, só para isso. O Luis vai comprar.
2. **Vários grupos de uma vez:** sim, quando for a mesma mensagem para todos (feriado, aviso geral). Sai como um envio por grupo na fila, com espera aleatória entre um e outro.
3. **Só texto** na primeira versão. Imagem e PDF ficam para depois.
4. **Máquina:** a mesma das lives. Se ela desligar, os envios esperam ela voltar. Na Fase 7 (VPS) os dois programas mudam juntos.

## Riscos
- **Bloqueio do número:** risco baixo com pouco volume, só em grupos onde o número já está, com intervalo e número separado. Mas existe, e não tem a quem recorrer.
- **O WhatsApp muda e a biblioteca para de funcionar:** de tempos em tempos é preciso atualizar o Baileys. Quando isso acontecer, aparece como "desconectado" na tela.
- **A pasta de login é sensível:** fica só nessa máquina e nunca vai para o GitHub.

## Fica para depois
- Ler e responder mensagens pelo hub.
- Envio agendado, como mandar segunda às 9h.
- Mandar mensagem no privado dos clientes, que tem mais risco de bloqueio que grupo.
- Imagem e PDF nas mensagens.
