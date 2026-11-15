// Gera icons/icon-192.png e icon-512.png desenhando num canvas do Chromium.
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const desenho = (tam) => {
  const c = document.createElement('canvas');
  c.width = c.height = tam;
  const g = c.getContext('2d');
  const u = tam / 512;
  g.fillStyle = '#2f6f68';
  g.fillRect(0, 0, tam, tam);
  // mostrador (dentro da zona segura de ícone mascarável: raio 40%)
  g.fillStyle = '#f5f3ee';
  g.beginPath(); g.arc(256 * u, 256 * u, 150 * u, 0, Math.PI * 2); g.fill();
  // arco da semana já feita
  g.strokeStyle = '#d9b75f'; g.lineWidth = 26 * u; g.lineCap = 'round';
  g.beginPath(); g.arc(256 * u, 256 * u, 186 * u, -Math.PI / 2, Math.PI * 0.85); g.stroke();
  // ponteiros
  g.strokeStyle = '#24564f'; g.lineWidth = 24 * u;
  g.beginPath(); g.moveTo(256 * u, 256 * u); g.lineTo(256 * u, 156 * u); g.stroke();
  g.beginPath(); g.moveTo(256 * u, 256 * u); g.lineTo(326 * u, 296 * u); g.stroke();
  g.fillStyle = '#24564f';
  g.beginPath(); g.arc(256 * u, 256 * u, 18 * u, 0, Math.PI * 2); g.fill();
  return c.toDataURL('image/png');
};

const browser = await chromium.launch();
const page = await browser.newPage();
for (const tam of [192, 512]) {
  const url = await page.evaluate(desenho, tam);
  await writeFile(new URL(`../icons/icon-${tam}.png`, import.meta.url), Buffer.from(url.split(',')[1], 'base64'));
}
await browser.close();
console.log('ícones gerados');
