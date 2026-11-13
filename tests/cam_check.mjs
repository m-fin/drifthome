// Headless follow-camera check (one headless Chrome, closed at the end; local http server closed too). No drawing: the camera
// is placed exactly like capture.html does per frame (2 ticks/frame, director view from the event log), via render.mjs placeCam.
//   node tests/cam_check.mjs [--old DIR] [--only RUN] [--trace '[t0,t1,portrait]']
//   runs: Ep1 M1 seed 1, M2 seed 1, M1 seed 2, M2 seed 2 (interior frames), landscape 16:9 and portrait 9:16
// Per interior frame: camera move vs the previous frame (same view + same room), look-down pitch, distance to Bolt's head,
// Bolt's position on screen. Flags: pitch > 60 deg down, camera < 1.2 m from his head, Bolt off-screen, move > 0.25 m (jump),
// move >= 0.149 m (at the 0.15 m/frame cap), camera clearance to any prop / handhold box (minPropDist, minHandholdDist),
// a prop filling the lens (16x9 ray grid, prop hits within 1 m of the camera: nearLens1/5 = frames over 1%/5% of the frame), follow camera > 5.5 m from his head (far55). hardCuts = any follow->follow
// move > 0.25 m (room cuts included); cutsNearDirectorCut = those within 0.5 s after a director view change. roomCuts = Bolt room changes (info). 'cockpit visit' = frames with Bolt at z < -4.5 (doorway + cockpit).
import fs from 'fs'; import http from 'http'; import path from 'path';
import puppeteer from '/workspace/crave-lab/tools/cdp/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const ROOTS = { new: path.resolve(path.dirname(new URL(import.meta.url).pathname), '..') }; if (arg('--old')) ROOTS.old = path.resolve(arg('--old')); if (arg('--ref')) ROOTS.ref = path.resolve(arg('--ref')); // --ref DIR: a 2nd build to diff the per-frame camera track against
const HARNESS = `<!doctype html><html><body><canvas id="c"></canvas><script type="module">
import * as G from './game.mjs'; import { makePilot } from './pilot.mjs'; import { createRenderer } from './render.mjs'; import { m2View, EXTERIOR } from './director.mjs';
import * as THREE from './vendor/three.module.js';
function run(seed, m1, w, h) {
  const R = createRenderer(document.getElementById('c'), w, h, seed); R.scene.updateMatrixWorld(true); /* capture has drawn frames before any follow frame; placing without drawing needs world matrices */ const ev = JSON.parse(JSON.stringify(window.LOGS[(m1 ? 'm1_' : 'm2_') + seed]));
  G.reset(seed, { m1 }); const act = makePilot(G.state()); let o = G.observe(); const end = ev.find(e => e.type === 'run_end').tick;
  const s = { frames: 0, follow: 0, hardCuts: 0, cutsNearDirectorCut: 0, hardCutAt: [], jumps: 0, roomCuts: 0, atCap: 0, over015: 0, maxMove: 0, maxMoveAt: null, pitch60: 0, maxPitch: 0, maxPitchAt: null, near12: 0, far55: 0, maxDist: 0, minDist: 99, minDistAt: null, offscreen: 0,
    ck: { frames: 0, pitch60: 0, near12: 0, offscreen: 0, atCap: 0, maxPitch: 0, minDist: 99, views: {} }, capRuns: [], firstFlags: [] };
  let last = null, run = 0, lastViewChange = -1e9, prevView = null;
  // v3: camera clearance to props/handholds and 'prop filling the lens': 16x9 ray grid, hits within 1 m of the camera that land
  // on a prop collider box (not walls/floor) -> screen fraction
  const vis = (m) => { for (let q = m; q; q = q.parent) { if (!q.visible) return false; if (q === R.bolt) return false; } return true; };
  const meshes = []; R.scene.traverse(m => { if (m.isMesh && vis(m) && !m.userData.shadowProxy && m.material.colorWrite !== false) meshes.push(m); });
  const rc = new THREE.Raycaster(), ndc = new THREE.Vector2(), PROPS = G.LAYOUT.props;
  const inProp = (pt) => PROPS.find(([, mn, mx]) => pt.x > mn[0] - 0.03 && pt.x < mx[0] + 0.03 && pt.y > mn[1] - 0.03 && pt.y < mx[1] + 0.03 && pt.z > mn[2] - 0.03 && pt.z < mx[2] + 0.03);
  const boxD = (p, mn, mx) => Math.hypot(Math.max(mn[0] - p.x, 0, p.x - mx[0]), Math.max(mn[1] - p.y, 0, p.y - mx[1]), Math.max(mn[2] - p.z, 0, p.z - mx[2]));
  Object.assign(s, { minPropDist: 99, minPropName: null, minPropAt: null, minHandholdDist: 99, minHandholdAt: null, nearLensMax: 0, nearLensAt: null, nearLensName: null, nearLens5: 0, nearLens1: 0 }); const d = new THREE.Vector3(), v3 = new THREE.Vector3();
  while (o.tick < end) { for (let i = 0; i < 2; i++) o = G.step(act(o)).obs; const v = m2View(o, ev); if (EXTERIOR.has(v)) { last = null; continue; }
    if (v !== prevView) { lastViewChange = o.tick; prevView = v; } R.placeCam(o, v); const c = R.camera; c.updateMatrixWorld(); const p = c.position.clone(), room = o.pos[2] < -5 ? 'cockpit' : 'cabin', t = +o.t_s.toFixed(2); s.frames++; { s.camHash = s.camHash || 2166136261; for (const v of [p.x, p.y, p.z]) { s.camHash = Math.imul(s.camHash ^ Math.round(v * 1000), 16777619) >>> 0; } s.lastDiff = s.lastDiff; (s.camTrack ||= []).push([+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)]); } if (v === 'follow') s.follow++;
    c.getWorldDirection(d); const pitch = Math.asin(-d.y) * 180 / Math.PI, head = new THREE.Vector3(o.pos[0], o.pos[1] + 0.3, o.pos[2]), dist = p.distanceTo(head);
    v3.set(o.pos[0], o.pos[1] + 0.15, o.pos[2]).project(c); const off = Math.abs(v3.x) > 1 || Math.abs(v3.y) > 1 || v3.z > 1;
    const ck = o.pos[2] < -4.5; if (window.TRACE && t >= TRACE[0] && t <= TRACE[1] && w < h === TRACE[2]) (s.trace ||= []).push([t, o.mode, o.pos.map(x => +x.toFixed(2)), +o.yaw.toFixed(2), p.toArray().map(x => +x.toFixed(2)), +dist.toFixed(2), JSON.stringify(R.camStats())]); const flag = (k) => { if (s.firstFlags.length < 8) s.firstFlags.push([k, t, v, +pitch.toFixed(0), +dist.toFixed(2)]); };
    { for (const [n, mn, mx] of PROPS) { const dd = boxD(p, mn, mx); if (dd < s.minPropDist) { s.minPropDist = +dd.toFixed(3); s.minPropName = n; s.minPropAt = t; } if (n.startsWith('handhold') && dd < s.minHandholdDist) { s.minHandholdDist = +dd.toFixed(3); s.minHandholdAt = t; } }
      let hits = 0, tot = 0; const names = {}; for (let gy = 0; gy < 9; gy++) for (let gx = 0; gx < 16; gx++) { tot++; ndc.set((gx + 0.5) / 8 - 1, (gy + 0.5) / 4.5 - 1); rc.setFromCamera(ndc, c); rc.far = 1.0; rc.near = 0.1;
        const h = rc.intersectObjects(meshes, false)[0]; if (h) { const pr = inProp(h.point); if (pr) { hits++; names[pr[0]] = (names[pr[0]] || 0) + 1; } } }
      const fr = hits / tot; if (fr > 0.05) { s.nearLens5++; flag('nearLens'); } if (fr > 0.01) s.nearLens1++; if (fr > s.nearLensMax) { s.nearLensMax = +fr.toFixed(3); s.nearLensAt = t; s.nearLensName = Object.keys(names).join(','); } }
    if (pitch > s.maxPitch) { s.maxPitch = +pitch.toFixed(1); s.maxPitchAt = t; } if (dist < s.minDist) { s.minDist = +dist.toFixed(2); s.minDistAt = t; }
    if (pitch > 60) { s.pitch60++; flag('pitch'); } if (dist > 5.5 && v === 'follow') { s.far55++; flag('far'); } if (v === 'follow') s.maxDist = Math.max(s.maxDist, +dist.toFixed(2)); if (dist < 1.2) { s.near12++; flag('near'); } if (off) { s.offscreen++; flag('offscreen'); }
    if (ck) { const k = s.ck; k.frames++; k.views[v] = (k.views[v] || 0) + 1; if (pitch > 60) k.pitch60++; if (dist < 1.2) k.near12++; if (off) k.offscreen++; k.maxPitch = Math.max(k.maxPitch, +pitch.toFixed(1)); k.minDist = Math.min(k.minDist, +dist.toFixed(2)); }
    if (last && last.view === v && v === 'follow') { const mv = p.distanceTo(last.p); if (mv > 0.25) { s.hardCuts++; s.hardCutAt.push(t); if (o.tick - lastViewChange <= 30) s.cutsNearDirectorCut++; } }
    if (last && last.view === v && v === 'follow') { if (last.room !== room) { s.roomCuts++; run = 0; } else { const m = p.distanceTo(last.p);
      if (m > s.maxMove) { s.maxMove = +m.toFixed(3); s.maxMoveAt = t; } if (m > 0.25) { s.jumps++; flag('jump'); } if (m > 0.1505) s.over015++;
      if (m >= 0.149) { s.atCap++; if (ck) s.ck.atCap++; run++; } else { if (run >= 3) s.capRuns.push([t, run]); run = 0; } } }
    last = { p, room, view: v }; }
  s.capRuns = s.capRuns.slice(0, 6); s.camStats = R.camStats(); return s;
}
window.run = run; window.TRACE = JSON.parse(new URLSearchParams(location.search).get('trace') || 'null'); document.title = 'READY';
</script></body></html>`;
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript' };
const srv = http.createServer((q, s) => { const u = decodeURI(q.url.split('?')[0]); const m = u.match(/^\/([a-z0-9_]+)\/(.*)$/); if (!m || !ROOTS[m[1]]) { s.writeHead(404); return s.end(); }
  if (m[2] === '__cam.html') { s.writeHead(200, { 'content-type': 'text/html' }); return s.end(HARNESS); }
  const f = path.join(ROOTS[m[1]], m[2]); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); }); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
const out = {}; const RUNS = [['ep1_m1_seed1', 1, true], ['m2_seed1', 1, false], ['m1_seed2', 2, true], ['m2_seed2', 2, false]].filter(r => !arg('--only') || r[0] === arg('--only')), SIZES = [['16x9', 192, 108], ['9x16', 108, 192]];
try { for (const b of Object.keys(ROOTS)) { out[b] = {};
  // logs from the build itself (each build's own runs/), so old = old times, new = new times
  const logs = {}; for (const sd of [1, 2]) { logs['m1_' + sd] = JSON.parse(fs.readFileSync(path.join(ROOTS[b], `runs/m1/events_seed${sd}.json`))).events; logs['m2_' + sd] = JSON.parse(fs.readFileSync(path.join(ROOTS[b], `runs/events_seed${sd}.json`))).events; }
  for (const [rn, seed, m1] of RUNS) for (const [sn, w, h] of SIZES) { const page = await browser.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.evaluateOnNewDocument((l) => { window.LOGS = l; }, logs);
    await page.goto(`http://127.0.0.1:${srv.address().port}/${b}/__cam.html` + (arg('--trace') ? '?trace=' + encodeURIComponent(arg('--trace')) : '')); await page.waitForFunction(() => window.run, { timeout: 60000 });
    const r = await page.evaluate((s, m, w, h) => window.run(s, m, w, h), seed, m1, w, h); r.errors = errs; out[b][rn + '_' + sn] = r; await page.close();
    console.log(b.padEnd(4), (rn + '_' + sn).padEnd(20), JSON.stringify({ follow: r.follow, hardCuts: r.hardCuts, cutsNearDirectorCut: r.cutsNearDirectorCut, hardCutAt: r.hardCutAt.slice(0, 4), jumps: r.jumps, roomCuts: r.roomCuts, atCap: r.atCap, over015: r.over015, maxMove: r.maxMove, maxMoveAt: r.maxMoveAt, pitch60: r.pitch60, maxPitch: r.maxPitch, near12: r.near12, minDist: r.minDist, minPropDist: r.minPropDist, minPropName: r.minPropName, minHandholdDist: r.minHandholdDist, minHandholdAt: r.minHandholdAt, nearLens1: r.nearLens1, nearLens5: r.nearLens5, nearLensMax: r.nearLensMax, nearLensAt: r.nearLensAt, nearLensName: r.nearLensName, far55: r.far55, maxDist: r.maxDist, offscreen: r.offscreen, camStats: r.camStats }));
    console.log('     cockpit visit', JSON.stringify(r.ck), 'capRuns', JSON.stringify(r.capRuns), 'first', JSON.stringify(r.firstFlags.slice(0, 4)), errs.length ? errs : ''); if (r.trace) for (const x of r.trace) console.log('   ', JSON.stringify(x)); } } }
finally { await browser.close(); srv.close(); }
// per-frame camera track vs every other build: frames whose camera differs by > 1 mm (same frame index), first such time, max difference
for (const b of Object.keys(out)) if (b !== 'new') for (const k of Object.keys(out.new)) { const A = out.new[k].camTrack, B = out[b][k] && out[b][k].camTrack; if (!A || !B) continue;
  let n = 0, first = null, mx = 0; for (let i = 0; i < Math.min(A.length, B.length); i++) { const d = Math.hypot(A[i][0] - B[i][0], A[i][1] - B[i][1], A[i][2] - B[i][2]); if (d > 0.001) { n++; if (first == null) first = +(i / 30).toFixed(2); } mx = Math.max(mx, d); }
  const line = { framesDiffer: n, of: A.length, firstDiff_s: first, maxDiff_m: +mx.toFixed(3) }; (out.new[k].trackVs ||= {})[b] = line; console.log('track new vs', b.padEnd(4), k.padEnd(20), JSON.stringify(line)); }
for (const b of Object.keys(out)) for (const k of Object.keys(out[b])) delete out[b][k].camTrack;
fs.writeFileSync(path.join(ROOTS.new, 'tests', 'cam_check_result.json'), JSON.stringify(out, null, 1));
