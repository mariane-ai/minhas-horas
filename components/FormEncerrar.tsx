"use client";

import { useActionState } from "react";
import { encerrarSessao, type Resultado } from "@/app/actions";
import type { Frente } from "@/lib/dados";

interface Props {
  sessaoId: string;
  frentes: Frente[];
  onCancelar: () => void;
  onEncerrada: () => void;
}

export function FormEncerrar({ sessaoId, frentes, onCancelar, onEncerrada }: Props) {
  // O aviso é disparado dentro da própria ação: quando a sessão encerra, este
  // formulário desmonta junto com a atualização da página.
  const [estado, acao, pendente] = useActionState<Resultado, FormData>(async (anterior, form) => {
    const r: Resultado = await encerrarSessao(anterior, form).catch(() => ({
      erro: "Sem conexão. Nada foi registrado; tente de novo.",
    }));
    if (r.ok) onEncerrada();
    return r;
  }, {});

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40" role="dialog" aria-modal="true" aria-labelledby="titulo-encerrar">
      <form
        action={acao}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-xl dark:bg-stone-900"
      >
        <input type="hidden" name="sessao_id" value={sessaoId} />
        <h2 id="titulo-encerrar" className="text-xl font-bold">
          Encerrar sessão
        </h2>

        <fieldset className="mt-5">
          <legend className="text-sm font-semibold">Frente</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {frentes.map((f) => (
              <label key={f.id} className="cursor-pointer">
                <input type="radio" name="frente_id" value={f.id} required className="peer sr-only" />
                <span className="flex min-h-12 items-center rounded-xl border-2 border-stone-200 px-3 py-2 text-sm leading-tight peer-checked:border-amber-500 peer-checked:bg-amber-50 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500 dark:border-stone-700 dark:peer-checked:bg-amber-950">
                  {f.nome}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <legend className="text-sm font-semibold">Local</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                ["girassol", "No Girassol"],
                ["externo", "Externo"],
              ] as const
            ).map(([valor, rotulo]) => (
              <label key={valor} className="cursor-pointer">
                <input type="radio" name="local" value={valor} required className="peer sr-only" />
                <span className="flex min-h-12 items-center justify-center rounded-xl border-2 border-stone-200 px-3 py-2 text-sm font-medium peer-checked:border-amber-500 peer-checked:bg-amber-50 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500 dark:border-stone-700 dark:peer-checked:bg-amber-950">
                  {rotulo}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-5">
          <label htmlFor="observacao" className="text-sm font-semibold">
            Observação <span className="font-normal text-stone-500">(opcional)</span>
          </label>
          <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Não registre nomes nem dados de colaboradores
          </p>
          <textarea
            id="observacao"
            name="observacao"
            rows={3}
            maxLength={1000}
            className="mt-2 w-full rounded-xl border-2 border-stone-200 bg-transparent px-3 py-2 text-base focus:border-amber-500 focus:outline-none dark:border-stone-700"
          />
        </div>

        {estado.erro && (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
            {estado.erro}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancelar}
            disabled={pendente}
            className="rounded-2xl border-2 border-stone-300 px-4 py-4 font-semibold disabled:opacity-60 dark:border-stone-700"
          >
            Voltar
          </button>
          <button
            type="submit"
            disabled={pendente}
            className="rounded-2xl bg-stone-900 px-4 py-4 font-semibold text-white disabled:opacity-60 dark:bg-stone-100 dark:text-stone-950"
          >
            {pendente ? "Salvando…" : "Encerrar"}
          </button>
        </div>
      </form>
    </div>
  );
}
