import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clienteSecreto } from "@/lib/supabase/secreto";
import type { LinkButton, LinkPage } from "@/types/bio";
import { EditorBio } from "./editor";
import { VisaoCliente } from "./visao-cliente";

export const metadata = { title: "Editor da bio" };

export const dynamic = "force-dynamic";

export default async function EditorPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { erro?: string };
}) {
  const supabase = createClient();

  // A RLS filtra: página de outra org simplesmente não vem.
  const { data: pagina } = await supabase
    .from("link_pages")
    .select("*")
    .eq("id", params.id)
    .maybeSingle<LinkPage>();
  if (!pagina) redirect("/bio");

  const { data: botoes } = await supabase
    .from("link_buttons")
    .select("*")
    .eq("page_id", pagina.id)
    .order("position")
    .returns<LinkButton[]>();

  // Quem monta a bio é a agência; o cliente acompanha. A RLS já barra a
  // escrita, isto decide qual tela mostrar.
  const { data: ehAgencia } = await supabase.rpc("is_agency");
  if (!ehAgencia) {
    return <VisaoCliente pagina={pagina} botoes={botoes ?? []} />;
  }

  // Só a existência do token — o valor nunca sai do servidor.
  const { data: segredo } = await clienteSecreto()
    .from("link_secrets")
    .select("page_id")
    .eq("page_id", pagina.id)
    .maybeSingle<{ page_id: string }>();

  return (
    <EditorBio
      pagina={pagina}
      botoes={botoes ?? []}
      temToken={!!segredo}
      erro={searchParams.erro}
    />
  );
}
