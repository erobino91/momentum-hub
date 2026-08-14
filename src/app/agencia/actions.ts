"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clienteSecreto } from "@/lib/supabase/secreto";
import { MODULE_KEYS } from "@/lib/modules";

/**
 * Todas as escritas aqui passam pela RLS: a policy `*_write_agency` só deixa
 * quem tem papel `agency` gravar. A checagem no servidor é uma segunda camada,
 * para devolver mensagem em vez de erro cru.
 */
async function exigirAgencia() {
  const supabase = createClient();
  const { data: ehAgencia } = await supabase.rpc("is_agency");
  if (!ehAgencia) redirect("/");
  return supabase;
}

function voltar(erro?: string): never {
  revalidatePath("/agencia");
  redirect(erro ? `/agencia?erro=${encodeURIComponent(erro)}` : "/agencia?ok=1");
}

export async function criarOrg(formData: FormData) {
  const supabase = await exigirAgencia();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase();

  if (!name || !slug) voltar("Nome e slug são obrigatórios.");
  if (!/^[a-z0-9-]+$/.test(slug))
    voltar("O slug aceita só letras minúsculas, números e hífen.");

  const { data: org, error } = await supabase
    .from("orgs")
    .insert({ name, slug })
    .select("id")
    .single();

  if (error || !org) voltar("Não foi possível criar. O slug já pode existir.");

  // Uma linha por módulo, só para haver onde guardar configuração. Não é
  // liberação: a empresa nasce com os quatro módulos, e cada um aparece pronto
  // quando o recurso dele existir.
  await supabase
    .from("module_config")
    .insert(MODULE_KEYS.map((key) => ({ org_id: org.id, module: key })));

  voltar();
}

/**
 * Grava o slug do cliente no dashboard antigo. Fica em `module_config.config`
 * porque é configuração de um módulo, não da empresa — e a RLS de
 * `module_config` já impede uma org de ler a config da outra.
 */
export async function salvarSlugDashboard(formData: FormData) {
  const supabase = await exigirAgencia();
  const orgId = String(formData.get("org_id") ?? "");
  const slug = String(formData.get("dashboard_slug") ?? "")
    .trim()
    .toLowerCase();

  if (!orgId) voltar("Empresa inválida.");
  if (slug && !/^[a-z0-9-]+$/.test(slug))
    voltar("O slug aceita só letras minúsculas, números e hífen.");

  // Lê para preservar o resto do `config` — o upsert reescreve a coluna inteira.
  const { data: atual } = await supabase
    .from("module_config")
    .select("config")
    .eq("org_id", orgId)
    .eq("module", "dashboard")
    .maybeSingle<{ config: Record<string, unknown> | null }>();

  const config = { ...(atual?.config ?? {}) };
  if (slug) config.dashboard_slug = slug;
  else delete config.dashboard_slug;

  const { error } = await supabase
    .from("module_config")
    .upsert(
      { org_id: orgId, module: "dashboard", config },
      { onConflict: "org_id,module" },
    );

  if (error) voltar("Não foi possível salvar o slug do dashboard.");
  voltar();
}

/**
 * Prepara a Fila de Espera de um cliente: cria o restaurante e dá acesso ao
 * dono no portal.
 *
 * Duas coisas que não são detalhe:
 *
 * 1. **O id do restaurante é o id da empresa.** É a invariante da Fase 4, e uma
 *    FK `on delete restrict` recusa qualquer outro. Nunca gerar id aqui.
 * 2. **O dono precisa de `profiles`, não basta o membership.** Quem dá acesso ao
 *    Fila é `profiles`; membership só diz que a pessoa chega ao módulo. Sem esta
 *    linha, o card acende e leva a "esta conta não atende nenhum restaurante".
 *
 * O papel do dono é `partner` (só leitura) de propósito: quem trabalha no balcão
 * é `host`, e um segundo `host` é como se apaga a fila sem querer no meio do
 * serviço. Se o dono precisar mesmo mexer, é trocar uma palavra.
 *
 * A escrita vai pela **chave secreta**, não pela sessão da agência. As tabelas
 * do Fila não têm policy de insert (no projeto de origem quem semeava era o
 * service role) e, mais importante, a agência lê zero linhas delas — é
 * propriedade afirmada pelo `verify:fase4`, e existe porque a agência não tem o
 * que fazer com nome, telefone e data de nascimento dos clientes do salão.
 * Abrir a RLS para conseguir provisionar seria pagar com isso; provisionar
 * server-side, atrás de `exigirAgencia()`, não custa nada.
 */
export async function prepararFila(formData: FormData) {
  const supabase = await exigirAgencia();
  const orgId = String(formData.get("org_id") ?? "");
  if (!orgId) voltar("Empresa inválida.");

  const { data: org } = await supabase
    .from("orgs")
    .select("name, slug")
    .eq("id", orgId)
    .maybeSingle<{ name: string; slug: string }>();
  if (!org) voltar("Empresa não encontrada.");

  const secreto = clienteSecreto();

  const { data: existente } = await secreto
    .from("restaurants")
    .select("id")
    .eq("id", orgId)
    .maybeSingle<{ id: string }>();

  if (!existente) {
    const { error } = await secreto
      .from("restaurants")
      .insert({ id: orgId, name: org.name, slug: org.slug });
    if (error) voltar("Não foi possível preparar a fila. O endereço já pode existir.");
  }

  // Todos os donos da empresa que ainda não têm acesso ao salão.
  const { data: donos } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("role", "owner")
    .returns<{ user_id: string }[]>();

  if (!donos?.length) {
    voltar(
      "Restaurante criado, mas ninguém desta empresa tem acesso ao portal ainda. Convide o dono e clique de novo.",
    );
  }

  const { data: jaTem } = await secreto
    .from("profiles")
    .select("id")
    .in("id", donos.map((d) => d.user_id))
    .returns<{ id: string }[]>();

  const faltando = donos.filter(
    (d) => !jaTem?.some((p) => p.id === d.user_id),
  );

  if (faltando.length) {
    const { error } = await secreto.from("profiles").insert(
      faltando.map((d) => ({
        id: d.user_id,
        restaurant_id: orgId,
        name: org.name,
        role: "partner",
      })),
    );
    if (error) voltar("Restaurante criado, mas não foi possível dar acesso ao dono.");
  }

  voltar();
}

export type ResultadoAcesso =
  | { estado: "vazio" }
  | { estado: "erro"; mensagem: string }
  | { estado: "criado"; email: string; senha: string }
  | { estado: "vinculado"; email: string };

/**
 * Cria a conta do cliente e já a vincula à empresa.
 *
 * A agência entrega o acesso pronto — não pede para o cliente se cadastrar. A
 * senha é sorteada, aparece **uma vez** na tela de quem criou e não é guardada
 * em lugar nenhum: quem quiser trocar usa "esqueci minha senha" no portal.
 *
 * Devolve o resultado em vez de redirecionar porque a senha não pode viajar na
 * query string — ela ficaria no histórico do navegador e no log de acesso.
 */
export async function criarAcessoCliente(
  _anterior: ResultadoAcesso,
  formData: FormData,
): Promise<ResultadoAcesso> {
  const supabase = createClient();
  const { data: ehAgencia } = await supabase.rpc("is_agency");
  if (!ehAgencia) redirect("/");

  const orgId = String(formData.get("org_id") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "owner");

  if (!orgId) return { estado: "erro", mensagem: "Empresa inválida." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { estado: "erro", mensagem: "Email inválido." };

  const admin = clienteSecreto();

  // Já existe conta com esse email? Então é só dar acesso a esta empresa —
  // acontece com quem já é cliente de outra, e com quem já usava o CMV.
  const { data: lista } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existente = lista?.users.find(
    (u) => u.email?.toLowerCase() === email,
  );

  let userId = existente?.id ?? null;
  let senha: string | null = null;

  if (!userId) {
    senha = senhaSorteada();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true, // a agência entregou a senha; não há o que confirmar
    });
    if (error || !data.user)
      return {
        estado: "erro",
        mensagem: `Não foi possível criar a conta: ${error?.message ?? "erro desconhecido"}`,
      };
    userId = data.user.id;
  }

  const { error: erroMembership } = await supabase
    .from("memberships")
    .upsert(
      { user_id: userId, org_id: orgId, role },
      { onConflict: "user_id,org_id" },
    );
  if (erroMembership)
    return { estado: "erro", mensagem: "Conta criada, mas o vínculo falhou." };

  revalidatePath("/agencia");
  return senha
    ? { estado: "criado", email, senha }
    : { estado: "vinculado", email };
}

/** Senha legível ao telefone: sem caractere que se confunda ao ditar. */
function senhaSorteada() {
  const alfabeto = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(14);
  let saida = "";
  for (let i = 0; i < bytes.length; i++) saida += alfabeto[bytes[i] % alfabeto.length];
  return `${saida.slice(0, 5)}-${saida.slice(5, 10)}-${saida.slice(10)}`;
}
