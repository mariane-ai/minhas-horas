import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// Horários sempre no fuso de Brasília (-03:00), igual ao timezoneId da configuração.
const T = (s) => new Date(`${s}:00-03:00`);
const CHAVE = 'minhas-horas:v1';

function estado(extra = {}) {
  return {
    versao: 1,
    criadoEm: '2026-11-15T12:00:00.000Z',
    ultimoBackup: '2026-11-15T12:00:00.000Z',
    dicaIconeFechada: true,
    cotas: [{ id: 'c1', desde: '2026-11-16', minutos: 900 }],
    saldoInicial: { data: '2026-11-16', minutos: 0, sentido: 'adiantadas' },
    ajustes: [],
    periodos: [],
    ...extra,
  };
}
let n = 0;
const P = (tipo, data, inicio, fim, obs = '') => ({ id: `p${++n}`, tipo, data, inicio, fim, obs });

// Abre o app num instante fixo, já com um estado salvo (ou vazio).
async function abrir(page, quando, st = estado(), hash = '#hoje') {
  await page.clock.setFixedTime(T(quando));
  await page.goto('/' + hash);
  await page.evaluate(([k, v]) => { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); }, [CHAVE, st ? JSON.stringify(st) : null]);
  await page.reload();
}
const lerEstado = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), CHAVE);

async function lancarFeito(page, data, inicio, fim, obs = '') {
  const f = page.locator('#f-feito');
  await f.locator('[name=data]').fill(data);
  await f.locator('[name=inicio]').fill(inicio);
  await f.locator('[name=fim]').fill(fim);
  if (obs) await f.locator('[name=obs]').fill(obs);
  await f.getByRole('button', { name: 'Salvar' }).click();
}

test.describe('regras de recusa', () => {
  test('faixa 00:00–05:00, término antes do início, Feito no futuro e sobreposição', async ({ page }) => {
    await abrir(page, '2026-11-18T20:00');
    const erro = page.locator('#f-feito .erro');

    await lancarFeito(page, '2026-11-18', '04:30', '06:00');
    await expect(erro).toContainText('Entre 00:00 e 05:00');

    await lancarFeito(page, '2026-11-18', '22:00', '03:00');
    await expect(erro).toContainText('Entre 00:00 e 05:00');

    await lancarFeito(page, '2026-11-18', '10:00', '10:00');
    await expect(erro).toContainText('O término precisa ser depois do início');

    await lancarFeito(page, '2026-11-18', '19:00', '21:00');
    await expect(erro).toContainText('só pode terminar até agora');

    await lancarFeito(page, '2026-11-18', '08:00', '12:00');
    await expect(page.locator('#semana')).toContainText('08:00–12:00');

    await lancarFeito(page, '2026-11-18', '11:00', '13:00');
    await expect(page.locator('#f-feito .erro')).toContainText('Sobrepõe outro Feito (08:00–12:00)');

    await lancarFeito(page, '2026-11-18', '12:00', '13:00');
    await expect(page.locator('#semana')).toContainText('12:00–13:00');
    expect((await lerEstado(page)).periodos).toHaveLength(2);
  });

  test('término à meia-noite (00:00) vale e conta até 24:00', async ({ page }) => {
    await abrir(page, '2026-11-19T09:00');
    await lancarFeito(page, '2026-11-18', '22:00', '00:00');
    await expect(page.locator('#semana')).toContainText('22:00–24:00');
    await expect(page.locator('.placar-num')).toContainText('Feito 2 h de 15 h');
  });

  test('Previsto pode sobrepor Feito, mas não outro Previsto', async ({ page }) => {
    const st = estado({ periodos: [P('feito', '2026-11-23', '08:00', '12:00'), P('previsto', '2026-11-23', '08:00', '12:00')] });
    await abrir(page, '2026-11-23T13:00', st, '#previsao');
    // Previsão abre na semana seguinte; volta para a atual não é permitido, então usa a semana do dia 30
    await page.locator('[data-act=add-prev][data-data="2026-12-01"]').click();
    const dlg = page.locator('#dlg');
    await dlg.locator('[name=inicio]').fill('09:00');
    await dlg.locator('[name=fim]').fill('11:00');
    await dlg.getByRole('button', { name: 'Salvar' }).click();
    await page.locator('[data-act=add-prev][data-data="2026-12-01"]').click();
    await dlg.locator('[name=inicio]').fill('10:00');
    await dlg.locator('[name=fim]').fill('12:00');
    await dlg.getByRole('button', { name: 'Salvar' }).click();
    await expect(dlg.locator('.erro')).toContainText('Sobrepõe outro Previsto');
    await dlg.getByRole('button', { name: 'Cancelar' }).click();

    // na semana atual, Previsto 08–12 e Feito 08–12 convivem; editar o Previsto para 09–13 também vale
    await page.goto('/#hoje');
    await page.locator('#semana li.previsto [data-act=editar]').click();
    await dlg.locator('[name=fim]').fill('13:00');
    await dlg.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.locator('#semana li.previsto')).toContainText('08:00–13:00');
  });
});

test.describe('Começar e Encerrar agora', () => {
  test('abre e fecha um período, e recusa começar na faixa proibida', async ({ page }) => {
    await abrir(page, '2026-11-18T10:00');
    await page.getByRole('button', { name: 'Começar agora' }).click();
    await expect(page.locator('.aberto-info')).toContainText('Aberto desde 10:00');
    await page.clock.setFixedTime(T('2026-11-18T11:30'));
    await page.getByRole('button', { name: 'Encerrar agora' }).click();
    await expect(page.locator('#toast')).toContainText('Encerrado: 10:00–11:30 (1 h 30)');
    await expect(page.locator('.placar-num')).toContainText('Feito 1 h 30 de 15 h');
    await expect(page.getByRole('button', { name: 'Começar agora' })).toBeVisible();

    await page.clock.setFixedTime(T('2026-11-19T03:00'));
    await page.reload();
    await page.getByRole('button', { name: 'Começar agora' }).click();
    await expect(page.locator('#toast')).toContainText('Entre 00:00 e 05:00');
    expect((await lerEstado(page)).periodos).toHaveLength(1);
  });

  test('período aberto esquecido pede o término ao abrir o app', async ({ page }) => {
    const st = estado({ periodos: [P('feito', '2026-11-18', '20:00', null)] });
    await abrir(page, '2026-11-19T08:00', st);
    const dlg = page.locator('#dlg');
    await expect(dlg).toContainText('Período aberto esquecido');
    await expect(dlg).toContainText('Qua 18/11 às 20:00');
    await dlg.locator('[name=fim]').fill('03:00');
    await dlg.getByRole('button', { name: 'Salvar término' }).click();
    await expect(dlg.locator('.erro')).toContainText('Entre 00:00 e 05:00');
    await dlg.locator('[name=fim]').fill('22:30');
    await dlg.getByRole('button', { name: 'Salvar término' }).click();
    await expect(dlg).not.toBeVisible();
    await expect(page.locator('#semana')).toContainText('20:00–22:30');
  });

  test('período aberto há mais de 12 h no mesmo dia também pede correção', async ({ page }) => {
    const st = estado({ periodos: [P('feito', '2026-11-18', '06:00', null)] });
    await abrir(page, '2026-11-18T18:30', st);
    await expect(page.locator('#dlg')).toContainText('Período aberto esquecido');
  });
});

test.describe('semanas e saldo', () => {
  test('virada de semana: domingo fecha a semana e segunda abre com o saldo', async ({ page }) => {
    const st = estado({
      periodos: [
        P('feito', '2026-11-16', '08:00', '12:00'),
        P('feito', '2026-11-18', '08:00', '12:00'),
        P('feito', '2026-11-22', '18:00', '22:00'),
      ],
    });
    await abrir(page, '2026-11-22T23:59', st);
    await expect(page.locator('.sem-titulo')).toHaveText('Semana 16/11 a 22/11');
    await expect(page.locator('.placar-num')).toContainText('Feito 12 h de 15 h');
    await expect(page.locator('.placar .saldo')).toContainText('Saldo: zerado');

    await page.clock.setFixedTime(T('2026-11-23T08:00'));
    await page.reload();
    await expect(page.locator('.sem-titulo')).toHaveText('Semana 23/11 a 29/11');
    await expect(page.locator('.placar-num')).toContainText('Feito 0 h de 18 h');
    await expect(page.locator('.placar')).toContainText('cota 15 h + 3 h a repor');
    await expect(page.locator('.placar .saldo')).toContainText('Saldo: 3 h a repor');

    await page.getByRole('button', { name: 'Semana anterior' }).click();
    await expect(page.locator('.placar')).toContainText('Semana fechada. Saldo ao fim: 3 h a repor');
    await expect(page.getByRole('button', { name: 'Começar agora' })).toHaveCount(0);
  });

  test('cota mudando no meio não recalcula semanas anteriores; ajuste entra no saldo', async ({ page }) => {
    const st = estado({
      cotas: [{ id: 'c1', desde: '2026-11-16', minutos: 900 }, { id: 'c2', desde: '2026-12-02', minutos: 600 }],
      periodos: [
        P('feito', '2026-11-17', '08:00', '23:00'), // semana 16/11: 15 h → zerado
        P('feito', '2026-11-24', '06:00', '23:00'), // semana 23/11: 17 h → 2 h adiantadas
        P('feito', '2026-12-01', '08:00', '18:00'), // semana 30/11 (cota 10 a partir de qua 02/12 vale a semana toda): 10 h
      ],
    });
    await abrir(page, '2026-12-07T09:00', st);
    await expect(page.locator('.placar .saldo')).toContainText('Saldo: 2 h adiantadas');
    await expect(page.locator('.placar-num')).toContainText('Feito 0 h de 8 h');
    await expect(page.locator('.placar')).toContainText('cota 10 h − 2 h adiantadas');

    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Semana anterior' }).click();
    await expect(page.locator('.sem-titulo')).toHaveText('Semana 16/11 a 22/11');
    await expect(page.locator('.placar')).toContainText('Meta da semana 15 h');
    await expect(page.locator('.placar')).toContainText('Saldo ao fim: zerado');

    await page.goto('/#ajustes');
    const f = page.locator('#f-ajuste');
    await f.locator('[name=data]').fill('2026-12-07');
    await f.locator('[name=horas]').fill('2');
    await f.getByLabel('A repor').check();
    await f.locator('[name=obs]').fill('Acordo para zerar o saldo');
    await f.getByRole('button', { name: 'Adicionar ajuste' }).click();
    await expect(page.locator('.grande-txt')).toHaveText('Saldo zerado');
    await page.goto('/#hoje');
    await expect(page.locator('.placar-num')).toContainText('de 10 h');
  });

  test('saldo inicial e nova cota pela tela de Ajustes', async ({ page }) => {
    await abrir(page, '2026-11-18T10:00');
    await page.goto('/#ajustes');
    const fs = page.locator('#f-saldo');
    await fs.locator('[name=horas]').fill('3');
    await fs.getByLabel('Adiantadas').check();
    await fs.getByRole('button', { name: 'Salvar saldo inicial' }).click();
    await expect(page.locator('.grande-txt')).toHaveText('3 h adiantadas');

    const fc = page.locator('#f-cota');
    await fc.locator('[name=desde]').fill('2026-11-23');
    await fc.locator('[name=horas]').fill('12:30');
    await fc.getByRole('button', { name: 'Adicionar cota' }).click();
    await expect(page.locator('#tela')).toContainText('12 h 30 por semana');
    await page.goto('/#hoje');
    await expect(page.locator('.placar-num')).toContainText('de 12 h'); // 15 − 3 nesta semana
  });

  test('aviso sem bloquear quando o lançamento passa da meta', async ({ page }) => {
    await abrir(page, '2026-11-18T20:00', estado({ cotas: [{ id: 'c1', desde: '2026-11-16', minutos: 120 }] }));
    await lancarFeito(page, '2026-11-18', '08:00', '11:00');
    await expect(page.locator('#toast')).toContainText('passa da meta em 1 h');
    await expect(page.locator('.placar .passou')).toContainText('Passou da meta em 1 h');
    expect((await lerEstado(page)).periodos).toHaveLength(1);
  });
});

test('"Fiz assim" vira Feito pré-preenchido e editável', async ({ page }) => {
  const st = estado({ periodos: [P('previsto', '2026-11-18', '08:00', '12:00', 'Atendimentos'), P('previsto', '2026-11-18', '14:00', '18:00')] });
  await abrir(page, '2026-11-18T13:00', st);
  const card = page.locator('section.card', { hasText: 'Previsto para hoje' });
  await expect(card.getByRole('button', { name: 'Fiz assim' })).toHaveCount(1); // só o que já passou
  await card.getByRole('button', { name: 'Fiz assim' }).click();
  const dlg = page.locator('#dlg');
  await expect(dlg.locator('[name=inicio]')).toHaveValue('08:00');
  await expect(dlg.locator('[name=fim]')).toHaveValue('12:00');
  await expect(dlg.locator('[name=obs]')).toHaveValue('Atendimentos');
  await dlg.locator('[name=fim]').fill('11:30');
  await dlg.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.locator('#semana li.feito')).toContainText('08:00–11:30');
  await expect(card).toContainText('✓ Feito');
  await expect(page.locator('.placar-num')).toContainText('Feito 3 h 30 de 15 h');
  const salvo = await lerEstado(page);
  expect(salvo.periodos.filter((p) => p.tipo === 'previsto')).toHaveLength(2);
});

test('Previsão monta o texto no formato combinado e copia', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await abrir(page, '2026-11-18T10:00', estado(), '#previsao');
  await expect(page.locator('.sem-titulo')).toHaveText('Semana 23/11 a 29/11');
  const dlg = page.locator('#dlg');
  const add = async (data, ini, fim) => {
    await page.locator(`[data-act=add-prev][data-data="${data}"]`).click();
    await dlg.locator('[name=inicio]').fill(ini);
    await dlg.locator('[name=fim]').fill(fim);
    await dlg.getByRole('button', { name: 'Salvar' }).click();
    await expect(dlg).not.toBeVisible();
  };
  await add('2026-11-24', '13:00', '18:00');
  await add('2026-11-25', '13:00', '14:00');
  await add('2026-11-25', '08:00', '12:00');
  await add('2026-11-27', '09:00', '14:00');
  const esperado = [
    'Previsão da semana 23/11 a 29/11',
    'Ter 24/11 · 13:00–18:00',
    'Qua 25/11 · 08:00–12:00 e 13:00–14:00',
    'Sex 27/11 · 09:00–14:00',
    'Total: 15 h',
  ].join('\n');
  await expect(page.locator('#texto-prev')).toHaveText(esperado);
  await expect(page.locator('.placar')).toContainText('Bate com a meta');
  await page.getByRole('button', { name: 'Copiar' }).click();
  await expect(page.locator('#toast')).toContainText('Texto copiado');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(esperado);
});

test('exportar JSON e CSV, importar JSON', async ({ page }, info) => {
  const st = estado({ ultimoBackup: null, criadoEm: '2026-11-01T12:00:00.000Z', periodos: [P('feito', '2026-11-17', '08:00', '12:00', 'Plantão, "extra"')] });
  await abrir(page, '2026-11-18T10:00', st);
  await expect(page.locator('.faixa.backup')).toContainText('Nenhum backup feito ainda');

  const [dj] = await Promise.all([page.waitForEvent('download'), page.locator('.faixa.backup button').click()]);
  expect(dj.suggestedFilename()).toBe('minhas-horas-2026-11-18.json');
  const caminhoJson = info.outputPath('backup.json');
  await dj.saveAs(caminhoJson);
  const json = JSON.parse(await readFile(caminhoJson, 'utf8'));
  expect(json.periodos[0]).toMatchObject({ data: '2026-11-17', inicio: '08:00', fim: '12:00' });
  await expect(page.locator('.faixa.backup')).toHaveCount(0);

  await page.goto('/#ajustes');
  const [dc] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar CSV' }).click()]);
  const csv = await readFile(await dc.path(), 'utf8');
  expect(csv).toContain('"Tipo","Data","Dia","Início","Término","Duração","Minutos","Sentido","Observação"');
  expect(csv).toContain('"Feito","17/11/2026","Ter","08:00","12:00","04:00","240","","Plantão, ""extra"""');

  // apaga tudo e restaura pelo arquivo
  await page.evaluate((k) => localStorage.removeItem(k), CHAVE);
  await page.reload();
  await expect(page.locator('#tela')).not.toContainText('Plantão');
  await page.locator('#imp-json').setInputFiles(caminhoJson);
  await page.locator('#dlg-confirma').getByRole('button', { name: 'Substituir' }).click();
  await expect(page.locator('#toast')).toContainText('Backup importado');
  await page.goto('/#hoje');
  await expect(page.locator('#semana')).toContainText('Plantão, "extra"');

  // arquivo que não é backup é recusado sem mexer nos dados
  await page.goto('/#ajustes');
  await page.locator('#imp-json').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1}') });
  await expect(page.locator('#toast')).toContainText('não é um backup');
  expect((await lerEstado(page)).periodos).toHaveLength(1);
});

test('funciona offline depois da primeira visita', async ({ page, context }) => {
  await abrir(page, '2026-11-18T10:00');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // passa a ser controlada pelo service worker
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Começar agora' })).toBeVisible();
  await lancarFeito(page, '2026-11-18', '08:00', '09:00');
  await expect(page.locator('.placar-num')).toContainText('Feito 1 h de 15 h');
  await page.goto('/#previsao');
  await expect(page.locator('.sem-titulo')).toHaveText('Semana 23/11 a 29/11');
});

test('nenhuma chamada de rede além dos arquivos do app', async ({ page }) => {
  const urls = [];
  page.on('request', (r) => urls.push(r.url()));
  await abrir(page, '2026-11-18T10:00');
  await page.goto('/#previsao');
  await page.goto('/#ajustes');
  expect(urls.filter((u) => !u.startsWith('http://localhost:4173/'))).toEqual([]);
});
