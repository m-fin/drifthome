// Before/after stills of the cockpit/doorway framing, rendered exactly like a capture (capture.html, frame(2) from t=0, so the
// stateful follow camera has its real history). One headless Chrome + local server, both closed at the end.
//   node tests/cockpit_stills.mjs --old DIR --out stills/collision [--times 14.2,16.6,19.4]
import fs from 'fs'; import http from 'http'; import path from 'path';
import puppeteer from '/workspace/crave-lab/tools/cdp/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const ROOTS = { new: path.resolve(path.dirname(new URL(import.meta.url).pathname), '..') }; if (arg('--old')) ROOTS.old = path.resolve(arg('--old'));
const OUT = arg('--out') || 'stills/collision', TIMES = (arg('--times') || '14.2,16.6,19.4').split(',').map(Number);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript' };
const srv = http.createServer((q, s) => { const u = decodeURI(q.url.split('?')[0]); const m = u.match(/^\/([a-z0-9_]+)\/(.*)$/); if (!m || !ROOTS[m[1]]) { s.writeHead(404); return s.end(); }
  const f = path.join(ROOTS[m[1]], m[2]); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); }); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, protocolTimeout: 0, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
fs.mkdirSync(OUT, { recursive: true }); const saved = [];
try { for (const b of Object.keys(ROOTS)) { const tag = b === 'new' ? 'after' : 'before';
  const ev = JSON.parse(fs.readFileSync(path.join(ROOTS[b], 'runs/m1/events_seed1.json'))).events; // Ep1 M1 seed 1
  const page = await browser.newPage(); await page.setViewport({ width: 960, height: 540 });
  await page.goto(`http://127.0.0.1:${srv.address().port}/${b}/capture.html`); await page.waitForFunction(() => window.cap, { timeout: 60000 });
  await page.evaluate((e) => { window.cap.init(1, 960, 540, e); }, ev);
  for (const T of TIMES) { const r = await page.evaluate((T) => { let f; do { f = window.cap.frame(2); } while (f.t_s < T - 1e-6); return { t: f.t_s, view: f.view, png: document.getElementById('c').toDataURL('image/png').split(',')[1] }; }, T);
    const fn = `${OUT}/cockpit_framing_${String(T).replace('.', 'p')}s_${tag}.png`; fs.writeFileSync(fn, Buffer.from(r.png, 'base64')); saved.push([fn, r.t, r.view]); }
  await page.close(); } }
finally { await browser.close(); srv.close(); }
for (const s of saved) console.log(s.join('  '));
