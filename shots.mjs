// shots.mjs — photograph TETHERDEEP with the local Playwright Chromium.
// Serves game/ on 127.0.0.1:8082, opens each shot in shots.json at 1280x720, waits
// for the page's own __shotReady flag, and writes unedited JPEG viewport captures,
// stepping the JPEG quality down only until each file fits the 256 KiB cap.
// The cloud browser cannot reach localhost, so this runs locally only.
//
//   node shots.mjs            capture all four shots
//   ONLY=2 node shots.mjs     capture only 2-gameplay.jpg

import { createReadStream, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = fileURLToPath(new URL('.', import.meta.url));
const gameRoot = resolve(here, 'game');
const shotsDir = resolve(here, 'screenshots');
mkdirSync(shotsDir, { recursive: true });

const requireTool = createRequire(join(process.env.HOME, 'workspace/makefun/shot-tool/package.json'));
const { chromium } = requireTool('playwright');

const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
const only = process.env.ONLY || '';
const wanted = shots.filter((shot) => !only || shot.name.startsWith(only));
const MAX_BYTES = 256 * 1024;
const QUALITIES = [88, 75, 60, 45, 30];
const PORT = 8082;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const resolved = resolve(join(gameRoot, normalize(pathname)));
  if (resolved !== gameRoot && !resolved.startsWith(gameRoot + sep)) {
    response.writeHead(403, { 'content-type': 'text/plain' });
    response.end('forbidden');
    return;
  }
  response.writeHead(200, { 'content-type': MIME[extname(resolved).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  createReadStream(resolved).on('error', () => {
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('not found');
  }).pipe(response);
});

await new Promise((done) => server.listen(PORT, '127.0.0.1', done));
console.log(`serving ${gameRoot} on http://localhost:${PORT}`);

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--hide-scrollbars'],
});

const results = [];
for (const shot of wanted) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  const started = Date.now();
  await page.goto(`http://localhost:${PORT}/${shot.query}`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 30000 });
  const readyMs = Date.now() - started;
  let chosen = null;
  for (const quality of QUALITIES) {
    const buffer = await page.screenshot({ type: 'jpeg', quality });
    if (buffer.length <= MAX_BYTES || quality === QUALITIES[QUALITIES.length - 1]) {
      chosen = { buffer, quality };
      break;
    }
  }
  const path = resolve(shotsDir, shot.name);
  writeFileSync(path, chosen.buffer);
  const result = { file: shot.name, readyMs, quality: chosen.quality, bytes: statSync(path).size, errors: errors.slice(0, 5) };
  results.push(result);
  console.log(JSON.stringify(result));
  await context.close();
}
await browser.close();
server.close();
console.log('DONE', JSON.stringify({ count: results.length, overCap: results.filter((r) => r.bytes > MAX_BYTES).map((r) => r.file) }));
