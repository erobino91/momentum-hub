# Momentum Hub vestido com o Flare — mockups

Quatro telas reais do portal redesenhadas com o design system do Firefox
(ver `../README.md`). São **estudos de design**, não código do app: nada aqui
entra em `src/`.

| Imagem | Tela | Rota real |
|---|---|---|
| `01-portal-home.png` | Portal do cliente, os quatro módulos | `/` |
| `02-dashboard.png` | Dashboard do cliente | `/dashboard` |
| `03-agencia.png` | Painel da agência, lista de empresas | `/agencia` |
| `04-login.png` | Entrada no portal | `/login` |

Cada `.html` abre direto no navegador. Renderizados a 1440×980 no Edge.

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

## Trocar o roxo pelo vermelho da MMT

O sistema inteiro sai de token, então virar a paleta para a marca MMT é editar três
linhas de `../tokens.css` — nenhum componente muda:

```css
--fx-color-light-purple: #E31B1B;  /* ação primária */
--fx-color-link-purple:  #C01515;  /* hover        */
--fx-color-purple:       #8E0F0F;  /* :active      */
```

Vale lembrar a regra que já vale no portal: vermelho preenchido só na ação principal,
uma por tela — e `#FF5A5A` quando o vermelho for **texto** no escuro, porque `#E31B1B`
reprova em contraste. Ver `reference-marca-mmt`.
