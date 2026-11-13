import { NextResponse, type NextRequest } from "next/server";
import { emailAutorizado } from "@/lib/acesso";
import { criarClienteServidor } from "@/lib/supabase/server";

// Retorno do login com Google: troca o código pela sessão e confere a lista de e-mails.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/login?erro=falha`);

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?erro=falha`);

  if (!emailAutorizado(data.user?.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?erro=nao-autorizado`);
  }
  return NextResponse.redirect(`${origin}/`);
}
