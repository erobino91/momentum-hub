import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AgenciaShell } from "@/components/shell";
import { AbasEmpresa } from "@/components/agencia/abas";
import { Numero } from "@/components/agencia/numero";
import {
  DialogoContrato,
  DialogoReajuste,
} from "@/components/agencia/contrato-dialogos";
import {
  Aviso,
  Cartao,
  ConfirmarAcao,
  Selo,
  Tabela,
  Vazio,
  numEstilo,
  tdEstilo,
  thEstilo,
} from "@/components/ui";
import { mesCurto } from "@/lib/agencia";
import { nomeDoMes } from "@/lib/periodos";
import {
  dataCurta,
  estadoCobranca,
  hojeISO,
  reais,
  rotuloEstado,
  rotuloForma,
  SITUACOES,
  type LinhaFinanceiro,
} from "@/lib/financeiro";
import type { BillingCharge, BillingContract, BillingValue } from "@/types/db";
import type { Org } from "@/types/db";
import { removerValor } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Financeiro da empresa" };

/**
 * O contrato de uma empresa e a história dele.
 *
 * Três blocos, na ordem em que as perguntas aparecem: quanto e quando ela paga,
 * como esse valor chegou onde está, e o que já foi cobrado.
 */
export default async function FinanceiroDaEmpresaPage({
  params,
  searchParams,
}: {
  params: { org: string };
  searchParams: { erro?: string; ok?: string };
}) {
  const supabase = createClient();
  const { data: ehAgencia } = await supabase.rpc("is_agency");
  if (!ehAgencia) redirect("/");

  const { data: org } = await supabase
    .from("orgs")
    .select("id,name,slug")
    .eq("id", params.org)
    .maybeSingle<Pick<Org, "id" | "name" | "slug">>();
  if (!org) redirect("/agencia");

  const { data: contrato } = await supabase
    .from("billing_contracts")
    .select("*")
    .eq("org_id", org.id)
    .maybeSingle<BillingContract>();

  const [{ data: valores }, { data: cobrancas }] = await Promise.all([
    contrato
      ? supabase
          .from("billing_values")
          .select("*")
          .eq("contract_id", contrato.id)
          .order("vigente_desde", { ascending: false })
          .returns<BillingValue[]>()
      : Promise.resolve({ data: [] as BillingValue[] }),
    supabase
      .from("billing_charges")
      .select("*")
      .eq("org_id", org.id)
      .order("competencia", { ascending: false })
      .limit(12)
      .returns<BillingCharge[]>(),
  ]);

  const hoje = hojeISO();
  const lista = valores ?? [];
  const historico = cobrancas ?? [];

  // O valor vigente é a primeira linha com vigência já começada — a lista vem
  // em ordem decrescente, então é só achar a primeira que não está no futuro.
  const vigente = lista.find((v) => v.vigente_desde <= hoje) ?? null;
  const futuro = lista.filter((v) => v.vigente_desde > hoje);

  const pagas = historico.filter((c) => c.status === "pago");
  const recebido = pagas.reduce((t, c) => t + Number(c.valor), 0);

  return (
    <AgenciaShell
      secao="empresas"
      migalha={[
        { rotulo: "Empresas", href: "/agencia" },
        { rotulo: org.name, href: `/agencia/${org.id}` },
        { rotulo: "Financeiro" },
      ]}
      titulo={org.name}
      selo={
        contrato ? (
          <Selo tom={contrato.situacao === "ativo" ? "pronto" : "atencao"}>
            {contrato.situacao}
          </Selo>
        ) : (
          <Selo tom="atencao">sem contrato</Selo>
        )
      }
      acoes={
        contrato ? (
          <DialogoContrato org={org} contrato={contrato} temValor={!!vigente} />
        ) : null
      }
    >
      <AbasEmpresa orgId={org.id} ativa="financeiro" />

      {searchParams.erro ? (
        <div className="mb-5">
          <Aviso tom="erro">{searchParams.erro}</Aviso>
        </div>
      ) : null}

      {!contrato ? (
        <Vazio
          titulo="Esta empresa ainda não tem contrato"
          descricao="Sem contrato ela não entra na geração de cobranças do mês, e aparece como pendência no financeiro."
          acao={<DialogoContrato org={org} contrato={null} temValor={false} />}
        />
      ) : (
        <>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Numero
              rotulo="Mensalidade"
              valor={reais(vigente?.valor ?? null)}
              alerta={vigente ? undefined : "nenhum valor registrado"}
            />
            <Numero
              rotulo="Vencimento"
              valor={`dia ${contrato.dia_vencimento}`}
              alerta={
                contrato.dia_vencimento > 28
                  ? "vira o último dia em fevereiro"
                  : undefined
              }
            />
            <Numero
              rotulo="Cliente desde"
              valor={
                contrato.cliente_desde ? mesCurto(contrato.cliente_desde) : "—"
              }
            />
            <Numero
              rotulo="Recebido (12 meses)"
              valor={reais(recebido)}
              tom={pagas.length ? "bom" : "neutro"}
              alerta={
                pagas.length
                  ? `${pagas.length} ${pagas.length === 1 ? "pagamento" : "pagamentos"}`
                  : undefined
              }
            />
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <Cartao
              titulo="Valor e reajustes"
              descricao="Cada mudança de preço é uma linha com a data em que passou a valer."
              acao={
                <DialogoReajuste
                  orgId={org.id}
                  contratoId={contrato.id}
                  atual={vigente?.valor ?? null}
                />
              }
            >
              {lista.length === 0 ? (
                <p className="text-sm text-muted">
                  Nenhum valor registrado — sem ele, a empresa não entra na
                  geração de cobranças.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {lista.map((v) => {
                    const eVigente = v.id === vigente?.id;
                    return (
                      <li
                        key={v.id}
                        className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-3 py-2"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="whitespace-nowrap text-sm font-semibold tabular">
                            {reais(v.valor)}
                          </span>
                          {eVigente ? (
                            <Selo tom="pronto" ponto={false}>
                              vigente
                            </Selo>
                          ) : v.vigente_desde > hoje ? (
                            <Selo tom="atencao" ponto={false}>
                              a partir de {dataCurta(v.vigente_desde)}
                            </Selo>
                          ) : null}
                        </span>
                        <span className="flex flex-none items-center gap-2">
                          <span className="whitespace-nowrap text-xs tabular text-dim">
                            desde {dataCurta(v.vigente_desde)}
                          </span>
                          <ConfirmarAcao
                            acao={removerValor}
                            rotulo="Apagar"
                            titulo="Apagar este valor?"
                            descricao={
                              <>
                                Serve para corrigir digitação. As cobranças já
                                geradas <strong>não mudam</strong> — o valor
                                delas foi copiado na geração, não fica apontando
                                para aqui.
                              </>
                            }
                            confirmar="Apagar valor"
                          >
                            <input type="hidden" name="org_id" value={org.id} />
                            <input type="hidden" name="id" value={v.id} />
                          </ConfirmarAcao>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              {futuro.length > 0 ? (
                <p className="mt-3 text-xs text-dim">
                  Reajuste agendado não muda mês nenhum até a data chegar: as
                  cobranças geradas antes dela continuam com o valor antigo.
                </p>
              ) : null}
            </Cartao>

            <Cartao titulo="Combinado">
              <dl className="space-y-2.5 text-sm">
                <Item rotulo="Situação">
                  {SITUACOES.find((s) => s.valor === contrato.situacao)
                    ?.rotulo ?? contrato.situacao}
                  {contrato.situacao !== "ativo" ? (
                    <span className="ml-2 text-xs text-dim">
                      não entra na geração do mês
                    </span>
                  ) : null}
                </Item>
                <Item rotulo="Forma de pagamento">
                  {rotuloForma(contrato.forma_pagamento)}
                </Item>
                <Item rotulo="Cliente desde">
                  {dataCurta(contrato.cliente_desde)}
                </Item>
                <Item rotulo="Observação">
                  {contrato.observacao ? (
                    <span className="whitespace-pre-line">
                      {contrato.observacao}
                    </span>
                  ) : (
                    <span className="text-dim">—</span>
                  )}
                </Item>
              </dl>
            </Cartao>
          </div>

          <Cartao
            className="mt-3"
            titulo="Cobranças"
            descricao="Os últimos doze meses. O valor de cada uma é o preço da época, não o de hoje."
          >
            {historico.length === 0 ? (
              <p className="text-sm text-muted">
                Nenhuma cobrança gerada ainda. A geração acontece em Financeiro,
                pelo mês.
              </p>
            ) : (
              <Tabela>
                <thead>
                  <tr>
                    <th className={thEstilo}>Mês</th>
                    <th className={`${thEstilo} ${numEstilo}`}>Vencimento</th>
                    <th className={`${thEstilo} ${numEstilo}`}>Valor</th>
                    <th className={thEstilo}>Situação</th>
                    <th className={`${thEstilo} ${numEstilo}`}>Pago em</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((c) => {
                    // A mesma leitura da lista geral: uma linha de cobrança
                    // vira uma linha de financeiro só com o que o estado usa.
                    const comoLinha = {
                      contrato_id: contrato.id,
                      cobranca_id: c.id,
                      status: c.status,
                      vencimento: c.vencimento,
                    } as LinhaFinanceiro;
                    const estado = estadoCobranca(comoLinha, hoje);
                    return (
                      <tr key={c.id}>
                        <td className={tdEstilo}>{nomeDoMes(c.competencia)}</td>
                        <td className={`${tdEstilo} ${numEstilo}`}>
                          {dataCurta(c.vencimento)}
                        </td>
                        <td className={`${tdEstilo} ${numEstilo}`}>
                          {reais(c.valor)}
                        </td>
                        <td className={tdEstilo}>
                          <Selo
                            tom={
                              estado === "pago"
                                ? "pronto"
                                : estado === "atrasado"
                                  ? "erro"
                                  : estado === "pendente"
                                    ? "atencao"
                                    : "neutro"
                            }
                          >
                            {rotuloEstado(estado)}
                          </Selo>
                        </td>
                        <td className={`${tdEstilo} ${numEstilo}`}>
                          {dataCurta(c.pago_em)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Tabela>
            )}
          </Cartao>
        </>
      )}
    </AgenciaShell>
  );
}

function Item({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line pb-2.5 last:border-0 last:pb-0">
      <dt className="flex-none text-xs font-semibold text-dim">{rotulo}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}
