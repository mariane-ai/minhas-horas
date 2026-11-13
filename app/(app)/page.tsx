import Link from "next/link";
import { SessaoAtual } from "@/components/SessaoAtual";
import { buscarFrentesAtivas, buscarSessaoAberta } from "@/lib/dados";
import { exigirUsuaria } from "@/lib/supabase/server";
import { agoraMs } from "@/lib/tempo";

export default async function Inicio() {
  const { supabase } = await exigirUsuaria();
  const [sessao, frentes] = await Promise.all([
    buscarSessaoAberta(supabase),
    buscarFrentesAtivas(supabase),
  ]);
  const agoraServidor = agoraMs();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-8 pt-6">
      <SessaoAtual sessao={sessao} frentes={frentes} agoraServidor={agoraServidor} />
      <Link
        href="/semana"
        className="mt-8 text-center text-sm font-medium text-stone-600 underline underline-offset-4 dark:text-stone-400"
      >
        Ver sessões da semana
      </Link>
    </main>
  );
}
