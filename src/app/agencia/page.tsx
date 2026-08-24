import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { criarOrg } from "./actions";
import { AgenciaShell } from "@/components/shell";
import {
  Aviso,
  BotaoEnviar,
  Campo,
  Dialogo,
  Entrada,
  Vazio,
} from "@/components/ui";
import { TabelaEmpresas } from "@/components/agencia/tabela-empresas";
import { carregarEmpresas, mesAtrasado } from "@/lib/agencia";

export const dynamic = "force-dynamic";
export const metadata = { title: "Empresas" };

type Filtro = "todas" | "atrasadas" | "sem-acesso";

const FILTROS: { chave: Filtro; rotulo: string }[] = [
  { chave: "todas", rotulo: "Todas" },
  { chave: "atrasadas", rotulo: "Mês atrasado" },
  { chave: "sem-acesso", rotulo: "Sem acesso" },
];

export default async function AgenciaPage({
  searchParams,
}: {
  searchParams: { erro?: string; ok?: string; q?: string; filtro?: Filtro };
}) {
  const supabase = createClient();
  const { data: ehAgencia } = await supabase.rpc("is_agency");
  if (!ehAgencia) redirect("/");

  // Uma chamada. Antes eram treze por carregamento: orgs, memberships,
  // listUsers(1000) e um `modulos_configurados` por empresa, em série.
  const empresas = await carregarEmpresas();

  const busca = (searchParams.q ?? "").trim().toLowerCase();
  const filtro: Filtro = searchParams.filtro ?? "todas";

  const lista = empresas.filter((e) => {
    if (busca && !`${e.name} ${e.slug}`.toLowerCase().includes(busca))
      return false;
    if (filtro === "atrasadas") return mesAtrasado(e.ultimo_mes);
    if (filtro === "sem-acesso") return e.acessos === 0;
    return true;
  });

  const contagem = (f: Filtro) =>
    f === "atrasadas"
      ? empresas.filter((e) => mesAtrasado(e.ultimo_mes)).length
      : f === "sem-acesso"
        ? empresas.filter((e) => e.acessos === 0).length
        : empresas.length;

  return (
    <AgenciaShell
      secao="empresas"
      migalha={[{ rotulo: "Empresas" }]}
      titulo={`${empresas.length} ${empresas.length === 1 ? "empresa" : "empresas"}`}
      acoes={<DialogoNovaEmpresa />}
    >
      {searchParams.erro ? (
        <div className="mb-5">
          <Aviso tom="erro">{searchParams.erro}</Aviso>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        {/* Formulário GET: a busca fica na URL, então dá para recarregar e
            compartilhar o resultado. */}
        <form className="relative min-w-[200px] flex-1 sm:max-w-xs">
          {filtro !== "todas" ? (
            <input type="hidden" name="filtro" value={filtro} />
          ) : null}
          <label htmlFor="q" className="sr-only">
            Buscar empresa
          </label>
          <input
            id="q"
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder="Buscar empresa…"
            className="min-h-9 w-full rounded-md border border-line-strong bg-surface-1 px-3 py-1.5 text-sm outline-none transition placeholder:text-dim focus:border-brand"
          />
        </form>

        <div className="flex rounded-md border border-line bg-surface-1 p-0.5">
          {FILTROS.map((f) => {
            const params = new URLSearchParams();
            if (searchParams.q) params.set("q", searchParams.q);
            if (f.chave !== "todas") params.set("filtro", f.chave);
            const qs = params.toString();
            return (
              <Link
                key={f.chave}
                href={`/agencia${qs ? `?${qs}` : ""}`}
                className={`rounded px-2.5 py-1.5 text-xs font-semibold transition ${
                  filtro === f.chave
                    ? "bg-surface-3 text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {f.rotulo}
                <span className="ml-1.5 tabular text-dim">{contagem(f.chave)}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {lista.length === 0 ? (
        <Vazio
          titulo={
            busca
              ? `Nenhuma empresa com “${searchParams.q}”`
              : filtro === "atrasadas"
                ? "Nenhum fechamento atrasado"
                : filtro === "sem-acesso"
                  ? "Toda empresa tem alguém entrando no portal"
                  : "Nenhuma empresa cadastrada"
          }
          descricao={
            filtro === "todas" && !busca
              ? "Crie a primeira em “Nova empresa”."
              : undefined
          }
        />
      ) : (
        <TabelaEmpresas empresas={lista} />
      )}
    </AgenciaShell>
  );
}

/**
 * O formulário de nova empresa vivia aberto no topo da página, ocupando espaço
 * o ano inteiro para uma ação que acontece uma vez por cliente.
 */
function DialogoNovaEmpresa() {
  return (
    <Dialogo
      rotulo="+ Nova empresa"
      variante="primario"
      tamanho="sm"
      titulo="Nova empresa"
      descricao="O endereço é o que aparece no link da página de bio e no Fila de Espera."
    >
      <form action={criarOrg} className="space-y-3">
        <Campo rotulo="Nome" obrigatorio>
          <Entrada name="name" required placeholder="Ex.: BB Onça Burguers" autoFocus />
        </Campo>
        <Campo
          rotulo="Endereço"
          obrigatorio
          ajuda="Só letras minúsculas, números e hífen."
        >
          <Entrada
            name="slug"
            required
            pattern="[a-z0-9-]+"
            placeholder="bb-onca"
          />
        </Campo>
        <div className="flex justify-end pt-1">
          <BotaoEnviar pendente="Criando…">Criar empresa</BotaoEnviar>
        </div>
      </form>
    </Dialogo>
  );
}
