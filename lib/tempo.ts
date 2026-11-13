// Utilitários de data no fuso America/Sao_Paulo. Semana de segunda a domingo.
// Datas "de calendário" circulam como string ISO "AAAA-MM-DD".

export const FUSO = "America/Sao_Paulo";

/** Hora atual do servidor, enviada ao cronômetro do cliente. */
export function agoraMs(): number {
  return Date.now();
}

const partesFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function partesNoFuso(instante: Date) {
  const p: Record<string, number> = {};
  for (const { type, value } of partesFmt.formatToParts(instante)) {
    if (type !== "literal") p[type] = Number(value);
  }
  return p as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Data de calendário (AAAA-MM-DD) em São Paulo para um instante. */
export function dataLocal(instante: Date): string {
  const { year, month, day } = partesNoFuso(instante);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Instante UTC correspondente à 00:00 da data informada em São Paulo. */
export function inicioDoDiaUtc(data: string): Date {
  const [a, m, d] = data.split("-").map(Number);
  const palpite = Date.UTC(a, m - 1, d);
  // Diferença entre o relógio local e o UTC naquele instante (corrige o fuso).
  const p = partesNoFuso(new Date(palpite));
  const comoLocal = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const deslocamento = comoLocal - palpite;
  return new Date(palpite - deslocamento);
}

/** Soma dias a uma data de calendário. */
export function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d + dias));
  return t.toISOString().slice(0, 10);
}

/** Segunda-feira da semana que contém a data informada. */
export function segundaDaSemana(data: string): string {
  const [a, m, d] = data.split("-").map(Number);
  const diaSemana = new Date(Date.UTC(a, m - 1, d)).getUTCDay(); // 0 = domingo
  const voltar = (diaSemana + 6) % 7;
  return somarDias(data, -voltar);
}

export function ehDataValida(valor: unknown): valor is string {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [a, m, d] = valor.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  return t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

const fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
const fmtDiaSemana = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
});
const fmtDiaCurto = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });

export function formatarHora(instante: Date | string): string {
  return fmtHora.format(new Date(instante));
}

/** "segunda-feira, 10/11" a partir de AAAA-MM-DD. */
export function formatarDiaSemana(data: string): string {
  return fmtDiaSemana.format(new Date(`${data}T00:00:00Z`));
}

/** "10/11" a partir de AAAA-MM-DD. */
export function formatarDiaCurto(data: string): string {
  return fmtDiaCurto.format(new Date(`${data}T00:00:00Z`));
}
