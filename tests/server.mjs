// Servidor estático mínimo para os testes e para olhar o app no computador.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const porta = Number(process.env.PORT || 4173);
const tipos = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.json': 'application/json',
};

createServer(async (req, res) => {
  let caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (caminho.endsWith('/')) caminho += 'index.html';
  const arq = normalize(join(raiz, caminho));
  if (!arq.startsWith(raiz) || arq.includes('node_modules') || arq.includes('/tests/')) { res.writeHead(404).end(); return; }
  try {
    const corpo = await readFile(arq);
    res.writeHead(200, { 'Content-Type': tipos[extname(arq)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(corpo);
  } catch { res.writeHead(404).end('não encontrado'); }
}).listen(porta, () => console.log(`http://localhost:${porta}/`));
