import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PainelLeads } from "@/components/agencia/painel-leads";
import type { Lead } from "@/lib/leads";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leads" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string };
}) {
  const supabase = createClient();
  const { data: ehAgencia } = await supabase.rpc("is_agency");
  if (!ehAgencia) redirect("/");

  const { data, error } = await supabase
    .from("lp_leads")
    .select(
      "id, nome, whatsapp, faturamento, status, valor_mensal, created_at, lp_lead_eventos(id, evento, valor, enviado_em, erro)",
    )
    .order("created_at", { ascending: false });

  return (
    <PainelLeads
      leads={(data ?? []) as Lead[]}
      erro={Boolean(error)}
      searchParams={searchParams}
      agora={Date.now()}
    />
  );
}
