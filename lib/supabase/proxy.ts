import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { emailAutorizado } from "@/lib/acesso";
import { supabaseEnv } from "./env";

const ROTAS_PUBLICAS = ["/login", "/auth/"];

export async function atualizarSessao(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, chave } = supabaseEnv();

  const supabase = createServerClient(url, chave, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // Não colocar código entre a criação do cliente e getClaims (renovação do token).
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const caminho = request.nextUrl.pathname;
  const publica = ROTAS_PUBLICAS.some((r) => caminho.startsWith(r));

  const redirecionar = (destino: string) => {
    const alvo = request.nextUrl.clone();
    const [path, query] = destino.split("?");
    alvo.pathname = path;
    alvo.search = query ? `?${query}` : "";
    const r = NextResponse.redirect(alvo);
    response.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  if (!claims && !publica) return redirecionar("/login");

  if (claims && !emailAutorizado(claims.email as string | undefined)) {
    await supabase.auth.signOut();
    if (caminho !== "/login") return redirecionar("/login?erro=nao-autorizado");
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
