import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AgenciaShell } from "@/components/shell";
import { AbasEmpresa } from "@/components/agencia/abas";
import { Cartao, Selo, Tabela, Vazio, tdEstilo, thEstilo } from "@/components/ui";
import { NovoAcesso } from "../../novo-acesso";
import { carregarAcessos } from "@/lib/agencia";
import type { Org } from "@/types/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Acessos" };

/**
 * Quem entra no portal desta empresa.
 *
 * Os emails vêm de `agencia_acessos()`, uma função `security definer` que lê
 * `auth.users`. Antes a página trazia a base inteira de usuários com
 * `listUsers(1000)` da Admin API para descobrir dois ou três endereços.
 */
export default async function AcessosPage({
  params,
}: {
  params: { org: string };
}) {
  const supabase = createClient();
  const { data: ehAgencia } = await supabase.rpc("is_agency");
  if (!ehAgencia) redirect("/");

  const { data: org } = await supabase
    .from("orgs")
    .select("id, name")
    .eq("id", params.org)
    .maybeSingle<Pick<Org, "id" | "name">>();
  if (!org) redirect("/agencia");

  const acessos = await carregarAcessos(org.id);

  return (
    <AgenciaShell
      secao="empresas"
      migalha={[
        { rotulo: "Empresas", href: "/agencia" },
        { rotulo: org.name, href: `/agencia/${org.id}` },
        { rotulo: "Acessos" },
      ]}
      titulo="Acessos ao portal"
    >
      <AbasEmpresa orgId={org.id} ativa="acessos" />

      {acessos.length === 0 ? (
        <Vazio
          titulo="Ninguém desta empresa entra no portal ainda"
          descricao="Crie o acesso do dono abaixo. A conta nasce pronta e você entrega email e senha."
        />
      ) : (
        <Tabela>
          <thead>
            <tr>
              <th className={thEstilo}>Email</th>
              <th className={thEstilo}>Papel</th>
              <th className={thEstilo}>Desde</th>
              <th className={thEstilo}>Último acesso</th>
            </tr>
          </thead>
          <tbody>
            {acessos.map((a) => (
              <tr key={a.user_id} className="transition hover:bg-surface-1">
                <td className={`${tdEstilo} font-medium`}>{a.email}</td>
                <td className={tdEstilo}>
                  <Selo tom={a.role === "agency" ? "pronto" : "neutro"} ponto={false}>
                    {a.role}
                  </Selo>
                </td>
                <td className={`${tdEstilo} text-muted`}>{data(a.desde)}</td>
                <td className={tdEstilo}>
                  {a.ultimo_acesso ? (
                    <span className="text-muted">{data(a.ultimo_acesso)}</span>
                  ) : (
                    // Conta criada e nunca usada é o caso que fez o autocadastro
                    // ser aposentado: acesso existe e o cliente não entrou.
                    <span className="text-warn">nunca entrou</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      )}

      <div className="mt-5">
        <Cartao
          titulo="Dar acesso ao portal"
          descricao="Se o email já tiver conta, ela só passa a enxergar esta empresa."
        >
          <NovoAcesso orgId={org.id} />
        </Cartao>
      </div>
    </AgenciaShell>
  );
}

function data(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}
