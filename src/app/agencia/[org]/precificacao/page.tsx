import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Org, PricingConfig, PricingProduct } from "@/types/db";
import { criarProduto, apagarProduto } from "./actions";
import { TabelaPrecificacao } from "./tabela";
import { AgenciaShell } from "@/components/shell";
import { AbasEmpresa } from "@/components/agencia/abas";
import { Aviso, BotaoEnviar, Campo, Dialogo, Entrada } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Precificação iFood" };

/**
 * Precificação iFood — ferramenta interna, o cliente não tem esta tela nem lê
 * estas tabelas (a RLS é `is_agency()` nas duas).
 *
 * A conta é a mesma do `pricing.html` antigo, sem mudança nenhuma; o que mudou
 * é onde ela roda. Ver `tabela.tsx`.
 */
export default async function PrecificacaoPage({
  params,
  searchParams,
}: {
  params: { org: string };
  searchParams: { erro?: string };
}) {
  const supabase = createClient();
  const { data: ehAgencia } = await supabase.rpc("is_agency");
  if (!ehAgencia) redirect("/");

  const { data: org } = await supabase
    .from("orgs")
    .select("id,name")
    .eq("id", params.org)
    .maybeSingle<Pick<Org, "id" | "name">>();
  if (!org) redirect("/agencia");

  const [{ data: cfg }, { data: produtos }] = await Promise.all([
    supabase
      .from("pricing_config")
      .select("*")
      .eq("org_id", org.id)
      .maybeSingle<PricingConfig>(),
    supabase
      .from("pricing_products")
      .select("id,name,preco_balcao")
      .eq("org_id", org.id)
      .order("name")
      .returns<Pick<PricingProduct, "id" | "name" | "preco_balcao">[]>(),
  ]);

  const variaveis = {
    taxa_extra: Number(cfg?.taxa_extra ?? 0),
    campanha: Number(cfg?.campanha ?? 0),
    entrega: Number(cfg?.entrega ?? 0),
    cupom: Number(cfg?.cupom ?? 0),
  };

  return (
    <AgenciaShell
      secao="empresas"
      migalha={[
        { rotulo: "Empresas", href: "/agencia" },
        { rotulo: org.name, href: `/agencia/${org.id}` },
        { rotulo: "Precificação" },
      ]}
      titulo="Precificação iFood"
      acoes={<DialogoNovoProduto orgId={org.id} />}
    >
      <AbasEmpresa orgId={org.id} ativa="precificacao" />

      <p className="-mt-1 mb-5 text-sm text-muted">
        Preço de balcão + o que a plataforma come, em três fases.
      </p>

      {searchParams.erro ? (
        <div className="mb-5">
          <Aviso tom="erro">{searchParams.erro}</Aviso>
        </div>
      ) : null}

      <TabelaPrecificacao
        orgId={org.id}
        variaveisIniciais={variaveis}
        produtos={(produtos ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          preco_balcao: Number(p.preco_balcao),
        }))}
        apagarProduto={apagarProduto}
      />
    </AgenciaShell>
  );
}

function DialogoNovoProduto({ orgId }: { orgId: string }) {
  return (
    <Dialogo
      rotulo="+ Novo produto"
      variante="primario"
      tamanho="sm"
      titulo="Novo produto"
      descricao="O preço de balcão é o de sempre; as três fases saem da conta."
    >
      <form action={criarProduto} className="space-y-3">
        <input type="hidden" name="org_id" value={orgId} />
        <Campo rotulo="Nome do produto" obrigatorio>
          <Entrada name="name" required placeholder="Ex.: X-Salada" autoFocus />
        </Campo>
        <Campo rotulo="Preço de balcão" obrigatorio>
          <Entrada
            name="preco_balcao"
            required
            inputMode="decimal"
            placeholder="32,90"
            className="tabular text-right"
          />
        </Campo>
        <div className="flex justify-end pt-1">
          <BotaoEnviar pendente="Cadastrando…">Cadastrar</BotaoEnviar>
        </div>
      </form>
    </Dialogo>
  );
}
