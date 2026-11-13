import Link from "next/link";
import { buscarRegraVigente, buscarSessoesDaSemana, type SessaoDaSemana } from "@/lib/dados";
import { diaDaSessao, formatarDuracao, formatarSaldo, minutosPrestados, resumirSemana } from "@/lib/horas";
import { exigirUsuaria } from "@/lib/supabase/server";
import {
  dataLocal,
  ehDataValida,
  formatarDiaCurto,
  formatarDiaSemana,
  formatarHora,
  segundaDaSemana,
  somarDias,
} from "@/lib/tempo";

export default async function Semana({ searchParams }: PageProps<"/semana">) {
  const { supabase } = await exigirUsuaria();
  const { s } = await searchParams;

  const segundaAtual = segundaDaSemana(dataLocal(new Date()));
  const segunda = ehDataValida(s) ? segundaDaSemana(s) : segundaAtual;
  const domingo = somarDias(segunda, 6);
  const ehAtual = segunda === segundaAtual;

  const [sessoes, regra] = await Promise.all([
    buscarSessoesDaSemana(supabase, segunda),
    // Carga da semana = regra vigente na segunda-feira.
    buscarRegraVigente(supabase, segunda),
  ]);
  const resumo = resumirSemana(sessoes, regra?.carga_semanal_h ?? null);

  const porDia = new Map<string, SessaoDaSemana[]>();
  for (const sessao of sessoes) {
    const dia = diaDaSessao(sessao);
    porDia.set(dia, [...(porDia.get(dia) ?? []), sessao]);
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 pb-8 pt-4">
      <nav className="flex items-center justify-between" aria-label="Navegar entre semanas">
        <Link href={`/semana?s=${somarDias(segunda, -7)}`} className="rounded-xl px-3 py-2 text-2xl" aria-label="Semana anterior">
          ‹
        </Link>
        <div className="text-center">
          <h1 className="text-lg font-bold">{ehAtual ? "Esta semana" : "Semana"}</h1>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            {formatarDiaCurto(segunda)} a {formatarDiaCurto(domingo)}
          </p>
        </div>
        {ehAtual ? (
          <span className="w-11" />
        ) : (
          <Link href={`/semana?s=${somarDias(segunda, 7)}`} className="rounded-xl px-3 py-2 text-2xl" aria-label="Próxima semana">
            ›
          </Link>
        )}
      </nav>

      <section className="mt-4 rounded-2xl bg-stone-100 p-4 dark:bg-stone-900" aria-label="Resumo da semana">
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div>
            <dt className="text-xs text-stone-600 dark:text-stone-400">Horas prestadas</dt>
            <dd className="text-xl font-bold tabular-nums">{formatarDuracao(resumo.totalMin)}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-600 dark:text-stone-400">Carga de referência</dt>
            <dd className="text-xl font-bold tabular-nums">
              {resumo.cargaMin === null ? "—" : formatarDuracao(resumo.cargaMin)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-stone-600 dark:text-stone-400">Saldo</dt>
            <dd
              className={`text-xl font-bold tabular-nums ${
                resumo.saldoMin === null
                  ? ""
                  : resumo.saldoMin >= 0
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-amber-700 dark:text-amber-400"
              }`}
            >
              {resumo.saldoMin === null ? "—" : formatarSaldo(resumo.saldoMin)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 border-t border-stone-200 pt-3 text-center text-xs text-stone-600 dark:border-stone-800 dark:text-stone-400">
          No Girassol {formatarDuracao(resumo.girassolMin)} · Externo {formatarDuracao(resumo.externoMin)}
        </p>
        {resumo.cargaMin === null && (
          <p className="mt-2 text-center text-xs text-amber-800 dark:text-amber-300">
            Sem regra de contrato vigente nesta semana — cadastre em regras_contrato.
          </p>
        )}
        {ehAtual && (
          <p className="mt-2 text-center text-xs text-stone-500">Sessão em andamento entra no total ao ser encerrada.</p>
        )}
      </section>

      {sessoes.length === 0 ? (
        <p className="mt-10 text-center text-stone-600 dark:text-stone-400">Nenhuma sessão encerrada nesta semana.</p>
      ) : (
        <ol className="mt-6 space-y-6">
          {[...porDia.entries()].map(([dia, lista]) => (
            <li key={dia}>
              <h2 className="flex items-baseline justify-between text-sm font-semibold capitalize text-stone-700 dark:text-stone-300">
                <span>{formatarDiaSemana(dia)}</span>
                <span className="tabular-nums normal-case">
                  {formatarDuracao(lista.reduce((t, x) => t + minutosPrestados(x), 0))}
                </span>
              </h2>
              <ul className="mt-2 divide-y divide-stone-200 rounded-2xl border border-stone-200 dark:divide-stone-800 dark:border-stone-800">
                {lista.map((x) => (
                  <li key={x.id} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">{x.frente}</span>
                      <span className="font-semibold tabular-nums">{formatarDuracao(minutosPrestados(x))}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-stone-600 dark:text-stone-400">
                      <span className="tabular-nums">
                        {formatarHora(x.inicio)}–{formatarHora(x.fim)}
                      </span>
                      <span>·</span>
                      <span>{x.local === "girassol" ? "No Girassol" : "Externo"}</span>
                      {x.pausas.length > 0 && (
                        <>
                          <span>·</span>
                          <span>
                            {x.pausas.length} {x.pausas.length === 1 ? "pausa" : "pausas"}
                          </span>
                        </>
                      )}
                    </div>
                    {x.observacao && (
                      <details className="mt-1 text-sm">
                        <summary className="cursor-pointer text-stone-500">Observação</summary>
                        <p className="mt-1 whitespace-pre-wrap text-stone-700 dark:text-stone-300">{x.observacao}</p>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
