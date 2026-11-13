// Capture-camera identity check (v4 hard constraint: capture frames must not change). For Ep1 M1 and M2, seeds 1-8, 16:9 and
// 9:16, every capture frame is stepped exactly like capture.html (2 ticks/frame, director view m2View from the log, R.render)
// with the GPU draw stubbed out, and the camera actually used (interior camera or the exterior space camera) is recorded:
// position + quaternion. Each build's own runs/ logs are used. Then every build is diffed frame by frame against --ref.
// One headless Chrome + local server, both closed at the end.
//   node tests/capture_cam_identity.mjs --ref DIR [--seeds 8]
import fs from 'fs'; import http from 'http'; import path from 'path'; import crypto from 'crypto';
import puppeteer from '/workspace/crave-lab/tools/cdp/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const ROOTS = { new: path.resolve(path.dirname(new URL(import.meta.url).pathname), '..') }; if (!arg('--ref')) throw new Error('--ref DIR required'); ROOTS.ref = path.resolve(arg('--ref'));
const NS = +(arg('--seeds') || 8);
const HARNESS = `<!doctype html><html><body><canvas id="c"></canvas><script type="module">
import * as G from './game.mjs'; import { makePilot } from './pilot.mjs'; import { createRenderer } from './render.mjs'; import { m2View } from './director.mjs';
window.run = (seed, m1, w, h, events) => { const R = createRenderer(document.getElementById('c'), w, h, seed); let used = null;
  R.renderer.render = (scene, cam) => { scene.updateMatrixWorld(); used = cam; }; // no draw; remember which camera the frame used
  G.reset(seed, { m1 }); const act = makePilot(G.state()); let o = G.observe(); const end = events.find(e => e.type === 'run_end').tick; const view = () => m2View(o, events);
  const rows = []; const rec = () => { used.updateMatrixWorld(); const p = used.position, q = used.quaternion; rows.push([p.x, p.y, p.z, q.x, q.y, q.z, q.w].map(v => Math.round(v * 1e5) / 1e5).join(',')); };
  R.render(o, view()); rec(); let n = 1; const N = Math.round(end / 2);
  while (n < N) { for (let i = 0; i < 2; i++) o = G.step(act(o)).obs; R.render(o, view()); rec(); n++; }
  return rows; };
document.title = 'READY';
</script></body></html>`;
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript' };
const srv = http.createServer((q, s) => { const u = decodeURI(q.url.split('?')[0]); const m = u.match(/^\/([a-z0-9_]+)\/(.*)$/); if (!m || !ROOTS[m[1]]) { s.writeHead(404); return s.end(); }
  if (m[2] === '__capcam.html') { s.writeHead(200, { 'content-type': 'text/html' }); return s.end(HARNESS); }
  const f = path.join(ROOTS[m[1]], m[2]); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); }); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
const res = {}; let bad = 0;
try {
  for (let seed = 1; seed <= NS; seed++) for (const m1 of [true, false]) for (const [an, w, h] of [['16x9', 192, 108], ['9x16', 108, 192]]) {
    const key = `${m1 ? 'ep1_m1' : 'm2'}_seed${seed}_${an}`, tr = {};
    for (const b of ['ref', 'new']) { const log = JSON.parse(fs.readFileSync(path.join(ROOTS[b], m1 ? `runs/m1/events_seed${seed}.json` : `runs/events_seed${seed}.json`), 'utf8'));
      const page = await browser.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
      await page.goto(`http://127.0.0.1:${srv.address().port}/${b}/__capcam.html`); await page.waitForFunction(() => window.run, { timeout: 60000 });
      tr[b] = await page.evaluate((s, m, w, h, e) => window.run(s, m, w, h, e), seed, m1, w, h, log.events); await page.close(); if (errs.length) console.log(b, key, errs); }
    let diff = 0, first = null; for (let i = 0; i < Math.max(tr.ref.length, tr.new.length); i++) if (tr.ref[i] !== tr.new[i]) { diff++; if (first == null) first = i; }
    const hh = (a) => crypto.createHash('sha256').update(a.join('\n')).digest('hex').slice(0, 16);
    res[key] = { frames: [tr.ref.length, tr.new.length], framesDiffer: diff, firstDiffFrame: first, firstDiff_s: first == null ? null : +(first / 30).toFixed(3), refTrack: hh(tr.ref), newTrack: hh(tr.new) }; if (diff || tr.ref.length !== tr.new.length) bad++;
    console.log(key.padEnd(22), JSON.stringify(res[key]));
  }
} finally { await browser.close(); srv.close(); }
console.log(bad ? `CAPTURE CAMERA CHANGED in ${bad} runs` : `capture camera identical to ref in all ${Object.keys(res).length} runs (position + rotation, every frame)`);
fs.writeFileSync(path.join(ROOTS.new, 'tests/capture_cam_identity_result.json'), JSON.stringify({ when: new Date().toString(), ref: ROOTS.ref, res }, null, 1)); process.exit(bad ? 1 : 0);
