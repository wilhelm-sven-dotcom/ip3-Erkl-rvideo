// Bildsequenz-Renderer: startet einen lokalen Server für /engine, öffnet die Render-Stage in
// Headless-Chromium (WebGL über SwiftShader) und schreibt Einzelbilder.
//
//   node render/render.mjs --times 1,5.5,12 --out out/stills --q 0.5
//   node render/render.mjs --from 0 --to 10 --fps 30 --out out/frames/s1
//   node render/render.mjs --look '[x,y,z]' --target '[x,y,z]' --fov 40 --sun 54,145 --out out/look.jpg
import { chromium } from '../engine/node_modules/playwright/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'engine');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
  return a;
}, []));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.ttf': 'font/ttf', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.wav': 'audio/wav' };
const srv = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); res.end(d);
  });
});
await new Promise((r) => srv.listen(0, r));
const port = srv.address().port;

const q = parseFloat(args.q || '1');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: q });
page.on('console', (m) => { const t = m.text(); if (!/GPU stall|GL Driver Message/.test(t)) console.log('[page]', t); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${port}/index.html?q=${q}`);
await page.waitForFunction(() => window.ready === true || window.initError, null, { timeout: 300000 });
const initErr = await page.evaluate(() => window.initError);
if (initErr) { console.error('INIT ERROR', initErr); process.exit(1); }

const fmt = args.fmt || 'jpg';
const shot = async (file) => {
  const opts = { path: file, clip: { x: 0, y: 0, width: 1920, height: 1080 } };
  if (fmt === 'jpg') Object.assign(opts, { type: 'jpeg', quality: parseInt(args.quality || '92') });
  await page.screenshot(opts);
};

const t0 = Date.now();
if (args.look) {
  const sun = (args.sun || '54,145').split(',').map(Number);
  await page.evaluate(([p, t, f, e, a]) => window.debugLook(p, t, f, e, a), [JSON.parse(args.look), JSON.parse(args.target), parseFloat(args.fov || '40'), sun[0], sun[1]]);
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  await shot(args.out);
  console.log('wrote', args.out, Date.now() - t0, 'ms');
} else {
  let times = [];
  if (args.times) times = args.times.split(',').map(Number);
  else {
    const fps = parseFloat(args.fps || '30');
    const f0 = Math.round(parseFloat(args.from) * fps), f1 = Math.round(parseFloat(args.to) * fps);
    for (let f = f0; f < f1; f++) times.push(f / fps);
  }
  fs.mkdirSync(args.out, { recursive: true });
  const fps = parseFloat(args.fps || '30');
  let i = 0;
  for (const t of times) {
    await page.evaluate((tt) => window.seek(tt), t);
    const name = args.times ? `t${t.toFixed(2).padStart(6, '0')}.${fmt}` : `f${String(Math.round(t * fps)).padStart(5, '0')}.${fmt}`;
    await shot(path.join(args.out, name));
    i++;
    if (i % 30 === 0 || args.times) console.log(`${i}/${times.length} t=${t.toFixed(2)} ${((Date.now() - t0) / i).toFixed(0)} ms/frame`);
  }
}
await browser.close();
srv.close();
