# Design System do Firefox — "Flare"

Referência extraída de `firefox.com/pt-BR/whatsnew/general/` (Firefox 155) em **01/09/2026**.

Bundles de origem:

| Arquivo | Tamanho | O que é |
|---|---|---|
| `flare.291dd4638f30.css` | 298 KB | o sistema real, organizado em `@layer theme / defaults / components / template` |
| `flare_base.7c29812b380f.css` | 15 KB | fallback para navegador sem `@layer` (IE) — cores escritas à mão, ignorar |

Arquivos desta pasta:

- `tokens.css` — todos os tokens reescritos com prefixo `--fx-`, prontos para colar em projeto
- `demo.html` — página estática que monta o sistema inteiro sobre esses tokens (abre direto no navegador)
- `README.md` — este documento
- `mockups/` — quatro telas do Momentum Hub redesenhadas com este sistema (PNG + o HTML de cada uma)

> **Material de referência.** Marca, fontes e ilustrações são da Mozilla. O que é reaproveitável
> aqui é a **arquitetura**, não os ativos.

---

## 1. A ideia central: duas camadas de token

Esta é a parte que vale copiar. O sistema tem duas camadas e nenhum componente atravessa a fronteira.

```
--token-color-light-purple: #7543e3        ← camada 1: primitivo (cor crua, nome descreve a cor)
        ↓
--fl-theme-color-link: var(--token-color-light-purple)   ← camada 2: semântico (nome descreve o papel)
        ↓
.fl-button { color: var(--fl-theme-color-link) }         ← componente só conhece a camada 2
```

O tema escuro é **só** um bloco que reescreve a camada 2:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --fl-theme-color-text: var(--token-color-white);
    --fl-theme-background: var(--token-color-dark-purple);
    /* ...30 linhas, e a página inteira vira escura */
  }
}
```

Nenhum componente tem regra de tema escuro. Nenhum `.dark &`. Nenhuma cor duplicada.

Na nossa versão os prefixos viraram `--fx-color-*` (primitivo) e `--fx-theme-*` (semântico).

---

## 2. Cores

### Roxo — o eixo do sistema

| Token | Hex | Onde é usado |
|---|---|---|
| `light-purple` | `#7543e3` | **ação primária**, anel de foco, link no tema claro |
| `link-purple` | `#6132bc` | hover da ação, cor de link padrão |
| `medium-purple` | `#4c2489` | superfície roxa no tema escuro (card de passo, menu hambúrguer) |
| `purple` | `#3a0f6e` | estado `:active` da ação, fundo de ícone |
| `dark-purple` | `#210340` | **fundo escuro da página e rodapé** |
| `dark-purple-2` | `#150226` | sombra de notificação no escuro |
| `dark-purple-3` | `#0c0117` | fundo escuro mais fundo (blog) |

Com alfa, para borda e sombra: `light-purple` a 20/40/60/80%, `dark-purple` a 22/30/40%.

### Roxo claro — superfície no claro, texto no escuro

| Token | Hex | Onde é usado |
|---|---|---|
| `soft-purple` | `#f1e7f8` | superfície clara, cor de divisor, borda de card preenchido |
| `soft-purple-2` | `#e4d8fc` | fundo de `<code>`, botão desabilitado no claro |
| `soft-purple-3` | `#dfc9ff` | fundo de ícone no escuro |
| `soft-purple-4` | `#c7a8ff` | **link e texto de marca no escuro** |
| `soft-purple-5` | `#ae8aff` | texto desabilitado no escuro |
| `soft-purple-6` | `#9468ff` | — |
| `nav-icon-purple` | `#ae89ff` | ícone da navegação |

Note a inversão: `soft-purple` é *superfície* no claro; `soft-purple-4` é *texto* no escuro.
São faixas de luminância diferentes para papéis diferentes, não uma escala genérica de 50 a 900.

### Neutros

| Token | Hex | Onde é usado |
|---|---|---|
| `black-4` | `#15141a` | texto padrão no claro |
| `black-3` | `#1c1b22` | — |
| `black-2` | `#23222b` | `:active` do botão ghost |
| `black-1` | `#42414d` | texto de rótulo, cor de notificação |
| `grey-3` / `grey-4` | `#7b7a82` | texto apagado, borda de banner contornado |
| `grey-2` | `#e8e8e8` | borda sutil no claro |
| `grey-1` | `#f9f9fb` | superfície neutra |
| `white` | `#fff` | fundo do tema claro |

### Quentes e semânticas

`cream #fcf5f0` (card de passo no claro) · `soft-green #deffd6` · `soft-orange #fff2e5` ·
`soft-red #ffeae9` · `soft-magenta #ffeafe` · erro `#b40600` no claro e `#ff453f` no escuro.

As semânticas vêm **em par claro/escuro**: `soft-red` (fundo claro) contra `secondary-red-3 #31000e`
(fundo escuro), com a borda em `secondary-red`. Nunca uma cor só de erro para os dois temas.

### Gradientes

| Token | Valor | Papel |
|---|---|---|
| `gradient-firefox` | `#ffeb49 → #f60 → #fb2872` | marca — só como destaque |
| `gradient-gold` / `gradient-gold-button` | amarelo → laranja | botão de destaque |
| `gradient-purple` | radial `#ae49ec → #210340` | banner de CTA de fim de página |
| `gradient-radial-purple` | radial `#7543e3 → #210340` | banner invertido |
| `gradient-blurred-bg` | 9 paradas em **oklch** | o brilho roxo desfocado atrás da página no escuro |
| `gradient-light` | branco 90% → branco | superfície de card preenchido |

O `gradient-blurred-bg` é escrito em `oklch` justamente porque uma interpolação em sRGB entre
roxos escuros suja no meio do caminho. Nove paradas manuais em vez de duas.

### Regra de aplicação

- **Roxo médio preenchido** = ação primária. Uma por bloco.
- **Roxo escuro** = superfície escura e rodapé, nunca texto.
- **Soft purple** = superfície clara, borda, fundo de código.
- **Gradiente dourado/laranja** = marca Firefox. Aparece em *um* botão de destaque e nunca
  como cor de estado, pílula ou alerta.
- **Semânticas** (verde/laranja/vermelho) só em notificação e mensagem de erro.

---

## 3. Tipografia

### As duas famílias

| Papel | Fonte original | Eixos |
|---|---|---|
| Títulos | **Mozilla Headline VF** | peso 100–900, largura `wdth` 75%–125% |
| Corpo | **Mozilla Text VF** | peso 100–900 |

### ⚠️ Licença — não usar as originais

`Mozilla Headline VF` e `Mozilla Text VF` são fontes de marca da Mozilla, servidas do CDN
deles. Não entram em material MMT.

**Substitutas livres que reproduzem o efeito** (é o que o `demo.html` usa):

| Papel | Substituta | Por quê |
|---|---|---|
| Títulos | **Archivo** (Google Fonts) | tem eixo `wdth` variável (62.5–125), que é o que permite o condensado |
| Alternativa | **Inter Tight** | condensado fixo, sem eixo — mais simples, menos controle |
| Corpo | **Inter** | já é a fonte da marca MMT, resolve os dois lados |

Mapeamento de eixo: `"wght" 600, "wdth" 75` na Headline → o mesmo par na Archivo.
A Archivo é ligeiramente mais aberta; se precisar apertar mais, `wdth 70`.

### O gesto assinatura

```css
.fl-heading-condensed {
  font-variation-settings: "wght" 600, "wdth" 75;
  line-height: .9;
}
```

Peso semibold + largura condensada + entrelinha **menor que 1**. É isso — mais nada — que faz
o título "parecer Firefox". Vale para `heading-md` e acima; de `heading-sm` para baixo o
sistema faz `font-variation-settings: unset` e volta ao normal.

### Escala fluida — três degraus, sem `clamp()`

O mesmo nome de token recebe três valores, em `:root`, em `@media (min-width:600px)` e em
`@media (min-width:900px)`. Nenhuma unidade `vw`, nenhum `clamp()`.

| Token | mobile | ≥600px | ≥900px |
|---|---|---|---|
| `heading-3xl` | 5rem | 8rem | 10rem |
| `heading-2xl` | 4rem | 5rem | 8rem |
| `heading-xl` | 3rem | 4rem | 5rem |
| `heading-lg` | 2.5rem | 2.5rem | 4rem |
| `heading-md` | 2rem | 2rem | 3rem |
| `heading-sm` | 1.5rem | 1.5rem | 2rem |
| `heading-xs` | 1.125rem | 1.125rem | 1.5rem |
| `heading-2xs` | 1rem | 1rem | 1rem |
| `body-lg` | 1.25rem | 1.5rem | 2rem |
| `body-md` | 1.125rem | 1.25rem | 1.5rem |
| `body-sm` | 1rem | 1rem | 1rem |
| `body-xs` | .875rem | .875rem | .875rem |
| `body-2xs` | .75rem | .75rem | .75rem |

A base do `<html>` é `body-sm` = 1rem = 16px. Corpo de texto usa `line-height: 1.4`,
título `1.2` (ou `.9` quando condensado).

### Superheading

O rótulo pequeno acima do título (`NOVIDADES DO FIREFOX 155` na página original):
`body-2xs`, peso 500, cor `--fl-theme-color-brand-text`, caixa alta.

Detalhe fino: a caixa alta é aplicada por container query de idioma —
`@container style(--lang-supports-uppercase: true)`, ligada só em `de`, `en` e `fr`. Em português
o rótulo fica em caixa normal. É acessibilidade de idioma, não decoração.

---

## 4. Espaçamento, raio, largura

Duas escalas separadas por propósito:

- **`spacing`** — dentro do componente: `2 · 4 · 8 · 12 · 16 · 24 · 32 · 40` px
- **`layout`** — entre blocos da página: `24 · 32 · 48 · 64 · 80 · 128 · 160 · 200` px
  (com meios: `md-half 40`, `lg-half 64`)

**Raio:** `4 · 8 · 12 · 24 · 48 · 80 · 128` px. O `128px` é o raio de pílula dos botões
*e* o raio inferior do `.fl-main` sobre o fundo escuro.

**Larguras de conteúdo:** `696` (estreita) · `725` (padrão) · `934` (larga) ·
`1170` (banner) · `1440` (layout) · `393` (mobile).

**Transições:** `.15s` (botão) · `.2s` (card, checkbox) · `.3s` ease.

**Breakpoints:** `600px` e `900px` para quase tudo; `1200px` só para rodapé e galeria.

---

## 5. Botão

Um componente, dirigido por variáveis. As variantes **reescrevem variáveis, não propriedades**.

```css
:root {                                     /* a variante primária É o valor padrão */
  --button-bg-color: var(--token-color-light-purple);
  --button-bg-color-hover: var(--token-color-link-purple);
  --button-bg-color-active: var(--token-color-purple);
  --button-text-color: var(--token-color-white);
  --button-border-color: transparent;
  --button-font-size: var(--fl-theme-font-size-body-sm);
}

.fl-button {
  background-color: var(--button-bg-color);
  border: 2px solid var(--button-border-color);   /* sempre 2px, mesmo transparente */
  border-radius: var(--token-border-radius-xl);   /* 128px */
  font-weight: 600;
  line-height: 1;
  padding: 12px 24px;
}

.fl-button.button-secondary {                     /* só troca variável */
  --button-bg-color: transparent;
  --button-border-color: var(--token-color-light-purple);
  --button-text-color: var(--fl-theme-color-text);
}
```

A borda de 2 px existe mesmo no primário (transparente) para que trocar de variante **não mude
o tamanho do botão**. Detalhe pequeno, evita um bug clássico de layout.

### Variantes

| Variante | Fundo | Borda | Texto |
|---|---|---|---|
| padrão | `light-purple` | — | branco |
| `button-secondary` | transparente | `light-purple` 2px | cor do tema |
| `button-ghost` | transparente | cor do texto, **1px** | `black-4` (claro) / branco (escuro) |
| `button-gold` | gradiente dourado | — | `black-4` |
| `button-link` | transparente | — | cor de link, sublinhado, peso 400 |

Duas ressalvas que é fácil errar ao copiar:

- **`button-ghost` inverte com o tema.** Texto e borda são `black-4` no claro e **branco** no
  escuro; o hover inverte junto (fundo vira a cor do texto, texto vira o oposto). Se você copiar
  a variante com a cor escrita fixa, o botão some no tema escuro. O mesmo vale para o
  desabilitado do `button-secondary` (borda `soft-purple` no claro, `light-purple` no escuro).
- **`button-gold` só existe em contexto escuro** no CSS original — está declarado apenas dentro
  de `@media (prefers-color-scheme: dark)` e de `.fl-force-dark-theme` / `.fl-split-page-upper`.
  No `demo.html` deste diretório ele foi solto para os dois temas, o que é uma simplificação
  nossa, não o comportamento do Firefox.

### Tamanhos

`small` `8px 24px` · `medium` `12px 24px` · `large` `16px 24px` + fonte `body-md` + ícone 20px.

### Estados

- **hover** — troca `--button-bg-color-hover`
- **active** — troca fundo **e** borda para a mesma cor (`purple`), remove outline
- **disabled** — `soft-purple-2` no claro, `purple` no escuro; `opacity: 1` explícito
  (nunca esmaece: troca a cor, o que mantém o contraste previsível)
- **focus** — `outline: 2px solid` na cor da ação com `outline-offset: 2px`.
  Fica **fora** da borda, então funciona igual em qualquer variante.

### O truque do botão dourado

O gradiente não troca de cor no hover: ele **desliza**.
`background-size: calc(100% + 24px)` com `background-position` indo de `top -2px` (normal) para
`-10px` (hover) e `-18px` (active). O botão parece esquentar sem trocar nenhuma cor.

---

## 6. Componentes

### Casca da página

```css
.fl-main {
  background: var(--fl-theme-background);
  border-end-end-radius: var(--fl-theme-main-border-radius);   /* 48px → 128px em ≥900px */
  border-end-start-radius: var(--fl-theme-main-border-radius);
}
```

O conteúdo é um cartão de raio inferior gigante sobre o fundo roxo escuro do `<body>`. Atrás dele,
`has-gradient-bottom::before` pinta o brilho desfocado — e ele só existe no escuro por causa deste
truque:

```css
:root { --content-dark-mode-only: unset; }                     /* claro: content:unset → sem caixa */
@media (prefers-color-scheme: dark) { :root { --content-dark-mode-only: ""; } }
.has-gradient-bottom::before { content: var(--content-dark-mode-only); }
```

Uma variável liga e desliga um pseudo-elemento inteiro, sem duplicar a regra dentro do media query.

### Card

| | outline | filled |
|---|---|---|
| raio | 24px | 48px |
| borda | 1px `soft-purple` (claro) / `light-purple` (escuro) | 1px `soft-purple` (claro) / nenhuma (escuro) |
| fundo | gradiente claro / transparente no escuro | gradiente claro **nos dois temas** |
| respiro | 32px | 40px 24px |
| altura mín. | — | 316px |
| texto | token de tema | preso em `black-4` |

O `filled` mantém fundo claro no escuro de propósito: é uma superfície fixa, não um card de tema —
por isso o texto dele não usa token de tema.

**Hover dos dois:** `translateY(-2px)` mais uma sombra `0 40px 96px` que entra por **opacidade**
num `::after`, não por troca de `box-shadow`. Transição de sombra pula; transição de opacidade não.

**Grade:** 1 coluna → 2 em ≥600px → 3 ou 4 em ≥900px (3 quando são exatamente 3 cards, via
`:has(> :nth-child(3):last-child)`). Gap `40px 16px`, largura máxima 934px.

### Banner

Bloco de altura mínima 260px, centralizado, com variantes de fundo:

- `banner-default` — sem raio, sem fundo, texto no tema
- `banner-outlined` — raio 24px, borda `grey-3`
- `banner-bottom-cta` — **raio 128px, respiro interno 128px, gradiente roxo radial, texto branco**
- `banner-dark-purple-gradient` — `dark-purple` mais uma textura de ruído em PNG

O `bottom-cta` é o gesto mais forte do sistema. Um por página, no fim.

### Notificação

Raio **8px** — bem menor que o resto do sistema, de propósito: notificação não é superfície de
conteúdo. Estrutura fixa (ícone opcional / conteúdo / botão de fechar) com a cor vindo de classe
(`purple`, `white`, `green`, `orange`, `red`), cada uma com fundo, borda, texto e fundo de ícone
próprios em claro **e** escuro.

### Seção

`.fl-section` com respiro vertical `--fl-section-v-padding` (32px → 64px conforme o breakpoint)
e horizontal de 24px. Dentro, `.fl-section-container` é `display:flex; flex-direction:column`
com `gap` igual ao respiro vertical — o espaço entre blocos vem de `gap`, não de margem.
Tem `container-type: inline-size`, então dá para consultar a largura dele em container query.

### Ícones

Sem sprite, sem fonte de ícone, sem SVG inline:

```css
.fl-icon {
  background-color: currentColor;
  mask: var(--icon-src) no-repeat center / 1em 1em;
  block-size: 1em; inline-size: 1em;
  display: inline-block;
}
```

O SVG entra como **máscara** e a cor vem de `currentColor`. Um ícone serve qualquer cor e qualquer
tamanho de fonte, e herda a cor do texto de graça.

### Rodapé

`dark-purple` fixo, texto branco, links sem sublinhado que ganham sublinhado no hover.
Não muda com o tema — é sempre escuro.

---

## 7. O que vale roubar

Em ordem de utilidade para projeto MMT:

1. **Token em duas camadas.** Primitivo com nome de cor, semântico com nome de papel, componente
   só toca no semântico. O tema escuro sai de graça. É a diferença entre trocar 30 linhas e
   caçar cor em 200 arquivos.
2. **Escala fluida por breakpoint, não por `clamp()`.** Mesmo nome de token, três valores em três
   media queries. Muito mais fácil de prever e de revisar do que interpolação contínua.
3. **Botão dirigido por variável.** Uma regra estrutural, variantes que só reescrevem
   `--button-*`. Adicionar uma variante nova = 8 linhas de variável, zero risco.
4. **Borda sempre presente, mesmo transparente.** Trocar variante nunca muda o tamanho.
5. **`opacity: 1` explícito no disabled.** Trocar a cor em vez de esmaecer mantém contraste
   previsível — esmaecer costuma reprovar em AA.
6. **Sombra de hover por opacidade num `::after`.** Transição de `box-shadow` engasga;
   de `opacity` não.
7. **Ícone por `mask` + `currentColor`.** Um arquivo, qualquer cor, qualquer tamanho.
8. **Variável que liga/desliga pseudo-elemento** (`content: var(--x)` com `unset` ou `""`).
   Serve para qualquer decoração que só deve existir num tema.
9. **Gradiente escuro em `oklch` com paradas manuais.** Interpolação sRGB entre roxos escuros
   suja no meio.
10. **Propriedades lógicas em tudo** (`inline-size`, `block-size`, `margin-block-end`,
    `padding-inline`). O site é traduzido para árabe e hebraico — vem de graça.

### O que **não** aproveitar

- As fontes (marca da Mozilla, ver §3).
- A paleta roxa como está: nossa marca é vermelho `#E31B1B`. O que se aproveita é a **estrutura**
  da escala (uma cor de ação, uma de hover, uma de `:active`, uma superfície escura, uma superfície
  clara), não os hex.
- O gradiente Firefox amarelo→laranja→magenta — é assinatura de marca deles.

---

## 8. Como abrir a demonstração

Abra `demo.html` direto no navegador (duplo clique). É estático, não precisa do Next nem de servidor.

O que conferir:

- O botão **Tema** no topo alterna claro/escuro — nenhuma cor quebra, porque só a camada semântica muda.
- O brilho roxo desfocado no fim da página **some no tema claro** (é o truque do `content:`).
- Botões mostram hover, `:active` (segure o clique), `disabled` e foco (navegue com Tab).
- Estreitando a janela, a grade de cards vai de 3 → 2 → 1 coluna e os títulos encolhem em degraus.
- Os títulos aparecem condensados — se aparecerem largos, a Archivo não carregou (sem internet).
