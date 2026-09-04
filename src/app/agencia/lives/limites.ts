/**
 * Regras do módulo de lives — as mesmas dos dois lados.
 *
 * Moram fora de `actions.ts` porque um arquivo `"use server"` só pode exportar
 * função async: uma constante ali derruba o build inteiro. E precisam ser
 * compartilhadas de verdade — o navegador confere o tamanho antes de começar a
 * subir, o servidor confere a extensão antes de assinar, e as duas checagens
 * discordarem seria pior do que não ter uma delas.
 */

/** Teto do arquivo cru: é o limite global do projeto no Supabase. */
export const TAMANHO_MAXIMO = 50 * 1024 * 1024;

export const EXTENSOES = /\.(mp4|mov|m4v|webm|jpg|jpeg|png|webp)$/i;

/**
 * Corte de segurança do worker (`AUTO_CUTOFF_SECONDS`, 3h50).
 *
 * Repetido aqui porque o painel precisa recusar uma janela que o worker cortaria
 * pela metade — aceitar "termina às 23h" e cortar às 21h seria a tela mentindo.
 * Se mudar no `.env` do worker, muda aqui: são dois lugares porque painel e
 * worker não compartilham processo, e o valor é um acordo entre os dois.
 */
export const CORTE_SEGURANCA_MS = 13800 * 1000;

/**
 * Atraso tolerado entre o horário marcado e o worker pegar a live
 * (`TOLERANCIA_ATRASO_SEGUNDOS`). O painel usa o mesmo número para não recusar
 * um início "agora mesmo" que o worker aceitaria sem reclamar.
 */
export const TOLERANCIA_ATRASO_MS = 300 * 1000;
