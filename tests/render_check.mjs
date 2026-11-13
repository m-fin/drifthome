// Headless render checks (one Chrome, SwiftShader, closed at the end; local http server closed too).
//   node tests/render_check.mjs [--old DIR] [--stills OUTDIR] [--no-cam] (follow-camera checks now live in tests/cam_check.mjs)
// 1. wall flicker: camera dollies in 2 mm steps at fixed poses through cabin + cockpit; every mesh drawn in a flat ID colour;
//    counts pixels whose surface ID flips between consecutive frames away from ID edges (z-fighting), and which mesh pairs.
//    Also a lit pass: interior wall pixels whose brightness jumps > 24/255 between 2 mm steps (shadow acne shimmer).
// 2. follow camera: Ep1 (M1 seed 1) and the M2 seed 1 cabin legs, rendered frame by frame at 30 fps exactly like capture.html;
//    counts per-frame camera jumps > 0.25 m with no room change / view change, and frames with the camera outside open space.
// --old DIR runs the same checks on a pre-fix copy for before/after numbers. --stills writes up to 6 PNGs.
import fs from 'fs'; import http from 'http'; import path from 'path';
import puppeteer from '/workspace/crave-lab/tools/cdp/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const ROOTS = { new: path.resolve(path.dirname(new URL(import.meta.url).pathname), '..') }; if (arg('--old')) ROOTS.old = path.resolve(arg('--old'));
const BUNDLES = process.argv.flatMap((a, i) => a === '--bundle' ? [process.argv[i + 1].split('=')] : []); for (const [n, d] of BUNDLES) ROOTS[n] = path.resolve(d);
const STILLS = arg('--stills'), CAM_ONLY = process.argv.includes('--cam-only');
const HARNESS = `<!doctype html><html><body style="margin:0;background:#000"><canvas id="c"></canvas><script type="module">
import * as G from './game.mjs'; import { makePilot } from './pilot.mjs'; import { createRenderer } from './render.mjs'; import { m2View } from './director.mjs';
import * as THREE from './vendor/three.module.js';
let R = null, W = 0, H = 0;
function init(w, h, debug = false) { W = w; H = h; const c = document.getElementById('c'); R = createRenderer(c, w, h, 1, { debug }); R.renderer.shadowMap.autoUpdate = false; R.renderer.shadowMap.needsUpdate = true; return true; }
const gl = () => R.renderer.getContext();
function read() { const g = gl(), px = new Uint8Array(W * H * 4); g.readPixels(0, 0, W, H, g.RGBA, g.UNSIGNED_BYTE, px); return px; }
function idPass(on) { // swap every mesh to a flat ID colour (and hide points/sprites/lines/Bolt) or restore
  if (on) { R._ids = []; R.scene.traverse(m => { if (m.isMesh && m.material.colorWrite === false) { m.userData.vis = m.visible; m.visible = false; return; } /* v3: shadow-only proxies never reach the screen; unnumbered so the other IDs match the old build */ if (m.isMesh) { const id = R._ids.length + 1; R._ids.push(m); m.userData.mat = m.material; m.material = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB((id & 255) / 255, ((id >> 8) & 255) / 255, 0, THREE.SRGBColorSpace), toneMapped: false, side: m.userData.mat.side });
      m.userData.vis = m.visible; if (m.material && (m.userData.mat.transparent)) m.visible = false; } else if (m.isPoints || m.isSprite || m.isLine) { m.userData.vis = m.visible; m.visible = false; } });
    R.bolt && (R.bolt.visible = false); R._tm = R.renderer.toneMapping; R.renderer.toneMapping = THREE.NoToneMapping; R._bg = R.scene.background; R.scene.background = new THREE.Color(0, 0, 0); }
  else { R.scene.traverse(m => { if (m.userData.mat) { m.material = m.userData.mat; delete m.userData.mat; } if ('vis' in m.userData) { m.visible = m.userData.vis; delete m.userData.vis; } }); R.bolt && (R.bolt.visible = true); R.renderer.toneMapping = R._tm; R.scene.background = R._bg; }
}
function boltOff() { R.scene.traverse(m => { if (m.isGroup && m.children.length > 8 && !m.parent?.isGroup) {} }); }
function desc(m) { if (!m) return 'background'; const b = new THREE.Box3().setFromObject(m), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()); return m.geometry.type.replace('Geometry', '') + ' c[' + c.toArray().map(x => x.toFixed(2)) + '] s[' + s.toArray().map(x => x.toFixed(2)) + ']'; }
// dolly sweep: N frames from p0 toward dir in 2 mm steps, looking at target
function sweep(p0, target, dir, N = 16, step = 0.002) { // counts A->B->A oscillations (z-fighting toggles; moving edges don't come back)
  const cam = R.camera, d = new THREE.Vector3(...dir).normalize(); const fr = []; const pairs = {}; let flips = 0;
  idPass(true);
  for (let k = 0; k < N; k++) { cam.position.set(...p0).addScaledVector(d, k * step); cam.lookAt(...target); R.renderer.render(R.scene, cam);
    const px = read(), id = new Int32Array(W * H); for (let i = 0; i < W * H; i++) id[i] = px[i * 4] | (px[i * 4 + 1] << 8); fr.push(id);
    if (fr.length >= 3) { const a = fr[fr.length - 3], b = fr[fr.length - 2], c = id;
      for (let i = 0; i < W * H; i++) if (a[i] === c[i] && b[i] !== a[i]) { flips++; const key = [a[i], b[i]].sort((x, y) => x - y).join('|'); pairs[key] = (pairs[key] || 0) + 1; } }
    if (fr.length > 3) fr.shift(); }
  idPass(false);
  const top = Object.entries(pairs).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => { const [a, b] = k.split('|').map(Number); return { n, a: desc(R._ids[a - 1]), b: desc(R._ids[b - 1]) }; });
  return { flips, pct: +(100 * flips / (W * H * (N - 2))).toFixed(4), top };
}
function sweepOld(p0, target, dir, N = 16, step = 0.002) {
  const cam = R.camera, d = new THREE.Vector3(...dir).normalize(); let prev = null, flips = 0, interior = 0; const pairs = {};
  idPass(true);
  for (let k = 0; k < N; k++) { cam.position.set(...p0).addScaledVector(d, k * step); cam.lookAt(...target); R.renderer.render(R.scene, cam);
    const px = read(), id = new Int32Array(W * H); for (let i = 0; i < W * H; i++) id[i] = px[i * 4] | (px[i * 4 + 1] << 8);
    if (prev) for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { const i = y * W + x; let edge = false;
      for (let dy = -2; dy <= 2 && !edge; dy++) for (let dx = -2; dx <= 2; dx++) { const j = i + dy * W + dx; if (id[j] !== id[i] || prev[j] !== prev[i]) { edge = true; break; } }
      if (edge) { if (id[i] !== prev[i]) { /* moved edge */ } continue; } interior++; }
    if (prev) for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { const i = y * W + x; if (id[i] === prev[i]) continue;
      // flip in a region that is uniform in BOTH frames within 2 px is not motion: count
      let sameA = 0, sameB = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const j = i + dy * W + dx; if (prev[j] === prev[i]) sameA++; if (id[j] === id[i]) sameB++; }
      if (sameA <= 18 && sameB <= 18) { flips++; const key = [prev[i], id[i]].sort((a, b) => a - b).join('|'); pairs[key] = (pairs[key] || 0) + 1; } }
    prev = id; }
  idPass(false);
  const top = Object.entries(pairs).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => { const [a, b] = k.split('|').map(Number); return { n, a: desc(R._ids[a - 1]), b: desc(R._ids[b - 1]) }; });
  return { flips, pct: +(100 * flips / (W * H * (N - 1))).toFixed(4), top };
}
function litSweep(p0, target, dir, N = 10, step = 0.002) { // brightness shimmer on non-edge pixels
  const cam = R.camera, d = new THREE.Vector3(...dir).normalize(); let prev = null, jumps = 0; R.bolt && (R.bolt.visible = false);
  for (let k = 0; k < N; k++) { cam.position.set(...p0).addScaledVector(d, k * step); cam.lookAt(...target); R.renderer.render(R.scene, cam); const px = read(); const Y = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) Y[i] = 0.3 * px[i * 4] + 0.59 * px[i * 4 + 1] + 0.11 * px[i * 4 + 2];
    if (prev) for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) { const i = y * W + x; if (Math.abs(Y[i] - prev[i]) > 24 && Math.abs(prev[i - 1] - prev[i + 1]) < 6 && Math.abs(prev[i - W] - prev[i + W]) < 6) jumps++; }
    prev = Y; }
  R.bolt && (R.bolt.visible = true); return { jumps, pct: +(100 * jumps / (W * H * (N - 1))).toFixed(4) };
}
const L = G.LAYOUT, M = 0.1;
function inOpen(p) { const [x, y, z] = p;
  const cab = Math.abs(x) <= 6 - M && y >= M && y <= 4 - M && z >= -5 + M && z <= 5 - M, ckp = Math.abs(x) <= 3 - M && y >= M && y <= 3 - M && z >= -9 + M && z <= -5.2 - M;
  const door = Math.abs(x) <= 0.975 - M && y >= M && y <= 2.575 - M && z > -5.4 && z < -4.8; if (!(cab || ckp || door)) return 'outside_rooms';
  for (const [n, mn, mx] of L.props) if (x > mn[0] - 0.02 && x < mx[0] + 0.02 && y > mn[1] - 0.02 && y < mx[1] + 0.02 && z > mn[2] - 0.02 && z < mx[2] + 0.02) return 'inside_' + n; return null; }
// follow-camera run exactly like capture.html (2 ticks per frame, director view per frame)
function camRun(seed, m1, maxTick) {
  G.reset(seed, { m1 }); const act = makePilot(G.state()); let o = G.observe(); const ev = []; let last = null, jumps = [], bad = {}, frames = 0, cuts = 0;
  while (o.tick < maxTick) { for (let i = 0; i < 2; i++) { o = G.step(act(o)).obs; } frames++;
    const v = m2View(o, o.log); R.render(o, v); if (v !== 'follow' || (o.ship && (o.ship.mode === 'flight' || o.ship.mode === 'landed') && o.mode === 'seat')) { last = null; continue; }
    const p = R.camera.position.toArray(), room = o.pos[2] < -5 ? 'cockpit' : 'cabin'; const b = inOpen(p); if (b) bad[b] = (bad[b] || 0) + 1;
    if (last && last.room === room) { const d = Math.hypot(p[0] - last.p[0], p[1] - last.p[1], p[2] - last.p[2]); if (d > 0.25) jumps.push([+(o.t_s).toFixed(2), +d.toFixed(2), R.camStats ? R.camStats().pulls - (last.pulls || 0) : null, o.pos.map(x => +x.toFixed(2)), p.map(x => +x.toFixed(2))]); } else if (last) cuts++;
    last = { p, room, pulls: R.camStats ? R.camStats().pulls : 0 }; }
  return { frames, jumps: jumps.length, worst: jumps.reduce((a, j) => Math.max(a, j[1]), 0), first: jumps.slice(0, 6), roomCuts: cuts, outsideOpenSpace: bad, log: o.log.map(e => e.type + '@' + e.tick).join(' ') };
}
function still(o, view, debug = false) { R.renderer.shadowMap.needsUpdate = true; R.setDebug && R.setDebug(debug); R.render(o, view); return document.getElementById('c').toDataURL('image/png').split(',')[1]; }
function stillAt(seed, m1, tick, view, debug) { G.reset(seed, { m1 }); const act = makePilot(G.state()); let o = G.observe(); while (o.tick < tick) o = G.step(act(o)).obs; return still(o, view, debug); }
function stillCam(pos, look) { R.renderer.shadowMap.needsUpdate = true; G.reset(1, { m1: true }); const o = G.observe(); R.render(o, 'wide'); R.camera.position.set(...pos); R.camera.lookAt(...look); R.renderer.render(R.scene, R.camera); return document.getElementById('c').toDataURL('image/png').split(',')[1]; }
window.H = { init, sweep, litSweep, camRun, stillAt, stillCam };
document.title = 'HREADY';
</script></body></html>`;
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript' };
const srv = http.createServer((q, s) => { const u = decodeURI(q.url.split('?')[0]); const m = u.match(/^\/([a-z0-9_]+)\/(.*)$/); if (!m || !ROOTS[m[1]]) { s.writeHead(404); return s.end(); }
  if (m[2] === '__harness.html') { s.writeHead(200, { 'content-type': 'text/html' }); return s.end(HARNESS); }
  const f = path.join(ROOTS[m[1]], m[2]); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); }); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, protocolTimeout: 0, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--window-size=640,360'] });
const SWEEPS = [ // [name, camera start, look-at, dolly direction]
  ['door_wall_oblique', [3.2, 2.2, 2.5], [-1.5, 2.4, -5], [1, 0, 0]], ['door_wall_left', [-3.5, 1.6, 2.0], [1.5, 2.6, -5], [0, 1, 0]],
  ['door_wall_straight', [0.4, 1.8, 3.5], [0, 2.4, -5], [1, 0, 0]], ['window_wall', [-3, 2.0, 1.5], [6, 2.2, -1], [0, 0, 1]],
  ['wide_ep1', [4.6, 3.3, -3.6], [-3, 0.9, 2.2], [1, 0, 0]], ['floor_rug_grazing', [0.2, 0.6, 4.4], [0, 0, -3], [1, 0, 0]],
  ['cockpit_view', [2.2, 1.9, -5.8], [0, 1.2, -7.4], [0, 1, 0]], ['cockpit_back_to_door', [1.2, 1.6, -8.4], [0, 1.6, -5], [1, 0, 0]],
  // door-wall seams at x=+-1 above the door (Polish #3 / Playtest #5): close under the lintel, from the cabin and from the cockpit
  ['lintel_close_cabin', [0.3, 2.0, -4.2], [-1, 3.0, -5], [1, 0, 0]], ['lintel_close_cockpit', [0.4, 1.9, -6.3], [1, 3.0, -5.2], [1, 0, 0]],
];
const out = { when: new Date().toString(), builds: {} };
try {
  for (const b of Object.keys(ROOTS).filter(k => k === 'new' || k === 'old')) {
    const page = await browser.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.setViewport({ width: 480, height: 270 }); await page.goto(`http://127.0.0.1:${srv.address().port}/${b}/__harness.html`); await page.waitForFunction(() => window.H, { timeout: 60000 });
    const r = out.builds[b] = { sweeps: {}, lit: {}, cam: {} };
    await page.evaluate(() => H.init(480, 270));
    if (!CAM_ONLY) for (const [n, p, t, d] of SWEEPS) { r.sweeps[n] = await page.evaluate((p, t, d) => H.sweep(p, t, d), p, t, d); r.lit[n] = await page.evaluate((p, t, d) => H.litSweep(p, t, d), p, t, d); console.error(b, n, r.sweeps[n].flips, r.lit[n].jumps); }
    if (!process.argv.includes('--no-cam')) { await page.evaluate(() => H.init(96, 54));
    r.cam.ep1_m1_seed1 = await page.evaluate(() => H.camRun(1, true, 2280)); console.error(b, 'cam m1', r.cam.ep1_m1_seed1.jumps);
    if (!process.argv.includes('--quick')) r.cam.m1_seed2 = await page.evaluate(() => H.camRun(2, true, 2280)); r.camStats = await page.evaluate(() => window.H.stats && H.stats());
    if (!process.argv.includes('--quick')) r.cam.m2_seed1 = await page.evaluate(() => H.camRun(1, false, 9300)); console.error(b, 'cam m2', r.cam.m2_seed1?.jumps); }
    if (STILLS) { fs.mkdirSync(STILLS, { recursive: true }); await page.evaluate(() => H.init(1280, 720)); const tag = b === 'new' ? 'after' : 'before';
      const save = (name, b64) => { const f = `${STILLS}/${name}.png`; fs.writeFileSync(f, Buffer.from(b64, 'base64')); (out.stills ||= []).push(f); };
      save(`walls_door_${tag}`, await page.evaluate(() => H.stillCam([3.2, 2.2, 2.5], [-1.5, 2.4, -5])));
      save(`door_lintel_seam_${tag}`, await page.evaluate(() => H.stillCam([0.3, 2.0, -4.2], [-1, 3.0, -5])));
      save(`door_wall_wedge_${tag}`, await page.evaluate(() => H.stillCam([0, 1.75, 4.2], [0, 1.9, -5]))); // Polish v2 evidence/door_wall_v2_dark_wedge.png viewpoint
      save(`cockpit_light_${tag}`, await page.evaluate(() => H.stillCam([1.6, 1.7, -8.5], [-0.3, 1.5, -5.2]))); // cockpit lit only by its own lights (no cabin-lamp leak through the door wall)
      save(`bed_wake_wide_${tag}`, await page.evaluate(() => H.stillAt(1, true, 60, 'wide', false)));
      if (b === 'new') save('colliders_debug_after', await page.evaluate(() => H.stillAt(1, true, 520, 'wide', true)));
    }
    r.pageErrors = errs; await page.close();
  }
  for (const [n] of BUNDLES) { // rh_capture.mjs contract: cap.init(seed, W, H, events) then cap.frame(2)
    const page = await browser.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); await page.setViewport({ width: 480, height: 270 });
    await page.goto(`http://127.0.0.1:${srv.address().port}/${n}/capture.html`); await page.waitForFunction(() => window.cap, { timeout: 60000 });
    const ev = JSON.parse(fs.readFileSync(path.join(ROOTS[n], 'runs/events_seed1.json'))).events;
    const r0 = await page.evaluate((e) => { const f = window.cap.init(1, 480, 270, e); return { tick: f.tick, jpg: f.jpg.length }; }, ev); const fr = [];
    for (let k = 0; k < 3; k++) fr.push(await page.evaluate(() => { const f = window.cap.frame(2); return { tick: f.tick, view: f.view, jpg: f.jpg.length }; }));
    (out.contract ||= {})[n] = { init: r0, frames: fr, errors: errs, m1: !ev.some(e => e.type === 'launch') }; await page.close(); }
} finally { await browser.close(); srv.close(); }
const f = path.join(ROOTS.new, 'tests', 'render_check_result.json'); fs.writeFileSync(f, JSON.stringify(out, null, 1)); console.log('wrote', f);
console.log('contract', JSON.stringify(out.contract)); console.log('stills', out.stills);
for (const [b, r] of Object.entries(out.builds)) { console.log(`== ${b}`); for (const n in r.sweeps) console.log(n.padEnd(22), 'zfight flips', r.sweeps[n].flips, `(${r.sweeps[n].pct}%)`, '| lit shimmer', r.lit[n].jumps, r.sweeps[n].top[0] ? '| top: ' + r.sweeps[n].top[0].a + ' <> ' + r.sweeps[n].top[0].b : '');
  for (const n in r.cam) console.log('cam', n, JSON.stringify({ ...r.cam[n], log: undefined })); console.log('errors', r.pageErrors); }
