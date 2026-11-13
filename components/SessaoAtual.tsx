"use client";

import { useEffect, useState, useTransition } from "react";
import { iniciarSessao, pausarSessao, retomarSessao, type Resultado } from "@/app/actions";
import { estaPausada, formatarCronometro, msPrestados } from "@/lib/horas";
import type { Frente, SessaoAberta } from "@/lib/dados";
import { formatarHora } from "@/lib/tempo";
import { FormEncerrar } from "./FormEncerrar";

interface Props {
  sessao: SessaoAberta | null;
  frentes: Frente[];
  agoraServidor: number;
}

export function SessaoAtual({ sessao, frentes, agoraServidor }: Props) {
  const [agora, setAgora] = useState(agoraServidor);
  const [pendente, iniciarTransicao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  // Guarda o id da sessão sendo encerrada, para o formulário não reabrir na próxima.
  const [encerrandoId, setEncerrandoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Relógio baseado na hora do servidor, para não depender do relógio do aparelho.
  useEffect(() => {
    const base = Date.now();
    const id = setInterval(() => setAgora(agoraServidor + (Date.now() - base)), 1000);
    return () => clearInterval(id);
  }, [agoraServidor]);

  function executar(acao: () => Promise<Resultado>) {
    setErro(null);
    setAviso(null);
    iniciarTransicao(async () => {
      try {
        const r = await acao();
        if (r.erro) setErro(r.erro);
      } catch {
        setErro("Sem conexão. Nada foi registrado; tente de novo.");
      }
    });
  }

  if (!sessao) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        {aviso && (
          <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
            {aviso}
          </p>
        )}
        <p className="text-stone-600 dark:text-stone-400">Nenhuma sessão em andamento.</p>
        <button
          type="button"
          disabled={pendente}
          onClick={() => executar(iniciarSessao)}
          className="aspect-square w-56 rounded-full bg-amber-400 text-2xl font-bold text-stone-950 shadow-lg active:scale-[0.98] disabled:opacity-60"
        >
          {pendente ? "Iniciando…" : "Iniciar sessão"}
        </button>
        {erro && <Erro texto={erro} />}
      </section>
    );
  }

  const pausada = estaPausada(sessao);
  const ms = msPrestados({ ...sessao, fim: null, local: null }, new Date(agora));

  return (
    <section className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
            pausada
              ? "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300"
              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
          }`}
        >
          {pausada ? "Pausada" : "Em andamento"}
        </span>
        <p className="font-mono text-6xl font-semibold tabular-nums" aria-live="off">
          {formatarCronometro(ms)}
        </p>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Horas prestadas · início às {formatarHora(sessao.inicio)}
          {sessao.pausas.length > 0 &&
            ` · ${sessao.pausas.length} ${sessao.pausas.length === 1 ? "pausa" : "pausas"}`}
        </p>
      </div>

      {erro && <Erro texto={erro} />}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={pendente}
          onClick={() => executar(() => (pausada ? retomarSessao(sessao.id) : pausarSessao(sessao.id)))}
          className="rounded-2xl border-2 border-stone-300 px-4 py-5 text-lg font-semibold active:scale-[0.99] disabled:opacity-60 dark:border-stone-700"
        >
          {pausada ? "Retomar" : "Pausar"}
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={() => setEncerrandoId(sessao.id)}
          className="rounded-2xl bg-stone-900 px-4 py-5 text-lg font-semibold text-white active:scale-[0.99] disabled:opacity-60 dark:bg-stone-100 dark:text-stone-950"
        >
          Encerrar
        </button>
      </div>

      {encerrandoId === sessao.id && (
        <FormEncerrar
          sessaoId={sessao.id}
          frentes={frentes}
          onCancelar={() => setEncerrandoId(null)}
          onEncerrada={() => {
            setEncerrandoId(null);
            setAviso("Sessão encerrada e registrada.");
          }}
        />
      )}
    </section>
  );
}

function Erro({ texto }: { texto: string }) {
  return (
    <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
      {texto}
    </p>
  );
}
