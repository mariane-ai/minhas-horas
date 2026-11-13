"use client";

import { useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase/client";

export function BotaoGoogle() {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar() {
    setCarregando(true);
    setErro(null);
    const { error } = await criarClienteNavegador().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setErro("Não foi possível abrir o login do Google. Tente de novo.");
      setCarregando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={entrar}
        disabled={carregando}
        className="w-full rounded-2xl bg-stone-900 px-6 py-4 text-lg font-semibold text-white active:scale-[0.99] disabled:opacity-60 dark:bg-amber-400 dark:text-stone-950"
      >
        {carregando ? "Abrindo o Google…" : "Entrar com Google"}
      </button>
      {erro && <p className="mt-3 text-sm text-red-700 dark:text-red-400">{erro}</p>}
    </>
  );
}
