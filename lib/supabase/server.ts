import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { emailAutorizado } from "@/lib/acesso";
import { supabaseEnv } from "./env";

export async function criarClienteServidor() {
  const { url, chave } = supabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(url, chave, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chamado a partir de Server Component: o proxy renova os cookies.
        }
      },
    },
  });
}

/**
 * Cliente Supabase com usuária autenticada e autorizada.
 * Redireciona para /login caso contrário. O RLS no banco é a proteção definitiva.
 */
export async function exigirUsuaria() {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");
  if (!emailAutorizado(claims.email as string | undefined)) {
    await supabase.auth.signOut();
    redirect("/login?erro=nao-autorizado");
  }
  return { supabase, userId: claims.sub as string, email: claims.email as string };
}
