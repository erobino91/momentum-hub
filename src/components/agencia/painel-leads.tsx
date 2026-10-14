import Link from "next/link";
import { AgenciaShell } from "@/components/shell";
import { Numero } from "@/components/agencia/numero";
import { TabelaLeads } from "@/components/agencia/tabela-leads";
import { Aviso, Vazio } from "@/components/ui";
import { reais } from "@/lib/numero";
import { haQuanto, ehStatusLead, type Lead, type StatusLead } from "@/lib/leads";

type Filtro = "todos" | StatusLead;

const FILTROS: { chave: Filtro; rotulo: string }[] = [
  { chave: "todos", rotulo: "Todos" },
  { chave: "novo", rotulo: "Novos" },
  { chave: "conversando", rotulo: "Em conversa" },
  { chave: "proposta", rotulo: "Propostas" },
  { chave: "sem_resposta", rotulo: "Não responderam" },
  { chave: "cliente", rotulo: "Clientes" },
  { chave: "descartado", rotulo: "Descartados" },
];

const VAZIO: Record<Filtro, string> = {
  todos: "Nenhum lead ainda",
  novo: "Ninguém esperando contato",
  conversando: "Nenhuma conversa em andamento",
  proposta: "Nenhuma proposta em aberto",
  sem_resposta: "Todo mundo respondeu",
  cliente: "Nenhum lead virou cliente ainda",
  descartado: "Nenhum lead descartado",
};

/**
 * Os leads do formulário da LP da agência.
 *
 * O número que importa é "aguardando contato", não o total: a tela existe para
 * ninguém ficar sem resposta. Filtro e busca ficam na URL (formulário GET),
 * como no financeiro — recarregar e voltar caem na mesma lista.
 */
export function PainelLeads({
  leads,
  erro,
  searchParams,
  agora,
}: {
  leads: Lead[];
  erro: boolean;
  searchParams: { status?: string; q?: string };
  agora: number;
}) {
  const filtro: Filtro = ehStatusLead(searchParams.status)
    ? searchParams.status
    : "todos";
  const busca = (searchParams.q ?? "").trim().toLowerCase();
  const digitos = busca.replace(/\D/g, "");

  const lista = leads.filter((l) => {
    if (filtro !== "todos" && l.status !== filtro) return false;
    if (!busca) return true;
    return (
      l.nome.toLowerCase().includes(busca) ||
      (digitos.length > 0 && l.whatsapp.includes(digitos))
    );
  });

  const contagem = (f: Filtro) =>
    f === "todos" ? leads.length : leads.filter((l) => l.status === f).length;

  // Os números do topo saem das mesmas linhas — nenhuma consulta a mais.
  const novos = leads.filter((l) => l.status === "novo");
  const maisAntigo = novos[novos.length - 1];
  const semana = leads.filter(
    (l) =>
      l.status !== "descartado" &&
      agora - new Date(l.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000,
  ).length;
  const clientes = leads.filter((l) => l.status === "cliente");
  const mensal = clientes.reduce((t, l) => t + Number(l.valor_mensal ?? 0), 0);

  const hrefFiltro = (f: Filtro) => {
    const params = new URLSearchParams();
    if (f !== "todos") params.set("status", f);
    if (searchParams.q) params.set("q", searchParams.q);
    const qs = params.toString();
    return qs ? `/agencia/leads?${qs}` : "/agencia/leads";
  };

  return (
    <AgenciaShell
      secao="leads"
      migalha={[{ rotulo: "Leads" }]}
      titulo={`${leads.length} ${leads.length === 1 ? "lead" : "leads"}`}
    >
      {erro ? (
        <div className="mb-5">
          <Aviso tom="erro">Não foi possível carregar os leads.</Aviso>
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Numero
          rotulo="Aguardando contato"
          valor={String(novos.length)}
          tom={novos.length ? "alerta" : "neutro"}
          alerta={
            maisAntigo
              ? `o mais antigo espera ${haQuanto(maisAntigo.created_at, agora)}`
              : undefined
          }
        />
        <Numero rotulo="Últimos 7 dias" valor={String(semana)} />
        <Numero rotulo="Propostas abertas" valor={String(contagem("proposta"))} />
        <Numero
          rotulo="Viraram cliente"
          valor={
            clientes.length
              ? `${clientes.length} · ${reais(mensal)}/mês`
              : "0"
          }
          tom={clientes.length ? "bom" : "neutro"}
        />
      </div>

      <div className="mb-4 mt-5 flex flex-wrap items-center gap-2.5">
        <form className="relative min-w-[180px] flex-1 sm:max-w-xs">
          {filtro !== "todos" ? (
            <input type="hidden" name="status" value={filtro} />
          ) : null}
          <label htmlFor="q" className="sr-only">
            Buscar lead
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={searchParams.q ?? ""}
            placeholder="Buscar nome ou telefone…"
            className="min-h-11 w-full rounded-md border border-line-strong bg-surface-1 px-3 py-1.5 text-base outline-none transition placeholder:text-dim focus:border-brand sm:min-h-9 sm:text-sm"
          />
        </form>

        <div className="flex max-w-full overflow-x-auto rounded-md border border-line bg-surface-1 p-0.5">
          {FILTROS.map((f) => (
            <Link
              key={f.chave}
              href={hrefFiltro(f.chave)}
              aria-current={filtro === f.chave ? "page" : undefined}
              className={`whitespace-nowrap rounded px-2.5 py-1.5 text-xs font-semibold transition ${
                filtro === f.chave
                  ? "bg-surface-3 text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {f.rotulo}
              <span className="ml-1.5 tabular text-dim">{contagem(f.chave)}</span>
            </Link>
          ))}
        </div>
      </div>

      {lista.length === 0 ? (
        <Vazio
          titulo={busca ? `Nenhum lead com “${searchParams.q}”` : VAZIO[filtro]}
          descricao={
            busca
              ? "Busque pelo nome ou pelos números do telefone."
              : filtro === "todos"
                ? "Os contatos do formulário da landing page aparecem aqui assim que chegam."
                : undefined
          }
        />
      ) : (
        <TabelaLeads leads={lista} agora={agora} />
      )}
    </AgenciaShell>
  );
}
