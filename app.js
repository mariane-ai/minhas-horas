'use strict';
// Interface de Minhas Horas. Regras ficam em logic.js (window.MH).
(function () {
  const M = window.MH;
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const agora = () => new Date();

  let st;
  let armazenamentoOk = true;
  let promptInstalar = null;
  const ui = { tela: 'hoje', semHoje: null, semPrev: null };

  // ---------- estado ----------
  function iniciar() {
    const r = M.carregar();
    st = r.estado;
    armazenamentoOk = r.ok;
    if (!r.ok) M.salvar(st);
  }
  function persistir() {
    armazenamentoOk = M.salvar(st);
    renderAvisos();
  }

  // ---------- avisos e toast ----------
  let toastTimer = null;
  function toast(msg, tipo = '') {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'mostra ' + tipo;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = ''; }, tipo === 'alerta' ? 7000 : 3500);
  }
  function diasDesde(isoStr) { return Math.floor((agora() - new Date(isoStr)) / 86400000); }
  function standalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  }
  function renderAvisos() {
    const partes = [];
    if (!armazenamentoOk) partes.push('<div class="faixa erro">Não foi possível salvar no aparelho. Exporte um backup em Ajustes.</div>');
    const ref = st.ultimoBackup || st.criadoEm;
    const dias = diasDesde(ref);
    if (dias > 7) {
      const txt = st.ultimoBackup ? `Último backup há ${dias} dias.` : 'Nenhum backup feito ainda.';
      partes.push(`<div class="faixa backup">${txt} <button type="button" data-act="exp-json">Fazer backup</button></div>`);
    }
    if (!standalone() && !st.dicaIconeFechada) {
      const botao = promptInstalar ? '<button type="button" data-act="instalar">Instalar</button>' : '';
      partes.push(`<div class="faixa dica">Use pelo ícone na tela inicial (menu ⋮ do Chrome → Adicionar à tela inicial). ${botao}<button type="button" class="x" data-act="fechar-dica" aria-label="Fechar dica">×</button></div>`);
    }
    $('#avisos').innerHTML = partes.join('');
  }

  // ---------- peças comuns ----------
  function itemHtml(p, now, { editar = true } = {}) {
    const dur = M.duracao(p, now);
    const aberto = M.fimMin(p) == null;
    let extra = '';
    if (p.tipo === 'previsto' && M.previstoPassou(p, now)) {
      const feito = p.feitoId && st.periodos.some((q) => q.id === p.feitoId);
      extra = feito ? '<span class="ok">✓ Feito</span>' : `<button type="button" class="btn fiz" data-act="fiz" data-id="${p.id}">Fiz assim</button>`;
    }
    const acoes = editar
      ? `<button type="button" class="lnk" data-act="editar" data-id="${p.id}">Editar</button><button type="button" class="lnk perigo" data-act="excluir" data-id="${p.id}">Excluir</button>`
      : '';
    return `<li class="item ${p.tipo}${aberto ? ' aberto' : ''}" data-id="${p.id}">
      <div class="item-l1"><span class="tag ${p.tipo}">${M.nomeTipo(p.tipo)}</span>
        <span class="horas">${p.inicio}–${aberto ? 'agora' : M.fimTexto(p)}</span>
        <span class="dur">${M.fmtDur(dur)}</span></div>
      ${p.obs ? `<div class="obs">${esc(p.obs)}</div>` : ''}
      <div class="item-acoes">${extra}${acoes}</div>
    </li>`;
  }
  function ordenar(ps) { return [...ps].sort((a, b) => (a.data === b.data ? M.inicioMin(a) - M.inicioMin(b) : a.data < b.data ? -1 : 1)); }
  function tituloSemana(seg) { return `${M.dm(seg)} a ${M.dm(M.somaDias(seg, 6))}`; }

  function placarHtml(info, modo) {
    const segAtual = M.segundaDe(M.hojeIso());
    const principal = modo === 'hoje' ? info.feito : info.previsto;
    const max = Math.max(info.meta, info.feito, info.previsto, 1);
    const pct = (v) => Math.min(100, (v / max) * 100).toFixed(1);
    const metaPct = pct(info.meta);
    const desabAnt = modo === 'previsao' && info.seg <= segAtual;
    const desabProx = modo === 'hoje' && info.seg >= segAtual;
    let composicao = '';
    if (!info.antesDoInicio && Math.round(info.saldo) !== 0) {
      composicao = info.saldo > 0
        ? ` = cota ${M.fmtDur(info.cota)} − ${M.fmtDur(info.saldo)} adiantadas`
        : ` = cota ${M.fmtDur(info.cota)} + ${M.fmtDur(-info.saldo)} a repor`;
    }
    const linhas = [];
    if (modo === 'hoje') linhas.push(`<p>Previsto <strong>${M.fmtDur(info.previsto)}</strong></p>`);
    linhas.push(`<p>Meta da semana <strong>${M.fmtDur(info.meta)}</strong><span class="mini">${composicao}</span></p>`);
    const dif = principal - info.meta;
    if (dif > 0) linhas.push(`<p class="passou">Passou da meta em ${M.fmtDur(dif)}.</p>`);
    else if (info.atual && modo === 'hoje' && dif < 0) linhas.push(`<p class="mini">Faltam ${M.fmtDur(-dif)}.</p>`);
    else if (modo === 'previsao' && dif < 0) linhas.push(`<p class="mini">Faltam ${M.fmtDur(-dif)} para a meta.</p>`);
    else if (modo === 'previsao' && dif === 0 && info.meta > 0) linhas.push('<p class="mini">Bate com a meta.</p>');
    if (info.atual) linhas.push(`<p class="saldo">Saldo: <strong>${M.fmtSaldo(info.saldo)}</strong></p>`);
    else if (info.fechada && !info.antesDoInicio) linhas.push(`<p class="saldo">Semana fechada. Saldo ao fim: <strong>${M.fmtSaldo(info.saldoDepois)}</strong></p>`);
    else if (info.futura) linhas.push('<p class="mini">Meta estimada, supondo que as semanas até lá fechem na meta.</p>');
    if (info.antesDoInicio) linhas.push('<p class="mini">Semana anterior ao saldo inicial; não entra no saldo.</p>');
    return `<section class="placar" id="placar">
      <div class="sem-nav">
        <button type="button" data-act="sem" data-dir="-1" aria-label="Semana anterior" ${desabAnt ? 'disabled' : ''}>‹</button>
        <span class="sem-titulo">Semana ${tituloSemana(info.seg)}</span>
        <button type="button" data-act="sem" data-dir="1" aria-label="Próxima semana" ${desabProx ? 'disabled' : ''}>›</button>
      </div>
      <p class="placar-num">${modo === 'hoje' ? 'Feito' : 'Previsto'} <strong>${M.fmtDur(principal)}</strong> de ${M.fmtDur(info.meta)}</p>
      <div class="barra" role="img" aria-label="${M.fmtDur(principal)} de ${M.fmtDur(info.meta)}">
        ${modo === 'hoje' ? `<div class="barra-prev" style="width:${pct(info.previsto)}%"></div>` : ''}
        <div class="barra-feito ${modo}" style="width:${pct(principal)}%"></div>
        <div class="barra-meta" style="left:${metaPct}%"></div>
      </div>
      ${linhas.join('')}
    </section>`;
  }

  // ---------- tela Hoje ----------
  function renderHoje() {
    const now = agora();
    const hj = M.hojeIso(now);
    const segAtual = M.segundaDe(hj);
    const seg = ui.semHoje || segAtual;
    const info = M.semanaInfo(st, seg, now);
    const aberto = M.periodoAberto(st);
    const hhmm = M.hmTexto(M.minDoDia(now));
    let html = placarHtml(info, 'hoje');

    if (info.atual) {
      if (aberto) {
        const quando = aberto.data !== hj ? `${M.rotuloDia(aberto.data)} ` : '';
        html += `<section class="acao">
          <p class="aberto-info">Aberto desde ${quando}${aberto.inicio} · <span id="aberto-tempo">${M.fmtDur(M.duracao(aberto, now))}</span></p>
          <button type="button" class="grande parar" data-act="encerrar">Encerrar agora</button></section>`;
      } else {
        html += '<section class="acao"><button type="button" class="grande" data-act="comecar">Começar agora</button></section>';
      }
      html += `<section class="card"><h2>Lançar Feito</h2>
        <form id="f-feito" novalidate>
          <label>Data<input type="date" name="data" value="${hj}" max="${hj}" required></label>
          <div class="dois">
            <label>Início<input type="time" name="inicio" value="${hhmm}" required></label>
            <label>Término<input type="time" name="fim" value="${hhmm}" required></label>
          </div>
          <label>Observação<input type="text" name="obs" maxlength="200" autocomplete="off"></label>
          <p class="erro" role="alert"></p>
          <button type="submit" class="btn primario">Salvar</button>
        </form></section>`;
      const prevHoje = ordenar(st.periodos.filter((p) => p.tipo === 'previsto' && p.data === hj));
      html += `<section class="card"><h2>Previsto para hoje</h2>
        ${prevHoje.length ? `<ul class="lista">${prevHoje.map((p) => itemHtml(p, now, { editar: false })).join('')}</ul>` : '<p class="vazio">Nada previsto para hoje.</p>'}
      </section>`;
    }

    const ps = M.periodosDaSemana(st, seg);
    let lista = '';
    for (let i = 0; i < 7; i++) {
      const d = M.somaDias(seg, i);
      const doDia = ordenar(ps.filter((p) => p.data === d));
      if (!doDia.length) continue;
      lista += `<div class="dia"><h3>${M.rotuloDia(d)}${d === hj ? ' · hoje' : ''}</h3><ul class="lista">${doDia.map((p) => itemHtml(p, now)).join('')}</ul></div>`;
    }
    html += `<section class="card" id="semana"><h2>Semana ${tituloSemana(seg)}</h2>${lista || '<p class="vazio">Nenhum lançamento nesta semana.</p>'}</section>`;
    $('#tela').innerHTML = html;
  }

  // ---------- tela Previsão ----------
  function renderPrevisao() {
    const now = agora();
    const segAtual = M.segundaDe(M.hojeIso(now));
    if (!ui.semPrev || ui.semPrev < segAtual) ui.semPrev = M.somaDias(segAtual, 7);
    const seg = ui.semPrev;
    const info = M.semanaInfo(st, seg, now);
    let dias = '';
    for (let i = 0; i < 7; i++) {
      const d = M.somaDias(seg, i);
      const doDia = ordenar(st.periodos.filter((p) => p.tipo === 'previsto' && p.data === d));
      dias += `<div class="dia"><div class="dia-cab"><h3>${M.rotuloDia(d)}</h3>
        <button type="button" class="lnk" data-act="add-prev" data-data="${d}">+ Adicionar</button></div>
        ${doDia.length ? `<ul class="lista">${doDia.map((p) => itemHtml(p, now)).join('')}</ul>` : ''}</div>`;
    }
    const texto = M.textoPrevisao(st, seg);
    $('#tela').innerHTML = placarHtml(info, 'previsao')
      + `<section class="card"><h2>Montar a semana</h2>${dias}</section>
      <section class="card"><h2>Texto para enviar</h2>
        <pre id="texto-prev">${esc(texto)}</pre>
        <div class="botoes">
          <button type="button" class="btn primario" data-act="enviar">Enviar</button>
          <button type="button" class="btn" data-act="copiar">Copiar</button>
        </div></section>`;
  }

  // ---------- tela Ajustes ----------
  function renderAjustes() {
    const now = agora();
    const segAtual = M.segundaDe(M.hojeIso(now));
    const info = M.semanaInfo(st, segAtual, now);
    const cotas = [...st.cotas].sort((a, b) => (a.desde < b.desde ? -1 : 1));
    const si = st.saldoInicial;
    const ajustes = [...st.ajustes].sort((a, b) => (a.data > b.data ? -1 : 1));
    const ultimo = st.ultimoBackup ? `${M.dma(M.hojeIso(new Date(st.ultimoBackup)))} (há ${diasDesde(st.ultimoBackup)} dias)` : 'nenhum';
    $('#tela').innerHTML = `
      <section class="card"><h2>Saldo</h2>
        <p class="grande-txt">${M.fmtSaldo(info.saldo) === 'zerado' ? 'Saldo zerado' : M.fmtSaldo(info.saldo)}</p>
        <p class="mini">Saldo inicial + semanas fechadas + ajustes. Meta desta semana: ${M.fmtDur(info.meta)}.</p>
      </section>

      <section class="card"><h2>Cota</h2>
        <ul class="lista">${cotas.map((c) => `<li class="item"><div class="item-l1"><span class="horas">${M.fmtDur(c.minutos)} por semana</span></div>
          <div class="obs">a partir da semana de ${M.dma(M.segundaDe(c.desde))}</div>
          <div class="item-acoes">${cotas.length > 1 ? `<button type="button" class="lnk perigo" data-act="exc-cota" data-id="${c.id}">Excluir</button>` : ''}</div></li>`).join('')}</ul>
        <form id="f-cota" novalidate>
          <p class="mini">Nova cota. Vale a partir da semana da data escolhida; semanas anteriores não mudam.</p>
          <div class="dois">
            <label>A partir de<input type="date" name="desde" value="${M.somaDias(segAtual, 7)}" required></label>
            <label>Horas por semana<input type="text" name="horas" inputmode="decimal" placeholder="15" required></label>
          </div>
          <p class="erro" role="alert"></p>
          <button type="submit" class="btn">Adicionar cota</button>
        </form></section>

      <section class="card"><h2>Saldo inicial</h2>
        <form id="f-saldo" novalidate>
          <div class="dois">
            <label>Data de início<input type="date" name="data" value="${si.data}" required></label>
            <label>Horas<input type="text" name="horas" inputmode="decimal" value="${si.minutos ? M.fmtDur(si.minutos).replace(' h ', ':').replace(' h', '') : '0'}" required></label>
          </div>
          <fieldset class="sentido"><legend>Sentido</legend>
            <label><input type="radio" name="sentido" value="adiantadas" ${si.sentido !== 'repor' ? 'checked' : ''}> Adiantadas</label>
            <label><input type="radio" name="sentido" value="repor" ${si.sentido === 'repor' ? 'checked' : ''}> A repor</label>
          </fieldset>
          <p class="mini">De preferência uma segunda-feira. Feitos antes desta data não entram no saldo.</p>
          <p class="erro" role="alert"></p>
          <button type="submit" class="btn">Salvar saldo inicial</button>
        </form></section>

      <section class="card"><h2>Ajustes</h2>
        <p class="mini">Acordo para abater ou zerar o saldo, semana de férias etc.</p>
        ${ajustes.length ? `<ul class="lista">${ajustes.map((a) => `<li class="item"><div class="item-l1"><span class="tag ajuste">${M.rotuloDia(a.data)}</span>
          <span class="horas">${M.fmtDur(a.minutos)} ${a.sentido === 'repor' ? 'a repor' : 'adiantadas'}</span></div>
          ${a.obs ? `<div class="obs">${esc(a.obs)}</div>` : ''}
          <div class="item-acoes"><button type="button" class="lnk perigo" data-act="exc-ajuste" data-id="${a.id}">Excluir</button></div></li>`).join('')}</ul>` : ''}
        <form id="f-ajuste" novalidate>
          <div class="dois">
            <label>Data<input type="date" name="data" value="${M.hojeIso(now)}" required></label>
            <label>Horas<input type="text" name="horas" inputmode="decimal" placeholder="2 ou 1:30" required></label>
          </div>
          <fieldset class="sentido"><legend>Sentido</legend>
            <label><input type="radio" name="sentido" value="adiantadas" checked> Adiantadas</label>
            <label><input type="radio" name="sentido" value="repor"> A repor</label>
          </fieldset>
          <label>Observação<input type="text" name="obs" maxlength="200" autocomplete="off"></label>
          <p class="erro" role="alert"></p>
          <button type="submit" class="btn">Adicionar ajuste</button>
        </form></section>

      <section class="card"><h2>Backup</h2>
        <p>Os dados ficam só neste celular. Limpar o Chrome ou trocar de aparelho apaga tudo: exporte toda semana.</p>
        <p class="mini">Último backup: ${ultimo}.</p>
        <div class="botoes">
          <button type="button" class="btn primario" data-act="exp-json">Exportar JSON</button>
          <button type="button" class="btn" data-act="exp-csv">Exportar CSV</button>
        </div>
        <label class="btn arquivo">Importar JSON<input type="file" id="imp-json" accept="application/json,.json"></label>
        <p class="mini">O JSON serve para restaurar. O CSV abre no Planilhas Google.</p>
      </section>`;
  }

  // ---------- render geral ----------
  function render() {
    renderAvisos();
    document.querySelectorAll('.abas a').forEach((a) => a.classList.toggle('ativa', a.dataset.aba === ui.tela));
    if (ui.tela === 'previsao') renderPrevisao();
    else if (ui.tela === 'ajustes') renderAjustes();
    else renderHoje();
  }
  function rota() {
    const h = (location.hash || '#hoje').slice(1);
    ui.tela = ['hoje', 'previsao', 'ajustes'].includes(h) ? h : 'hoje';
    if (ui.tela === 'hoje') ui.semHoje = null; // a aba Hoje sempre volta para a semana atual
    render();
    window.scrollTo(0, 0);
  }

  // ---------- diálogos ----------
  function confirmar(msg, sim = 'Excluir') {
    const d = $('#dlg-confirma');
    d.innerHTML = `<form method="dialog"><p>${esc(msg)}</p><div class="botoes">
      <button value="nao" class="btn">Cancelar</button><button value="sim" class="btn perigo">${esc(sim)}</button></div></form>`;
    return new Promise((res) => {
      d.addEventListener('close', () => res(d.returnValue === 'sim'), { once: true });
      d.returnValue = '';
      d.showModal();
    });
  }

  // Formulário de período em diálogo: editar, novo previsto, "Fiz assim".
  function dialogoPeriodo({ p, titulo, origemPrevisto = null, novo = false }) {
    const d = $('#dlg');
    const fimVal = p.fim ? (M.fimMin(p) === M.DIA_MIN ? '00:00' : p.fim) : '';
    const podeAberto = p.tipo === 'feito' && !p.fim && !novo;
    d.innerHTML = `<form id="f-periodo" novalidate>
      <h2>${esc(titulo)}</h2>
      <label>Tipo<select name="tipo" ${origemPrevisto || novo ? 'disabled' : ''}>
        <option value="feito" ${p.tipo === 'feito' ? 'selected' : ''}>Feito</option>
        <option value="previsto" ${p.tipo === 'previsto' ? 'selected' : ''}>Previsto</option></select></label>
      <label>Data<input type="date" name="data" value="${p.data}" required></label>
      <div class="dois">
        <label>Início<input type="time" name="inicio" value="${p.inicio || ''}" required></label>
        <label>Término<input type="time" name="fim" value="${fimVal}"></label>
      </div>
      <p class="mini">Término 00:00 = meia-noite.${podeAberto ? ' Deixe vazio para manter aberto.' : ''}</p>
      <label>Observação<input type="text" name="obs" maxlength="200" value="${esc(p.obs || '')}" autocomplete="off"></label>
      <p class="erro" role="alert"></p>
      <div class="botoes"><button type="button" class="btn" data-act="fechar-dlg">Cancelar</button>
        <button type="submit" class="btn primario">Salvar</button></div>
    </form>`;
    const f = $('#f-periodo', d);
    f.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const fd = new FormData(f);
      const q = {
        id: novo || origemPrevisto ? M.uid() : p.id,
        tipo: origemPrevisto ? 'feito' : novo ? p.tipo : fd.get('tipo'),
        data: fd.get('data'),
        inicio: fd.get('inicio'),
        fim: M.normalizarFim(fd.get('fim')),
        obs: String(fd.get('obs') || '').trim(),
      };
      if (!novo && !origemPrevisto && p.feitoId) q.feitoId = p.feitoId;
      if (q.tipo !== 'feito' && q.fim == null) { $('.erro', f).textContent = 'Informe o término.'; return; }
      if (q.fim == null && !podeAberto) { $('.erro', f).textContent = 'Informe o término.'; return; }
      const erro = M.validarPeriodo(q, st.periodos, agora());
      if (erro) { $('.erro', f).textContent = erro; return; }
      const i = st.periodos.findIndex((x) => x.id === q.id);
      if (i >= 0) st.periodos[i] = q; else st.periodos.push(q);
      if (origemPrevisto) origemPrevisto.feitoId = q.id;
      persistir();
      d.close();
      render();
      avisoMeta(q, origemPrevisto ? 'Feito salvo.' : 'Salvo.');
    });
    d.showModal();
  }

  function dialogoCorrigir(p) {
    const d = $('#dlg');
    if (d.open) d.close();
    d.innerHTML = `<form id="f-corrigir" novalidate>
      <h2>Período aberto esquecido</h2>
      <p>O período aberto desde ${M.rotuloDia(p.data)} às ${p.inicio} ficou aberto demais. Informe o término.</p>
      <label>Término em ${M.rotuloDia(p.data)}<input type="time" name="fim" required></label>
      <p class="mini">Término 00:00 = meia-noite.</p>
      <p class="erro" role="alert"></p>
      <div class="botoes"><button type="button" class="btn perigo" data-act="exc-aberto">Excluir período</button>
        <button type="submit" class="btn primario">Salvar término</button></div>
    </form>`;
    const f = $('#f-corrigir', d);
    f.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const fim = M.normalizarFim(new FormData(f).get('fim'));
      if (!fim) { $('.erro', f).textContent = 'Informe o término.'; return; }
      const q = { ...p, fim };
      const erro = M.validarPeriodo(q, st.periodos, agora());
      if (erro) { $('.erro', f).textContent = erro; return; }
      Object.assign(p, q);
      persistir();
      d.close();
      render();
      avisoMeta(p, 'Término corrigido.');
    });
    d.addEventListener('cancel', bloquearEsc);
    d.addEventListener('close', () => d.removeEventListener('cancel', bloquearEsc), { once: true });
    d.showModal();
  }
  function bloquearEsc(ev) { ev.preventDefault(); }

  function verificarAberto() {
    const p = M.periodoAberto(st);
    if (p && M.abertoEsquecido(p, agora())) { dialogoCorrigir(p); return true; }
    return false;
  }

  // Aviso, sem bloquear, quando o lançamento faz a semana passar da meta.
  function avisoMeta(p, msgOk) {
    const info = M.semanaInfo(st, M.segundaDe(p.data), agora());
    if (p.tipo === 'feito' && info.feito > info.meta) {
      toast(`${msgOk} Atenção: com este lançamento a semana passa da meta em ${M.fmtDur(info.feito - info.meta)}.`, 'alerta');
    } else if (p.tipo === 'previsto' && info.previsto > info.meta) {
      toast(`${msgOk} Atenção: o previsto da semana passa da meta em ${M.fmtDur(info.previsto - info.meta)}.`, 'alerta');
    } else if (msgOk) toast(msgOk);
  }

  // ---------- ações ----------
  function comecar() {
    const now = agora();
    const p = { id: M.uid(), tipo: 'feito', data: M.hojeIso(now), inicio: M.hmTexto(M.minDoDia(now)), fim: null, obs: '' };
    const erro = M.validarPeriodo(p, st.periodos, now);
    if (erro) { toast(erro, 'erro'); return; }
    st.periodos.push(p);
    persistir();
    render();
    toast(`Começou às ${p.inicio}.`);
  }
  function encerrar() {
    const p = M.periodoAberto(st);
    if (!p) { render(); return; }
    const now = agora();
    if (M.abertoEsquecido(p, now)) { dialogoCorrigir(p); return; }
    const q = { ...p, fim: M.fimAgora(p, now) };
    if (M.fimMin(q) <= M.inicioMin(q)) {
      st.periodos = st.periodos.filter((x) => x.id !== p.id);
      persistir();
      render();
      toast('Período de menos de 1 minuto descartado.');
      return;
    }
    const erro = M.validarPeriodo(q, st.periodos, now);
    if (erro) { dialogoPeriodo({ p, titulo: 'Corrigir período' }); $('#f-periodo .erro').textContent = erro; return; }
    Object.assign(p, q);
    persistir();
    render();
    avisoMeta(p, `Encerrado: ${p.inicio}–${M.fimTexto(p)} (${M.fmtDur(M.duracao(p))}).`);
  }
  function salvarFeitoManual(f) {
    const fd = new FormData(f);
    const p = { id: M.uid(), tipo: 'feito', data: fd.get('data'), inicio: fd.get('inicio'), fim: M.normalizarFim(fd.get('fim')), obs: String(fd.get('obs') || '').trim() };
    if (!p.fim) { $('.erro', f).textContent = 'Informe o término.'; return; }
    const erro = M.validarPeriodo(p, st.periodos, agora());
    if (erro) { $('.erro', f).textContent = erro; return; }
    st.periodos.push(p);
    persistir();
    render();
    avisoMeta(p, 'Feito salvo.');
  }
  function baixar(nome, conteudo, tipo) {
    const blob = new Blob([conteudo], { type: tipo });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    st.ultimoBackup = agora().toISOString();
    persistir();
    render();
    toast('Backup exportado. Guarde o arquivo fora do celular (Drive ou e-mail).');
  }
  async function copiarTexto(txt) {
    try { await navigator.clipboard.writeText(txt); return true; } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = txt;
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      ta.remove();
      return ok;
    }
  }
  async function importar(arquivo) {
    let novo;
    try { novo = M.normalizar(JSON.parse(await arquivo.text())); } catch (e) {
      toast(e instanceof SyntaxError ? 'Arquivo não é um JSON válido.' : e.message, 'erro');
      return;
    }
    const ok = await confirmar(`Substituir os dados atuais pelos do arquivo (${novo.periodos.length} períodos, ${novo.ajustes.length} ajustes)?`, 'Substituir');
    if (!ok) return;
    novo.ultimoBackup = agora().toISOString();
    st = novo;
    persistir();
    render();
    toast('Backup importado.');
  }

  document.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    const id = b.dataset.id;
    const now = agora();
    const segAtual = M.segundaDe(M.hojeIso(now));
    switch (act) {
      case 'sem': {
        const dir = +b.dataset.dir * 7;
        if (ui.tela === 'previsao') ui.semPrev = M.somaDias(ui.semPrev, dir);
        else {
          const s = M.somaDias(ui.semHoje || segAtual, dir);
          ui.semHoje = s >= segAtual ? null : s;
        }
        render();
        break;
      }
      case 'comecar': comecar(); break;
      case 'encerrar': encerrar(); break;
      case 'editar': {
        const p = st.periodos.find((x) => x.id === id);
        if (p) dialogoPeriodo({ p, titulo: `Editar ${M.nomeTipo(p.tipo)}` });
        break;
      }
      case 'excluir': {
        const p = st.periodos.find((x) => x.id === id);
        if (!p) break;
        if (await confirmar(`Excluir ${M.nomeTipo(p.tipo)} de ${M.rotuloDia(p.data)}, ${p.inicio}–${M.fimTexto(p)}?`)) {
          st.periodos = st.periodos.filter((x) => x.id !== id);
          persistir();
          render();
          toast('Excluído.');
        }
        break;
      }
      case 'fiz': {
        const prev = st.periodos.find((x) => x.id === id);
        if (prev) dialogoPeriodo({ p: { ...prev, tipo: 'feito' }, titulo: 'Fiz assim', origemPrevisto: prev });
        break;
      }
      case 'add-prev':
        dialogoPeriodo({ p: { id: null, tipo: 'previsto', data: b.dataset.data, inicio: '', fim: '', obs: '' }, titulo: 'Novo Previsto', novo: true });
        break;
      case 'fechar-dlg': $('#dlg').close(); break;
      case 'exc-aberto': {
        const p = M.periodoAberto(st);
        $('#dlg').close();
        if (p && await confirmar(`Excluir o período aberto desde ${M.rotuloDia(p.data)} às ${p.inicio}?`)) {
          st.periodos = st.periodos.filter((x) => x.id !== p.id);
          persistir();
          render();
          toast('Período excluído.');
        } else verificarAberto();
        break;
      }
      case 'enviar': {
        const txt = M.textoPrevisao(st, ui.semPrev);
        if (navigator.share) {
          try { await navigator.share({ text: txt }); } catch (e) { /* cancelado */ }
        } else if (await copiarTexto(txt)) toast('Texto copiado. Cole no WhatsApp.');
        break;
      }
      case 'copiar':
        toast((await copiarTexto(M.textoPrevisao(st, ui.semPrev))) ? 'Texto copiado.' : 'Não foi possível copiar.', 'ok');
        break;
      case 'exp-json': baixar(`minhas-horas-${M.hojeIso(now)}.json`, JSON.stringify(st, null, 2), 'application/json'); break;
      case 'exp-csv': baixar(`minhas-horas-${M.hojeIso(now)}.csv`, M.csv(st, now), 'text/csv;charset=utf-8'); break;
      case 'exc-cota': {
        const c = st.cotas.find((x) => x.id === id);
        if (c && st.cotas.length > 1 && await confirmar(`Excluir a cota de ${M.fmtDur(c.minutos)} a partir de ${M.dma(c.desde)}? As semanas desde então voltam a usar a cota anterior.`)) {
          st.cotas = st.cotas.filter((x) => x.id !== id);
          persistir();
          render();
        }
        break;
      }
      case 'exc-ajuste': {
        const a = st.ajustes.find((x) => x.id === id);
        if (a && await confirmar(`Excluir o ajuste de ${M.fmtDur(a.minutos)} em ${M.rotuloDia(a.data)}?`)) {
          st.ajustes = st.ajustes.filter((x) => x.id !== id);
          persistir();
          render();
        }
        break;
      }
      case 'fechar-dica': st.dicaIconeFechada = true; persistir(); break;
      case 'instalar':
        if (promptInstalar) { promptInstalar.prompt(); promptInstalar = null; renderAvisos(); }
        break;
      default: break;
    }
  });

  document.addEventListener('submit', (ev) => {
    const f = ev.target;
    if (f.id === 'f-feito') { ev.preventDefault(); salvarFeitoManual(f); return; }
    const fd = new FormData(f);
    const erroEl = $('.erro', f);
    if (f.id === 'f-cota') {
      ev.preventDefault();
      const min = M.parseHoras(fd.get('horas'));
      const desde = fd.get('desde');
      if (!desde) { erroEl.textContent = 'Informe a data.'; return; }
      if (min == null || min <= 0 || min > 7 * 19 * 60) { erroEl.textContent = 'Informe as horas por semana (ex.: 15 ou 12:30).'; return; }
      const mesma = st.cotas.find((c) => M.segundaDe(c.desde) === M.segundaDe(desde));
      if (mesma) { mesma.desde = desde; mesma.minutos = min; } else st.cotas.push({ id: M.uid(), desde, minutos: min });
      persistir();
      render();
      toast(`Cota de ${M.fmtDur(min)} a partir da semana de ${M.dma(M.segundaDe(desde))}.`);
    } else if (f.id === 'f-saldo') {
      ev.preventDefault();
      const min = M.parseHoras(fd.get('horas'));
      const data = fd.get('data');
      if (!data) { erroEl.textContent = 'Informe a data de início.'; return; }
      if (min == null) { erroEl.textContent = 'Informe as horas (ex.: 3 ou 2:30).'; return; }
      st.saldoInicial = { data, minutos: min, sentido: fd.get('sentido') === 'repor' ? 'repor' : 'adiantadas' };
      persistir();
      render();
      toast('Saldo inicial salvo.');
    } else if (f.id === 'f-ajuste') {
      ev.preventDefault();
      const min = M.parseHoras(fd.get('horas'));
      const data = fd.get('data');
      if (!data) { erroEl.textContent = 'Informe a data.'; return; }
      if (min == null || min <= 0) { erroEl.textContent = 'Informe as horas (ex.: 2 ou 1:30).'; return; }
      st.ajustes.push({ id: M.uid(), data, minutos: min, sentido: fd.get('sentido') === 'repor' ? 'repor' : 'adiantadas', obs: String(fd.get('obs') || '').trim() });
      persistir();
      render();
      toast('Ajuste salvo.');
    }
  });

  document.addEventListener('change', (ev) => {
    if (ev.target.id === 'imp-json' && ev.target.files[0]) {
      importar(ev.target.files[0]);
      ev.target.value = '';
    }
  });

  // Atualiza o placar enquanto há período aberto, sem refazer formulários.
  function tique() {
    if (document.hidden) return;
    if (verificarAberto()) return;
    const p = M.periodoAberto(st);
    if (!p || ui.tela !== 'hoje' || ui.semHoje) return;
    const now = agora();
    const placar = $('#placar');
    if (placar) placar.outerHTML = placarHtml(M.semanaInfo(st, M.segundaDe(M.hojeIso(now)), now), 'hoje');
    const t = $('#aberto-tempo');
    if (t) t.textContent = M.fmtDur(M.duracao(p, now));
  }

  window.addEventListener('hashchange', rota);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    const r = M.carregar();
    if (r.ok) st = r.estado;
    if (!$('#dlg').open && !$('#dlg-confirma').open) render();
    verificarAberto();
  });
  window.addEventListener('beforeinstallprompt', (ev) => { ev.preventDefault(); promptInstalar = ev; renderAvisos(); });
  window.addEventListener('storage', (ev) => { if (ev.key === M.CHAVE) { const r = M.carregar(); if (r.ok) { st = r.estado; render(); } } });

  iniciar();
  rota();
  verificarAberto();
  setInterval(tique, 30000);
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
})();
