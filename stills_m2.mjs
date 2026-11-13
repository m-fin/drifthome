// node stills_m2.mjs [seed] [only,names] -> stills/m2/*.png (1280x720; env W, H, OUT override size and folder). One headless Chrome, sim stepped headless between shots,
// one rendered frame per still. Reads runs/events_seed<N>.json for the shot times.
import fs from 'fs'; import http from 'http'; import path from 'path';
import puppeteer from '/workspace/crave-lab/tools/cdp/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const seed = +(process.argv[2] || 1), only = process.argv[3], W = +(process.env.W || 1280), H = +(process.env.H || 720), OUT = process.env.OUT || 'stills/m2', DT = 1 / 60;
const run = JSON.parse(fs.readFileSync(`runs/events_seed${seed}.json`)); const ev = (t) => run.events.find(e => e.type === t);
const shots = [
  ['01_launch', 'launch', 5.8, 'launch'], ['02_nebula', 'nebula_enter', 9, 'nebula'], ['03_asteroid_near_miss', 'asteroid_near_miss', -0.5, 'nearmiss'],
  ['04_planet_approach', 'planet_approach', 5, 'approach'], ['05_landed', 'land', 0.8, 'landed'], ['06_docked', 'dock', 0.6, 'docked'],
].filter(s => !only || only.split(',').includes(s[0])).map(([name, type, off, view]) => ({ name, view, tick: ev(type).tick + Math.round(off / DT) })).sort((a, b) => a.tick - b.tick);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript' };
const srv = http.createServer((q, s) => { const f = path.join(process.cwd(), decodeURI(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); }); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, protocolTimeout: 0, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', `--window-size=${W},${H}`] });
try {
  const page = await browser.newPage(); page.on('console', m => console.error('[page]', m.text())); page.on('pageerror', e => console.error('[pageerr]', e.message)); await page.setViewport({ width: W, height: H });
  await page.goto(`http://127.0.0.1:${srv.address().port}/capture.html`); await page.waitForFunction(() => window.cap);
  await page.evaluate((s, w, h, e, m) => { window.cap.init(s, w, h, e, m); }, seed, W, H, run.events, run.milestone);
  fs.mkdirSync(OUT, { recursive: true });
  for (const s of shots) { const t0 = Date.now(); const r = await page.evaluate((k, v) => window.cap.still(k, v), s.tick, s.view);
    const out = `${OUT}/${s.name}${seed === 1 ? '' : '_seed' + seed}.png`; fs.writeFileSync(out, Buffer.from(r.png, 'base64')); console.log(out, `t=${r.t_s}s`, r.view, r.ship, `${Date.now() - t0}ms`); }
} finally { await browser.close(); srv.close(); }
