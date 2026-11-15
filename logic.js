'use strict';
// Regras de Minhas Horas: datas, períodos, semanas, saldo e backup.
// Tudo em minutos e no fuso do aparelho. Datas como 'AAAA-MM-DD', horas como 'HH:MM'.
(function (global) {
  const CHAVE = 'minhas-horas:v1';
  const FAIXA_FIM = 5 * 60;        // 00:00–05:00 é faixa proibida
  const DIA_MIN = 24 * 60;
  const LIMITE_ABERTO = 12 * 60;   // período aberto há mais de 12 h pede correção
  const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const INICIO_PADRAO = '2026-11-16';
  const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

  const pad = (n) => String(n).padStart(2, '0');

  // ---------- datas ----------
  function iso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function hojeIso(now = new Date()) { return iso(now); }
  function minDoDia(now = new Date()) { return now.getHours() * 60 + now.getMinutes(); }
  function paraData(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12, 0, 0); }
  function somaDias(s, n) { const d = paraData(s); d.setDate(d.getDate() + n); return iso(d); }
  function diaSemana(s) { return (paraData(s).getDay() + 6) % 7; } // 0 = segunda
  function segundaDe(s) { return somaDias(s, -diaSemana(s)); }
  function dm(s) { const [, m, d] = s.split('-'); return `${d}/${m}`; }
  function dma(s) { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; }
  function rotuloDia(s) { return `${DIAS[diaSemana(s)]} ${dm(s)}`; }
  function instante(data, min) { const [y, m, d] = data.split('-').map(Number); return new Date(y, m - 1, d, 0, min, 0, 0); }

  // ---------- horas ----------
  function hm(s) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(s || '');
    if (!m) return null;
    const h = +m[1], mi = +m[2];
    if (mi > 59 || h > 24 || (h === 24 && mi > 0)) return null;
    return h * 60 + mi;
  }
  function hmTexto(min) { return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`; }
  function inicioMin(p) { return hm(p.inicio); }
  // Término 00:00 (ou 24:00) quer dizer meia-noite, fim do dia.
  function fimMin(p) {
    if (p.fim == null || p.fim === '') return null;
    const v = hm(p.fim);
    return v === 0 ? DIA_MIN : v;
  }
  function normalizarFim(s) { if (!s) return null; return hm(s) === 0 ? '24:00' : s; }
  function fimTexto(p) { const f = fimMin(p); return f == null ? '…' : hmTexto(f); }

  // Aceita "15", "2,5", "2.5", "2:30", "2h30", "2 h 30", "45min".
  function parseHoras(s) {
    s = String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, '');
    let m;
    if ((m = /^(\d+)min$/.exec(s))) return +m[1];
    if ((m = /^(\d+)(?::|h)(\d{1,2})(?:min)?$/.exec(s))) { if (+m[2] > 59) return null; return +m[1] * 60 + +m[2]; }
    if ((m = /^(\d+(?:[.,]\d+)?)h?$/.exec(s))) return Math.round(parseFloat(m[1].replace(',', '.')) * 60);
    return null;
  }
  function fmtDur(min) {
    min = Math.round(Math.abs(min));
    const h = Math.floor(min / 60), m = min % 60;
    if (m === 0) return `${h} h`;
    if (h === 0) return `${m} min`;
    return `${h} h ${pad(m)}`;
  }
  function fmtSaldo(min) {
    min = Math.round(min);
    if (min === 0) return 'zerado';
    const a = Math.abs(min);
    if (min < 0) return `${fmtDur(a)} a repor`;
    if (a < 60) return `${fmtDur(a)} adiantados`;
    if (a === 60) return '1 h adiantada';
    return `${fmtDur(a)} adiantadas`;
  }

  // ---------- estado ----------
  function uid() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
  function estadoVazio(now = new Date()) {
    return {
      versao: 1,
      criadoEm: now.toISOString(),
      ultimoBackup: null,
      cotas: [{ id: uid(), desde: INICIO_PADRAO, minutos: 15 * 60 }],
      saldoInicial: { data: INICIO_PADRAO, minutos: 0, sentido: 'adiantadas' },
      ajustes: [],
      periodos: [],
    };
  }
  function sentidoOk(s) { return s === 'adiantadas' || s === 'repor'; }
  // Confere um objeto (do localStorage ou de um arquivo importado). Lança erro se não servir.
  function normalizar(o) {
    if (!o || typeof o !== 'object' || o.versao !== 1) throw new Error('Arquivo não é um backup do Minhas Horas.');
    if (!Array.isArray(o.cotas) || !Array.isArray(o.ajustes) || !Array.isArray(o.periodos) || !o.saldoInicial) throw new Error('Backup incompleto.');
    const num = (v) => Number.isFinite(v) && v >= 0;
    const cotas = o.cotas.map((c) => {
      if (!RE_DATA.test(c.desde) || !num(c.minutos)) throw new Error('Cota inválida no backup.');
      return { id: c.id || uid(), desde: c.desde, minutos: Math.round(c.minutos) };
    });
    if (!cotas.length) throw new Error('O backup não tem cota.');
    const si = o.saldoInicial;
    if (!RE_DATA.test(si.data) || !num(si.minutos) || !sentidoOk(si.sentido)) throw new Error('Saldo inicial inválido no backup.');
    const ajustes = o.ajustes.map((a) => {
      if (!RE_DATA.test(a.data) || !num(a.minutos) || !sentidoOk(a.sentido)) throw new Error('Ajuste inválido no backup.');
      return { id: a.id || uid(), data: a.data, minutos: Math.round(a.minutos), sentido: a.sentido, obs: String(a.obs || '') };
    });
    const periodos = o.periodos.map((p) => {
      if ((p.tipo !== 'feito' && p.tipo !== 'previsto') || !RE_DATA.test(p.data) || hm(p.inicio) == null) throw new Error('Período inválido no backup.');
      if (p.fim != null && p.fim !== '' && hm(p.fim) == null) throw new Error('Período inválido no backup.');
      const q = { id: p.id || uid(), tipo: p.tipo, data: p.data, inicio: p.inicio, fim: normalizarFim(p.fim), obs: String(p.obs || '') };
      if (p.feitoId) q.feitoId = p.feitoId;
      return q;
    });
    return {
      versao: 1,
      criadoEm: o.criadoEm || new Date().toISOString(),
      ultimoBackup: o.ultimoBackup || null,
      dicaIconeFechada: !!o.dicaIconeFechada,
      cotas, ajustes, periodos,
      saldoInicial: { data: si.data, minutos: Math.round(si.minutos), sentido: si.sentido },
    };
  }
  function carregar(now = new Date()) {
    let raw = null;
    try { raw = global.localStorage.getItem(CHAVE); } catch (e) { return { estado: estadoVazio(now), ok: false }; }
    if (!raw) return { estado: estadoVazio(now), ok: true };
    try { return { estado: normalizar(JSON.parse(raw)), ok: true }; } catch (e) {
      // Guarda o conteúdo estragado à parte, para não perder nada ao salvar por cima.
      try { global.localStorage.setItem(CHAVE + ':corrompido:' + Date.now(), raw); } catch (e2) { /* sem espaço */ }
      return { estado: estadoVazio(now), ok: false };
    }
  }
  function salvar(st) {
    try { global.localStorage.setItem(CHAVE, JSON.stringify(st)); return true; } catch (e) { return false; }
  }

  // ---------- períodos ----------
  function periodoAberto(st) { return st.periodos.find((p) => p.tipo === 'feito' && fimMin(p) == null) || null; }
  function fimEfetivo(p, now) {
    const f = fimMin(p);
    if (f != null) return f;
    const ini = inicioMin(p), hj = hojeIso(now);
    if (p.data === hj) return Math.max(ini, minDoDia(now));
    if (p.data < hj) return DIA_MIN;
    return ini;
  }
  function duracao(p, now = new Date()) {
    const ini = inicioMin(p);
    if (ini == null) return 0;
    return Math.max(0, fimEfetivo(p, now) - ini);
  }
  function nomeTipo(t) { return t === 'feito' ? 'Feito' : 'Previsto'; }

  // Devolve a mensagem de recusa, ou null se o período pode ser salvo.
  function validarPeriodo(p, periodos, now = new Date()) {
    if (!RE_DATA.test(p.data || '')) return 'Informe a data.';
    const ini = inicioMin(p);
    if (ini == null) return 'Informe o início.';
    if (ini < FAIXA_FIM) return 'Entre 00:00 e 05:00 não pode haver período.';
    const aberto = p.fim == null || p.fim === '';
    let fim = null;
    if (aberto) {
      if (p.tipo !== 'feito') return 'Informe o término.';
      if (periodos.some((q) => q.id !== p.id && q.tipo === 'feito' && fimMin(q) == null)) return 'Já existe um período aberto. Encerre-o antes.';
    } else {
      fim = fimMin(p);
      if (fim == null) return 'Informe o término.';
      if (fim < FAIXA_FIM) return 'Entre 00:00 e 05:00 não pode haver período. Para terminar à meia-noite, use 00:00.';
      if (fim <= ini) return 'O término precisa ser depois do início.';
    }
    if (p.tipo === 'feito') {
      if (aberto && instante(p.data, ini) > now) return 'O início não pode ser depois de agora.';
      if (!aberto && instante(p.data, fim) > now) return 'O Feito só pode terminar até agora. Para o futuro, use Previsto.';
    }
    const a1 = ini, b1 = aberto ? Math.max(ini + 1, fimEfetivo(p, now)) : fim;
    for (const q of periodos) {
      if (q.id === p.id || q.tipo !== p.tipo || q.data !== p.data) continue;
      const a2 = inicioMin(q);
      const b2 = fimMin(q) == null ? Math.max(a2 + 1, fimEfetivo(q, now)) : fimMin(q);
      if (a1 < b2 && a2 < b1) return `Sobrepõe outro ${nomeTipo(p.tipo)} (${q.inicio}–${fimTexto(q)}).`;
    }
    return null;
  }

  // Período aberto que entrou na faixa proibida ou passou de 12 h.
  function abertoEsquecido(p, now = new Date()) {
    if (!p || fimMin(p) != null) return false;
    const decorrido = (now - instante(p.data, inicioMin(p))) / 60000;
    if (decorrido > LIMITE_ABERTO) return true;
    const hj = hojeIso(now);
    if (hj === p.data) return false;
    if (hj === somaDias(p.data, 1) && minDoDia(now) === 0) return false; // 24:00 em ponto vale
    return true;
  }
  function fimAgora(p, now = new Date()) { return hojeIso(now) === p.data ? hmTexto(minDoDia(now)) : '24:00'; }
  function previstoPassou(p, now = new Date()) {
    const f = fimMin(p);
    return p.tipo === 'previsto' && f != null && instante(p.data, f) <= now;
  }

  // ---------- semanas e saldo ----------
  const sinal = (s) => (s === 'repor' ? -1 : 1);
  // A cota vale a partir da semana (segunda) que contém a data "a partir de".
  function cotaDaSemana(st, seg) {
    const ord = [...st.cotas].sort((a, b) => (a.desde < b.desde ? -1 : a.desde > b.desde ? 1 : 0));
    let c = null;
    for (const x of ord) if (segundaDe(x.desde) <= seg) c = x;
    return (c || ord[0] || { minutos: 0 }).minutos;
  }
  function periodosDaSemana(st, seg, tipo) {
    const fim = somaDias(seg, 6);
    return st.periodos.filter((p) => (!tipo || p.tipo === tipo) && p.data >= seg && p.data <= fim);
  }
  function totalSemana(st, seg, tipo, now) {
    return periodosDaSemana(st, seg, tipo).reduce((t, p) => t + duracao(p, now), 0);
  }
  function feitoContado(st, seg, now) {
    const D = st.saldoInicial.data;
    return periodosDaSemana(st, seg, 'feito').filter((p) => p.data >= D).reduce((t, p) => t + duracao(p, now), 0);
  }
  function ajustesDaSemana(st, seg) {
    const fim = somaDias(seg, 6), D = st.saldoInicial.data;
    let t = 0;
    for (const a of st.ajustes) if (a.data >= seg && a.data <= fim && a.data >= D) t += sinal(a.sentido) * a.minutos;
    return t;
  }
  // saldo: positivo = adiantadas. Inclui saldo inicial, semanas fechadas antes desta e ajustes até o fim desta.
  // Para semana futura, as semanas abertas no caminho são supostas fechando na meta (ou no feito, se maior).
  function semanaInfo(st, seg, now = new Date()) {
    const D = st.saldoInicial.data, seg0 = segundaDe(D), segAtual = segundaDe(hojeIso(now));
    const cota = cotaDaSemana(st, seg);
    const base = {
      seg, cota,
      feito: totalSemana(st, seg, 'feito', now),
      previsto: totalSemana(st, seg, 'previsto', now),
      fechada: seg < segAtual, atual: seg === segAtual, futura: seg > segAtual,
    };
    if (seg < seg0) return { ...base, antesDoInicio: true, saldo: 0, meta: cota, saldoDepois: null };
    let s = sinal(st.saldoInicial.sentido) * st.saldoInicial.minutos;
    for (let w = seg0; w < seg; w = somaDias(w, 7)) {
      s += ajustesDaSemana(st, w);
      const c = cotaDaSemana(st, w);
      let f = feitoContado(st, w, now);
      if (w >= segAtual) f = Math.max(f, Math.max(0, c - s));
      s += f - c;
    }
    s += ajustesDaSemana(st, seg);
    const meta = Math.max(0, cota - s);
    return { ...base, antesDoInicio: false, saldo: s, meta, saldoDepois: s + feitoContado(st, seg, now) - cota };
  }

  // ---------- textos e exportação ----------
  function textoPrevisao(st, seg) {
    const linhas = [`Previsão da semana ${dm(seg)} a ${dm(somaDias(seg, 6))}`];
    let total = 0;
    for (let i = 0; i < 7; i++) {
      const d = somaDias(seg, i);
      const ps = st.periodos.filter((p) => p.tipo === 'previsto' && p.data === d).sort((a, b) => inicioMin(a) - inicioMin(b));
      if (!ps.length) continue;
      ps.forEach((p) => { total += duracao(p); });
      linhas.push(`${rotuloDia(d)} · ${ps.map((p) => `${p.inicio}–${fimTexto(p)}`).join(' e ')}`);
    }
    linhas.push(`Total: ${fmtDur(total)}`);
    return linhas.join('\n');
  }
  function csv(st, now = new Date()) {
    const q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const linhas = [['Tipo', 'Data', 'Dia', 'Início', 'Término', 'Duração', 'Minutos', 'Sentido', 'Observação']];
    const ps = [...st.periodos].sort((a, b) => (a.data + a.inicio < b.data + b.inicio ? -1 : 1));
    for (const p of ps) {
      const d = duracao(p, now);
      linhas.push([nomeTipo(p.tipo), dma(p.data), DIAS[diaSemana(p.data)], p.inicio, fimTexto(p), hmTexto(d), d, '', p.obs]);
    }
    for (const a of [...st.ajustes].sort((x, y) => (x.data < y.data ? -1 : 1))) {
      linhas.push(['Ajuste', dma(a.data), DIAS[diaSemana(a.data)], '', '', hmTexto(a.minutos), sinal(a.sentido) * a.minutos, a.sentido === 'repor' ? 'a repor' : 'adiantadas', a.obs]);
    }
    return '﻿' + linhas.map((l) => l.map(q).join(',')).join('\r\n') + '\r\n';
  }

  global.MH = {
    CHAVE, FAIXA_FIM, DIA_MIN, LIMITE_ABERTO, DIAS, INICIO_PADRAO,
    pad, iso, hojeIso, minDoDia, somaDias, diaSemana, segundaDe, dm, dma, rotuloDia, instante,
    hm, hmTexto, inicioMin, fimMin, normalizarFim, fimTexto, parseHoras, fmtDur, fmtSaldo,
    uid, estadoVazio, normalizar, carregar, salvar,
    periodoAberto, duracao, nomeTipo, validarPeriodo, abertoEsquecido, fimAgora, previstoPassou,
    cotaDaSemana, periodosDaSemana, semanaInfo, textoPrevisao, csv,
  };
})(typeof window !== 'undefined' ? window : globalThis);
