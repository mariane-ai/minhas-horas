// Gera prints das telas em tests/prints/ para conferência.
import { test, expect } from '@playwright/test';

const T = (s) => new Date(`${s}:00-03:00`);
let n = 0;
const P = (tipo, data, inicio, fim, obs = '') => ({ id: `p${++n}`, tipo, data, inicio, fim, obs });
const base = (extra = {}) => ({
  versao: 1, criadoEm: '2026-11-16T12:00:00.000Z', ultimoBackup: '2026-11-22T12:00:00.000Z', dicaIconeFechada: true,
  cotas: [{ id: 'c1', desde: '2026-11-16', minutos: 900 }],
  saldoInicial: { data: '2026-11-16', minutos: 120, sentido: 'adiantadas' },
  ajustes: [],
  periodos: [
    P('feito', '2026-11-16', '08:00', '12:00'), P('feito', '2026-11-17', '13:00', '18:00'),
    P('feito', '2026-11-19', '09:00', '13:30'), P('feito', '2026-11-21', '09:00', '11:00', 'Sábado, relatório'),
    P('previsto', '2026-11-24', '08:00', '12:00'), P('feito', '2026-11-24', '08:10', '12:00'),
    P('previsto', '2026-11-25', '08:00', '12:00', 'Atendimentos'), P('previsto', '2026-11-25', '14:00', '17:00'),
    P('feito', '2026-11-25', '14:05', null),
    P('previsto', '2026-12-01', '13:00', '18:00'), P('previsto', '2026-12-02', '08:00', '12:00'),
    P('previsto', '2026-12-02', '13:00', '14:00'), P('previsto', '2026-12-04', '09:00', '13:00'),
  ],
  ...extra,
});

async function abrir(page, quando, st, hash = '#hoje') {
  await page.clock.setFixedTime(T(quando));
  await page.goto('/' + hash);
  await page.evaluate((v) => localStorage.setItem('minhas-horas:v1', v), JSON.stringify(st));
  await page.reload();
}
const print = (page, nome) => page.screenshot({ path: `tests/prints/${nome}.png`, fullPage: true });

test('prints das telas', async ({ page }) => {
  await abrir(page, '2026-11-25T15:20', base());
  await expect(page.locator('.aberto-info')).toBeVisible();
  await print(page, '1-hoje');

  await page.goto('/#previsao');
  await expect(page.locator('#texto-prev')).toContainText('Total');
  await print(page, '2-previsao');

  await page.goto('/#ajustes');
  await print(page, '3-ajustes');

  await page.goto('/#hoje');
  await page.getByRole('button', { name: 'Encerrar agora' }).click();
  await page.locator('section.card', { hasText: 'Previsto para hoje' }).getByRole('button', { name: 'Fiz assim' }).click();
  await page.screenshot({ path: 'tests/prints/4-fiz-assim.png' });
});

test('prints dos avisos', async ({ page }) => {
  await abrir(page, '2026-11-26T09:00', base({ ultimoBackup: '2026-11-10T12:00:00.000Z', dicaIconeFechada: false }));
  await expect(page.locator('#dlg')).toContainText('Período aberto esquecido');
  await page.screenshot({ path: 'tests/prints/5-periodo-esquecido.png' });
  await page.locator('#dlg [name=fim]').fill('17:10');
  await page.locator('#dlg').getByRole('button', { name: 'Salvar término' }).click();
  await page.screenshot({ path: 'tests/prints/6-avisos-backup-e-icone.png' });
});
