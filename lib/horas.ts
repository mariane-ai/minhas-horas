// Cálculo de horas prestadas e saldo semanal. Funções puras (testadas em lib/horas.test.ts).

import { dataLocal } from "./tempo";

export type Local = "girassol" | "externo";

export interface Pausa {
  inicio: string;
  fim: string | null;
}

export interface SessaoParaCalculo {
  inicio: string;
  fim: string | null;
  local: Local | null;
  pausas: Pausa[];
}

const MS_MIN = 60_000;

/**
 * Milissegundos de horas prestadas: (fim − início) − pausas.
 * Sessão ou pausa aberta usa `agora` como fim provisório.
 * Pausas são recortadas ao intervalo da sessão, para nunca descontar além dele.
 */
export function msPrestados(sessao: SessaoParaCalculo, agora: Date = new Date()): number {
  const ini = new Date(sessao.inicio).getTime();
  const fim = sessao.fim ? new Date(sessao.fim).getTime() : agora.getTime();
  if (fim <= ini) return 0;

  let pausado = 0;
  for (const p of sessao.pausas) {
    const pi = Math.max(new Date(p.inicio).getTime(), ini);
    const pf = Math.min(p.fim ? new Date(p.fim).getTime() : agora.getTime(), fim);
    if (pf > pi) pausado += pf - pi;
  }
  return Math.max(0, fim - ini - pausado);
}

/** Minutos inteiros (arredondamento para baixo) — base de exibição e soma. */
export function minutosPrestados(sessao: SessaoParaCalculo, agora?: Date): number {
  return Math.floor(msPrestados(sessao, agora) / MS_MIN);
}

export function estaPausada(sessao: Pick<SessaoParaCalculo, "pausas">): boolean {
  return sessao.pausas.some((p) => p.fim === null);
}

/** Dia (em São Paulo) a que a sessão pertence: o dia em que começou. */
export function diaDaSessao(sessao: Pick<SessaoParaCalculo, "inicio">): string {
  return dataLocal(new Date(sessao.inicio));
}

export interface ResumoSemana {
  totalMin: number;
  girassolMin: number;
  externoMin: number;
  cargaMin: number | null;
  saldoMin: number | null;
}

/**
 * Totais da semana. Horas externas entram no total e no saldo
 * (decisão da Mariane, 13/11/2026), mas também aparecem em subtotal próprio.
 * Sem regra de contrato vigente, carga e saldo ficam nulos.
 */
export function resumirSemana(
  sessoes: SessaoParaCalculo[],
  cargaSemanalH: number | null,
): ResumoSemana {
  let girassolMin = 0;
  let externoMin = 0;
  for (const s of sessoes) {
    if (!s.fim) continue;
    const min = minutosPrestados(s);
    if (s.local === "externo") externoMin += min;
    else girassolMin += min;
  }
  const totalMin = girassolMin + externoMin;
  const cargaMin = cargaSemanalH === null ? null : Math.round(cargaSemanalH * 60);
  return {
    totalMin,
    girassolMin,
    externoMin,
    cargaMin,
    saldoMin: cargaMin === null ? null : totalMin - cargaMin,
  };
}

/** "3h05", "0h40". */
export function formatarDuracao(minutos: number): string {
  const m = Math.abs(Math.trunc(minutos));
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}

/** Saldo com sinal: "+1h20", "−2h05", "0h00". */
export function formatarSaldo(minutos: number): string {
  if (minutos === 0) return "0h00";
  return `${minutos > 0 ? "+" : "−"}${formatarDuracao(minutos)}`;
}

/** Cronômetro "01:23:45" a partir de milissegundos. */
export function formatarCronometro(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}
