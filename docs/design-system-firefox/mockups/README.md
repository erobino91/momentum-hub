# Momentum Hub vestido com o Flare — mockups

Quatro telas reais do portal redesenhadas com o design system do Firefox
(ver `../README.md`). São **estudos de design**, não código do app: nada aqui
entra em `src/`.

São duas versões da mesma tela: no **roxo do Firefox** e na **marca Momentum**.

| Tela | Rota real | Roxo (Flare) | Vermelho (MMT) |
|---|---|---|---|
| Portal do cliente, os quatro módulos | `/` | `01-portal-home.png` | `01-portal-home-mmt.png` |
| Dashboard do cliente | `/dashboard` | `02-dashboard.png` | `02-dashboard-mmt.png` |
| Painel da agência, lista de empresas | `/agencia` | `03-agencia.png` | `03-agencia-mmt.png` |
| Entrada no portal | `/login` | `04-login.png` | `04-login-mmt.png` |

Cada `.html` abre direto no navegador. Renderizados a 1440×980 no Edge.

Os quatro `*-mmt.html` são **gerados** a partir dos originais: o único delta é
`data-marca="mmt"` no `<html>` e mais um `<link>` para `tema-mmt.css`. Mexeu num
original, gere de novo — não edite os `-mmt` à mão.

**Os dados são fictícios** — nomes de empresa inventados e números redondos.
Nenhum resultado de cliente aparece aqui.

## O conteúdo é o de verdade

Os rótulos saíram do código, não da imaginação: os quatro módulos e suas descrições
vêm de `src/lib/modules.ts`; "Valor Investido / Valor em Vendas / ROAS", os três canais
(Mesa & Salão, Delivery Próprio, iFood) com Faturamento/Pedidos/Ticket Médio e o funil
(Visitas → Visualizações → Sacola → Revisão → Concluídos) vêm de
`src/app/dashboard/dashboard-view.tsx`; o menu lateral e as colunas da tabela vêm de
`src/components/shell.tsx` e `src/components/agencia/tabela-empresas.tsx`. Os estados
"Em configuração" e "Em aberto" são os de verdade.

## O que mudou em relação ao portal de hoje

| | Hoje (Fase 8) | Nos mockups |
|---|---|---|
| Fundo | quase preto `#0A0C10` | roxo escuro `#150226` / `#210340` |
| Marca | vermelho `#E31B1B` | roxo `#7543e3` |
| Títulos | Inter | Archivo condensado (`wdth 75`, entrelinha .9) |
| Botão | raio 8 px | pílula, raio 128 px |
| Cartão | raio 8 px, borda cinza | raio 24 px, borda roxa |
| Fundo da tela | chapado | brilho roxo desfocado atrás da barra |

## A camada de aplicação

`app.css` é o que o `demo.html` do design system não tem: componentes de **app**
(barra do topo, menu lateral, tabela, KPI, campo). Uma página de marketing tem uma
superfície só; um portal precisa de três, e elas são derivadas da escala roxa do Flare,
não inventadas:

```css
--app-canvas:  var(--fx-color-dark-purple-2);  /* #150226 fundo da tela   */
--app-surface: var(--fx-color-dark-purple);    /* #210340 cartão, barra   */
--app-raised:  var(--fx-color-purple);         /* #3a0f6e elevado, KPI    */
```

Dois ajustes deliberados, que valem para qualquer aplicação do Flare fora de uma
landing page:

- **O brilho desfocado foi para o topo.** Na página do Firefox ele fecha o rodapé;
  num app, onde a pessoa passa o dia, ele funciona como iluminação da barra superior.
- **O raio do banner de CTA desceu um degrau** (128 → 80 px). O raio 128 px do Flare
  pressupõe a largura de 1170 px; num bloco mais estreito o mesmo valor vira pastilha.

## A versão na marca Momentum

`tema-mmt.css` não redesenha nada: só reescreve token, depois de `../tokens.css` e
`app.css`. Toda a forma continua vindo do Flare — pílula de 128 px, título condensado,
cartão de 24 px, brilho desfocado no fundo.

A troca tem **duas partes**, e é aqui que a ideia de "é só mudar 3 hex" quebra:

1. **A cor da ação.** `#7543e3` → `#E31B1B`, hover `#C01515`, `:active` `#7A0D0D`,
   e o vermelho como *texto* no escuro é `#FF5A5A` — `#E31B1B` dá 4,1:1 e reprova em AA.
2. **As superfícies.** O roxo escuro do Flare (`#210340`) vira o neutro que o hub já
   usa hoje (`#0A0C10` / `#11141B` / `#1E2430`). Vermelho sobre fundo roxo brigaria:
   a superfície faz parte da paleta, não é pano de fundo.

Mais o gradiente de brilho refeito na rampa vermelha, ainda em `oklch` pelo mesmo motivo
do original (interpolação em sRGB suja no meio).

### O que a troca de cor custou de verdade

O vermelho carrega um significado que o roxo não tem: **alerta**. A regra que o portal
já adota — *vermelho preenchido só na ação principal (uma por tela), no símbolo, na aba
ativa e no anel de foco; nunca em selo de estado* — deixa de ser preferência e vira
requisito. As consequências estão no fim do `tema-mmt.css`:

| No roxo | No vermelho | Por quê |
|---|---|---|
| selo de informação tingido da marca | selo neutro | selo cheio de vermelho parece alerta |
| "Configurar" preenchido na tabela | contorno | ação de lista não é a ação principal da tela |
| botão dourado no CTA | botão branco | dourado é assinatura do Firefox; sobre vermelho quem contrasta é o branco |
| ponto de módulo roxo | cheio / vazio em branco | ponto é estado, não marca |
| barra do funil na cor da ação | `#FF5A5A` | barra é dado, não botão |
| rótulo sobre superfície da marca em `soft-purple-4` | branco a 82 % | `#FF5A5A` sobre vermelho some |

Esse último virou token (`--app-on-brand-label`) em vez de cor escrita na tela: sobre o
roxo o roxo claro contrasta, sobre o vermelho não. Quem depende do tema tem de ser token —
foi o único bug de contraste que a troca produziu, e ele apareceu em três telas de uma vez.

Ver `reference-marca-mmt` para a regra completa de marca vs. perigo.
