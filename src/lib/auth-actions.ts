"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Origem pública desta requisição — usada nos links que a Supabase manda por email. */
function baseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

function back(path: string, erro: string): never {
  redirect(`${path}?erro=${encodeURIComponent(erro)}`);
}

export async function entrar(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");

  if (!email || !senha) back("/login", "Preencha email e senha.");

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) back("/login", "Email ou senha incorretos.");

  revalidatePath("/", "layout");
  redirect("/");
}

export async function sair() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function pedirRecuperacao(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const supabase = createClient();

  // Sem checar o resultado de propósito: responder igual para email existente e
  // inexistente evita revelar quem tem conta.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${baseUrl()}/auth/callback?proximo=/nova-senha`,
  });

  redirect("/esqueci-senha?ok=1");
}

export async function definirSenha(formData: FormData) {
  const senha = String(formData.get("senha") ?? "");
  if (senha.length < 8) back("/nova-senha", "A senha precisa de 8 caracteres ou mais.");

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password: senha });

  if (error) back("/nova-senha", "O link expirou. Peça a recuperação de novo.");

  revalidatePath("/", "layout");
  redirect("/");
}
