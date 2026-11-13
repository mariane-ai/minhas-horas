import { describe, expect, it } from "vitest";
import {
  diaDaSessao,
  estaPausada,
  formatarCronometro,
  formatarDuracao,
  formatarSaldo,
  minutosPrestados,
  resumirSemana,
  type SessaoParaCalculo,
} from "./horas";
import { dataLocal, ehDataValida, inicioDoDiaUtc, segundaDaSemana, somarDias } from "./tempo";

// São Paulo = UTC−3 (sem horário de verão desde 2019).
const s = (inicio: string, fim: string | null, extra: Partial<SessaoParaCalculo> = {}): SessaoParaCalculo => ({
  inicio,
  fim,
  local: "girassol",
  pausas: [],
  ...extra,
});

describe("minutosPrestados", () => {
  it("conta a duração simples", () => {
    expect(minutosPrestados(s("2026-11-10T12:00:00Z", "2026-11-10T15:30:00Z"))).toBe(210);
  });

  it("desconta pausas fechadas", () => {
    const sessao = s("2026-11-10T12:00:00Z", "2026-11-10T16:00:00Z", {
      pausas: [
        { inicio: "2026-11-10T13:00:00Z", fim: "2026-11-10T13:45:00Z" },
        { inicio: "2026-11-10T15:00:00Z", fim: "2026-11-10T15:10:00Z" },
      ],
    });
    expect(minutosPrestados(sessao)).toBe(240 - 45 - 10);
  });

  it("usa agora para sessão e pausa abertas", () => {
    const sessao = s("2026-11-10T12:00:00Z", null, {
      pausas: [{ inicio: "2026-11-10T13:00:00Z", fim: null }],
    });
    expect(minutosPrestados(sessao, new Date("2026-11-10T14:00:00Z"))).toBe(60);
    expect(estaPausada(sessao)).toBe(true);
  });

  it("recorta pausa que extrapola a sessão", () => {
    const sessao = s("2026-11-10T12:00:00Z", "2026-11-10T13:00:00Z", {
      pausas: [{ inicio: "2026-11-10T12:30:00Z", fim: "2026-11-10T14:00:00Z" }],
    });
    expect(minutosPrestados(sessao)).toBe(30);
  });

  it("nunca é negativo", () => {
    expect(minutosPrestados(s("2026-11-10T12:00:00Z", "2026-11-10T11:00:00Z"))).toBe(0);
  });
});

describe("dia e semana em São Paulo", () => {
  it("sessão que começa 23h de domingo (SP) pertence ao domingo, mesmo terminando na segunda", () => {
    // 2026-11-15 é domingo. 23:00 SP = 02:00Z do dia 16.
    const sessao = s("2026-11-16T02:00:00Z", "2026-11-16T04:00:00Z");
    expect(diaDaSessao(sessao)).toBe("2026-11-15");
    expect(segundaDaSemana(diaDaSessao(sessao))).toBe("2026-11-09");
  });

  it("segunda-feira da semana", () => {
    expect(segundaDaSemana("2026-11-13")).toBe("2026-11-09"); // sexta
    expect(segundaDaSemana("2026-11-09")).toBe("2026-11-09"); // segunda
    expect(segundaDaSemana("2026-11-15")).toBe("2026-11-09"); // domingo
    expect(segundaDaSemana("2027-01-01")).toBe("2026-12-28"); // virada de ano
  });

  it("início do dia em SP em UTC", () => {
    expect(inicioDoDiaUtc("2026-11-09").toISOString()).toBe("2026-11-09T03:00:00.000Z");
  });

  it("data local de um instante UTC", () => {
    expect(dataLocal(new Date("2026-11-10T02:59:00Z"))).toBe("2026-11-09");
    expect(dataLocal(new Date("2026-11-10T03:00:00Z"))).toBe("2026-11-10");
  });

  it("soma dias e valida datas", () => {
    expect(somarDias("2026-11-09", 7)).toBe("2026-11-16");
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
    expect(ehDataValida("2026-02-30")).toBe(false);
    expect(ehDataValida("2026-11-09")).toBe(true);
    expect(ehDataValida("09/11/2026")).toBe(false);
  });
});

describe("resumirSemana", () => {
  const sessoes = [
    s("2026-11-10T12:00:00Z", "2026-11-10T18:00:00Z"), // 6h girassol
    s("2026-11-11T12:00:00Z", "2026-11-11T14:30:00Z", { local: "externo" }), // 2h30 externo
    s("2026-11-12T12:00:00Z", null), // aberta: não conta
  ];

  it("soma girassol + externo no total e calcula saldo contra a carga", () => {
    expect(resumirSemana(sessoes, 18)).toEqual({
      totalMin: 510,
      girassolMin: 360,
      externoMin: 150,
      cargaMin: 1080,
      saldoMin: 510 - 1080,
    });
  });

  it("sem regra vigente, carga e saldo ficam nulos", () => {
    const r = resumirSemana(sessoes, null);
    expect(r.cargaMin).toBeNull();
    expect(r.saldoMin).toBeNull();
    expect(r.totalMin).toBe(510);
  });
});

describe("formatação", () => {
  it("duração e saldo", () => {
    expect(formatarDuracao(65)).toBe("1h05");
    expect(formatarDuracao(0)).toBe("0h00");
    expect(formatarSaldo(80)).toBe("+1h20");
    expect(formatarSaldo(-125)).toBe("−2h05");
    expect(formatarSaldo(0)).toBe("0h00");
  });

  it("cronômetro", () => {
    expect(formatarCronometro(3_723_000)).toBe("01:02:03");
    expect(formatarCronometro(-5)).toBe("00:00:00");
  });
});
