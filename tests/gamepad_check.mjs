// Headless gamepad test of live play (index.html?manual=1, one headless Chrome + local server, both closed at the end).
// navigator.getGamepads() is stubbed with a standard-mapping pad; the page reads it exactly as in live play (dh.tick(n, {pad:true})).
//   node tests/gamepad_check.mjs   (the old build ignores {pad:true} in dh.tick, so there is no --old run; Playtest Lead's
//   9:48 numbers are the baseline: 0 m vertical on the pad, 30% stick = 96% speed, LT = full-speed reverse)
// 1. up/down in zero-g: RB / D-pad up = up, LB / D-pad down = down (vs keyboard Space/C)
// 2. reach every ceiling handhold and lamp with the pad only (left stick + RB/LB)
// 3. analog: stick inside the deadzone = no move; 30% push = proportional speed (not ~96%); full = full speed
// 4. LT brakes: walking it scales the move down (no reverse); floating it stops Bolt without flying him backwards
// 5. pad input during Self-Driving hands control back (RB alone too)
import fs from 'fs'; import http from 'http'; import path from 'path';
import puppeteer from '/workspace/crave-lab/tools/cdp/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const ROOTS = { new: path.resolve(path.dirname(new URL(import.meta.url).pathname), '..') }; if (arg('--old')) ROOTS.old = path.resolve(arg('--old'));
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript' };
const srv = http.createServer((q, s) => { const u = decodeURI(q.url.split('?')[0]); const m = u.match(/^\/([a-z0-9_]+)\/(.*)$/); if (!m || !ROOTS[m[1]]) { s.writeHead(404); return s.end(); }
  const f = path.join(ROOTS[m[1]], m[2]); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); }); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, protocolTimeout: 0, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
const STUB = () => { const btn = () => ({ pressed: false, value: 0 }); window.__pad = { id: 'stub Xbox', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: [...Array(17)].map(btn), timestamp: 0 };
  navigator.getGamepads = () => [window.__pad, null, null, null];
  window.padSet = (o = {}) => { const p = window.__pad; p.axes = [0, 0, 0, 0]; p.buttons.forEach(b => { b.pressed = false; b.value = 0; }); if (o.axes) o.axes.forEach((v, i) => p.axes[i] = v);
    for (const [k, v] of Object.entries(o.btn || {})) { p.buttons[k].value = v; p.buttons[k].pressed = v > 0.1; } }; };
const PAGE = () => {
  const T = (n, o) => window.dh.tick(n, { pad: true, noshow: true, ...(o || {}) });
  const tap = (b) => { padSet({ btn: { [b]: 1 } }); T(1); padSet(); T(1); };
  const toFloat = () => { padSet(); T(1); tap(0); T(30); tap(0); T(2); return dh.o.mode; }; // A wakes, A again = float
  const R = {};
  // 1. up/down
  { const rest = () => { padSet({ btn: { 6: 1 } }); T(120); padSet(); T(1); return dh.o.pos[1]; }; // LT to a stop before each 0.8 s press (keyboard Space from rest: +0.64 m)
    toFloat(); const y0 = rest(); padSet({ btn: { 5: 1 } }); T(48); const yRB = dh.o.pos[1]; const y1 = rest(); padSet({ btn: { 4: 1 } }); T(48); const yLB = dh.o.pos[1];
    const y2 = rest(); padSet({ btn: { 12: 1 } }); T(48); const yDU = dh.o.pos[1]; const y3 = rest(); padSet({ btn: { 13: 1 } }); T(48); const yDD = dh.o.pos[1];
    rest(); const yk = dh.o.pos[1]; padSet(); dh.tick(48, { keys: ['Space'], noshow: true }); const yKB = dh.o.pos[1];
    R.updown = { mode: dh.o.mode, keyboard_space_0p8s: +(yKB - yk).toFixed(3), RB_up_0p8s: +(yRB - y0).toFixed(3), LB_down_0p8s: +(yLB - y1).toFixed(3), dpad_up: +(yDU - y2).toFixed(3), dpad_down: +(yDD - y3).toFixed(3) }; }
  // 2. reach handholds + lamps with the pad
  const L = dh.layout; const targets = [];
  L.handholds.forEach((h, i) => targets.push(['handhold_' + i, h, 'hh', i])); L.props.filter(p => p[0].startsWith('lamp_')).forEach(p => targets.push([p[0], p[1].map((v, i) => (v + p[2][i]) / 2), 'box', p]));
  R.reach = {};
  for (const [name, c, kind, extra] of targets) { location.hash = ''; dh.reset(); toFloat(); let got = false, k = 0, best = 99;
    for (k = 0; k < 60 * 25 && !got; k += 3) { const o = dh.o, P = o.pos; let C = c, aimY = kind === 'hh' ? c[1] - 0.3 : c[1] - BOLTUP - 0.02; // cockpit targets: line up on the doorway first, then fly through it
      if (c[2] < -5 && P[2] > -5.4) { C = Math.abs(P[0]) > 0.25 || P[2] > -3.9 ? [0, 0, -4.2] : [0, 0, -5.9]; aimY = 1.2; }
      const dx = C[0] - P[0], dz = C[2] - P[2], dy = aimY - P[1], dh2 = Math.hypot(dx, dz);
      const fx = Math.cos(o.yaw), fz = -Math.sin(o.yaw), sc = dh2 > 0.4 ? 1 : dh2 / 0.4; const f = (dx * fx + dz * fz) / (dh2 || 1) * sc, s = (-dx * fz + dz * fx) / (dh2 || 1) * sc;
      const ud = Math.abs(dy) < 0.08 ? 0 : Math.sign(dy) * Math.min(1, Math.abs(dy) / 0.4); const btn = ud > 0 ? { 5: ud } : ud < 0 ? { 4: -ud } : {};
      const v = o.vel, sp = Math.hypot(...v); if (dh2 < 0.6 && sp > 0.5 && C === c) btn[6] = 1; // LT brake near the target
      padSet({ axes: [s * 0.999, -f * 0.999, 0, 0], btn }); T(3);
      const Q = dh.o.pos; let d;
      if (kind === 'hh') { d = Math.hypot(extra === undefined ? 9 : c[0] - Q[0], c[1] - Q[1], c[2] - Q[2]); got = dh.o.near_handhold === extra && d < 0.9; }
      else { const [, mn, mx] = extra, qx = Math.max(mn[0], Math.min(mx[0], Q[0])), qz = Math.max(mn[2], Math.min(mx[2], Q[2])); d = Math.max(0, Math.hypot(Q[0] - qx, Q[2] - qz) - BOLTR) + Math.max(0, mn[1] - (Q[1] + BOLTUP)); got = d < 0.12; }
      best = Math.min(best, d); }
    R.reach[name] = { reached: got, s: +(k / 60).toFixed(1), closest: +best.toFixed(3) }; }
  // 3. analog walk speed
  const walkDist = (ax1, ticks = 90) => { dh.reset(); padSet(); T(1); tap(0); T(30); const p0 = [...dh.o.pos]; padSet({ axes: [0, ax1, 0, 0] }); T(ticks); padSet(); return +Math.hypot(dh.o.pos[0] - p0[0], dh.o.pos[2] - p0[2]).toFixed(3); };
  R.analog = { stick10: walkDist(-0.1), stick30: walkDist(-0.3), stick60: walkDist(-0.6), stick100: walkDist(-1) }; R.analog.ratio30 = +(R.analog.stick30 / R.analog.stick100).toFixed(3);
  // 4. LT brake
  { dh.reset(); padSet(); T(1); tap(0); T(30); const p0 = [...dh.o.pos]; padSet({ btn: { 6: 1 } }); T(90); R.brakeWalk = { moved_with_LT_only: +Math.hypot(dh.o.pos[0] - p0[0], dh.o.pos[2] - p0[2]).toFixed(3) }; }
  { dh.reset(); toFloat(); padSet({ btn: { 7: 1 } }); T(60); const v0 = [...dh.o.vel], s0 = Math.hypot(...v0); padSet({ btn: { 6: 1 } }); let minDot = 0, t = 0; for (; t < 180 && Math.hypot(...dh.o.vel) > 0.05; t++) { T(1); const v = dh.o.vel; minDot = Math.min(minDot, (v[0] * v0[0] + v[1] * v0[1] + v[2] * v0[2]) / s0); }
    T(60); const v = dh.o.vel; minDot = Math.min(minDot, (v[0] * v0[0] + v[1] * v0[1] + v[2] * v0[2]) / s0); R.brakeFloat = { speed_before: +s0.toFixed(3), stop_s: +(t / 60).toFixed(2), speed_after_1s_more: +Math.hypot(...v).toFixed(3), most_reverse_speed: +minDot.toFixed(3) }; }
  // 5. handoff
  { dh.reset(); toFloat(); dh.engage(); T(30); const was = !!dh.ap; padSet({ btn: { 5: 1 } }); T(2); padSet(); R.handoff = { selfDriving: was, afterRB: !!dh.ap }; }
  return R; };
const out = {}; let fails = 0, checks = 0; const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
try { for (const b of Object.keys(ROOTS)) { const page = await browser.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); await page.setViewport({ width: 320, height: 180 });
  await page.evaluateOnNewDocument(STUB); await page.goto(`http://127.0.0.1:${srv.address().port}/${b}/index.html?seed=1&manual=1&hud=0`); await page.waitForFunction(() => document.title === 'READY' && window.dh, { timeout: 60000 });
  // tiny test hooks (layout + reset) added from outside so the old build can run the same script
  await page.evaluate(async () => { const G = await import('./game.mjs'); window.BOLTUP = G.BOLT.up; window.BOLTR = G.BOLT.r; dh.layout = G.LAYOUT; dh.reset = () => { G.reset(1, { m1: true }); dh.tick(0, { noshow: true }); }; });
  const R = await page.evaluate(`(${PAGE.toString()})()`); R.errors = errs; out[b] = R; console.log(b, JSON.stringify(R)); await page.close(); } }
finally { await browser.close(); srv.close(); }
const n = out.new;
const kb = n.updown.keyboard_space_0p8s; ok(n.updown.mode === 'float' && kb > 0.4 && [n.updown.RB_up_0p8s, -n.updown.LB_down_0p8s, n.updown.dpad_up, -n.updown.dpad_down].every(v => Math.abs(v - kb) < 0.02), 'gamepad up/down ' + JSON.stringify(n.updown));
for (const [k, r] of Object.entries(n.reach)) ok(r.reached, `gamepad reach ${k} ${JSON.stringify(r)}`);
ok(n.analog.stick10 < 0.005 && n.analog.ratio30 > 0.1 && n.analog.ratio30 < 0.35 && n.analog.stick60 < n.analog.stick100 * 0.75, 'analog ' + JSON.stringify(n.analog));
ok(n.brakeWalk.moved_with_LT_only < 0.01, 'LT walk ' + JSON.stringify(n.brakeWalk)); ok(n.brakeFloat.stop_s < 2.5 && n.brakeFloat.most_reverse_speed > -0.05 && n.brakeFloat.speed_after_1s_more < 0.06, 'LT float ' + JSON.stringify(n.brakeFloat));
ok(n.handoff.selfDriving && !n.handoff.afterRB, 'handoff ' + JSON.stringify(n.handoff)); ok(!n.errors.length, 'page errors ' + n.errors);
fs.writeFileSync(path.join(ROOTS.new, 'tests', 'gamepad_check_result.json'), JSON.stringify(out, null, 1));
console.log(`${checks - fails}/${checks} gamepad checks passed`); process.exit(fails ? 1 : 0);
