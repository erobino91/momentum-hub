/**
 * Primitivas de interface do hub (Fase 8).
 *
 * Antes disto o "sistema de design" eram duas strings exportadas de
 * `auth-shell.tsx` — `campoClasse` e `botaoClasse` — usadas para input, select,
 * textarea e até para input de arquivo. As duas foram apagadas quando a última
 * tela migrou; se alguma voltar a aparecer, é a ideia errada voltando.
 */
export {
  Botao,
  Rodinha,
  botaoEstilo,
  type TamanhoBotao,
  type VarianteBotao,
} from "./botao";
export { BotaoEnviar } from "./botao-enviar";
export { Campo, Entrada, Selecao, AreaTexto, campoEstilo, opcaoEstilo } from "./campo";
export { Cartao, Vazio } from "./cartao";
export { Selo, type TomSelo } from "./selo";
export { Aviso, type TomAviso } from "./aviso";
export { Tabela, thEstilo, tdEstilo, numEstilo } from "./tabela";
export { Dialogo, AcoesDialogo } from "./dialogo";
export { Progresso, formatarMB, type TomProgresso } from "./progresso";
export { ConfirmarAcao } from "./confirmar-acao";
