/**
 * Regras do arquivo de material — as mesmas dos dois lados.
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
