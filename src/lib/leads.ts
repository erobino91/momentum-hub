/**
 * Leads do formulário da LP da agência — o que a tela e a action dividem.
 *
 * Sem nada de servidor aqui: a tabela é Client Component e importa este arquivo.
 * O envio para a Meta mora em `leads-meta.ts`.
 */

export const STATUS_LEAD = [
  "novo",
  "conversando",
  "proposta",
  "sem_resposta",
  "cliente",
  "descartado",
] as const;

export type StatusLead = (typeof STATUS_LEAD)[number];

export const ROTULO_STATUS: Record<StatusLead, string> = {
  novo: "Novo",
  conversando: "Em conversa",
  proposta: "Proposta enviada",
  sem_resposta: "Não respondeu",
  cliente: "Virou cliente",
  descartado: "Descartado",
};

export function ehStatusLead(valor: unknown): valor is StatusLead {
  return STATUS_LEAD.includes(valor as StatusLead);
}

export type EventoMeta = "Lead" | "PropostaEnviada" | "Purchase";

export const ROTULO_EVENTO: Record<EventoMeta, string> = {
  Lead: "Lead",
  PropostaEnviada: "Proposta",
  Purchase: "Venda",
};

/**
 * Qual evento a mudança de situação manda. As outras situações não mandam nada:
 * "não respondeu" e "descartado" não ensinam nada à Meta, e ela não tem como
 * desfazer o que já recebeu.
 */
export function eventoDoStatus(status: StatusLead): EventoMeta | null {
  if (status === "proposta") return "PropostaEnviada";
  if (status === "cliente") return "Purchase";
  return null;
}

export type EventoLead = {
  id: string;
  evento: EventoMeta;
  valor: number | null;
  enviado_em: string | null;
  erro: string | null;
};

export type Lead = {
  id: string;
  nome: string;
  whatsapp: string;
  faturamento: string;
  status: StatusLead;
  valor_mensal: number | null;
  created_at: string;
  lp_lead_eventos: EventoLead[];
};

/**
 * O form grava só dígitos, com DDD e normalmente sem o 55. Quem digitou o +55
 * chega com 12 ou 13 dígitos começando por 55.
 */
export function telefoneComPais(digitos: string): string {
  return digitos.length >= 12 && digitos.startsWith("55")
    ? digitos
    : `55${digitos}`;
}

/** `17991234567` → `(17) 99123-4567`. */
export function formatarTelefone(digitos: string): string {
  const local = telefoneComPais(digitos).slice(2);
  if (local.length < 10) return digitos;
  return `(${local.slice(0, 2)}) ${local.slice(2, -4)}-${local.slice(-4)}`;
}

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? "";
}

export function linkWhatsApp(lead: Pick<Lead, "nome" | "whatsapp">): string {
  const texto = `Opa ${primeiroNome(lead.nome)}, tudo bem? Aqui é o Luis, vi que você preencheu o formulário na página da Momentum, como posso te ajudar?`;
  return `https://wa.me/${telefoneComPais(lead.whatsapp)}?text=${encodeURIComponent(texto)}`;
}

/**
 * Há quanto tempo, em texto curto: "há 25 min", "há 3 h", "há 2 dias". Não
 * depende de fuso — é diferença entre dois instantes.
 */
export function haQuanto(iso: string, agora = Date.now()): string {
  const min = Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60000));
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.floor(h / 24);
  return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

/** Lead novo esperando há um dia ou mais pede atenção. */
export function esperaDemais(lead: Pick<Lead, "status" | "created_at">, agora = Date.now()) {
  return (
    lead.status === "novo" &&
    agora - new Date(lead.created_at).getTime() >= 24 * 60 * 60 * 1000
  );
}
