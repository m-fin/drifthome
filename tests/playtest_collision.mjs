// Headless collision playtest (node only, no browser). node tests/playtest_collision.mjs  -> exit 0 = all pass
// A. push tests: Bolt driven straight into every prop from 8 directions (and from above/below where there is room),
//    walking and zero-g floating, for 3 s; then reversed for 2 s. Asserts: sim hull never overlaps any collider, the
//    rendered mesh never sinks > 1 cm into any collider, and he always backs out (not stuck).
// B. slide tests: diagonal pushes along long props; he must keep moving along the face (no sticking).
// C. reachability: from the bunk he reaches the cockpit seat area, the bed area and the window, walking and floating.
// D. scripted pilot, seeds 1-8, M1 + M2: zero hull and mesh overlaps every tick; same seed twice = identical log.
// G. jitter: plant/window-wall + big-crate corner pockets (regression, Playtest Lead 10:35) + a grid scan around every prop.
// H. door lintel collider == lintel trim mesh.
// I. cockpit side of the door wall: hull stops at its face (z -5.2).
// E. Self-Driving hand-off: 36 cases (6 start spots x walk/float x 3 player inputs) -> no overlap, no velocity snap, keeps touring.
import { reset, step, observe, state, LAYOUT, BOLT, propOverlaps, DT } from '../game.mjs';
import { makePilot, makeAutopilot, blendActions, HANDOFF_S, POI } from '../pilot.mjs';
import { makeBolt } from './bolt_mesh.mjs';
import fs from 'fs';
const mesh = makeBolt('new'); let fails = 0, checks = 0; const log = [];
const ok = (c, msg) => { checks++; if (!c) { fails++; log.push('FAIL ' + msg); } };
const meshBad = (o) => mesh.overlaps(o, 0.01).filter(x => x.name !== 'floor' || x.depth > 0.01);
function place(mode, pos, yaw = 0) { reset(1, { m1: true }); const s = state(); s.mode = mode; s.gravity = mode === 'walk'; s.pos = [...pos]; s.vel = [0, 0, 0]; s.yaw = yaw; return observe(); }
function drive(o, move, ticks, look) { let worst = null, maxMesh = 0;
  for (let k = 0; k < ticks; k++) { o = step({ move, look }).obs; const h = propOverlaps(o.pos); if (h.length && !worst) worst = { tick: k, h }; for (const m of meshBad(o)) maxMesh = Math.max(maxMesh, m.depth); }
  return { o, worst, maxMesh }; }
const clearAt = (p) => !propOverlaps(p).length;
// ---- A + B
const dirs = [...Array(8)].map((_, k) => [Math.cos(k * Math.PI / 4), 0, Math.sin(k * Math.PI / 4)]);
let pushN = 0;
for (const [name, mn, mx] of LAYOUT.props) {
  const c = mn.map((v, i) => (v + mx[i]) / 2), half = mn.map((v, i) => (mx[i] - v) / 2);
  for (const mode of ['walk', 'float']) {
    const ys = mode === 'walk' ? [BOLT.down] : [Math.min(Math.max(c[1] - (BOLT.up - BOLT.down) / 2, BOLT.down + 0.01), 3 - BOLT.up)];
    if (mode === 'walk' && mn[1] > BOLT.up + BOLT.down) continue; // high props (shelf, lamps, rings) can't be walked into
    const tests = dirs.map(d => ({ start: [c[0] - d[0] * (Math.max(half[0], half[2]) + BOLT.r + 0.9), ys[0], c[2] - d[2] * (Math.max(half[0], half[2]) + BOLT.r + 0.9)], move: d }));
    if (mode === 'float') { tests.push({ start: [c[0], mn[1] - BOLT.up - 0.6, c[2]], move: [0, 1, 0] }, { start: [c[0], mx[1] + BOLT.down + 0.6, c[2]], move: [0, -1, 0] }); }
    for (const t of tests) {
      const o0 = place(mode, t.start); const sp = o0.pos; // clampToShip may move it; skip starts that are invalid (inside walls/props or other room)
      if (!clearAt(sp) || Math.hypot(sp[0] - t.start[0], sp[2] - t.start[2]) > 0.05 || sp[1] < BOLT.down - 1e-6 || (o0.room === 'cockpit') !== (c[2] < -5)) continue;
      if (mode === 'float' && (t.start[1] < BOLT.down || t.start[1] > 4 - BOLT.up)) continue;
      pushN++;
      const look = Math.atan2(-t.move[2], t.move[0]);
      const a = drive(o0, t.move, 180, look); ok(!a.worst, `${name} ${mode} push ${t.move.map(x => x.toFixed(2))}: hull overlap ${JSON.stringify(a.worst)}`);
      ok(a.maxMesh <= 0.01, `${name} ${mode} push: mesh sinks ${a.maxMesh} m`);
      const p1 = [...a.o.pos], snap = JSON.parse(JSON.stringify(state())); let best = 0, bw = null; // back out: straight back first, then 4 other ways
      for (const bd of [t.move.map(x => -x), [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) { Object.assign(state(), JSON.parse(JSON.stringify(snap))); const b = drive(observe(), bd, 120, look + Math.PI);
        const back = Math.hypot(...b.o.pos.map((x, i) => x - p1[i])); if (b.worst) bw = b.worst; best = Math.max(best, back); if (back > 0.3) break; }
      ok(!bw && best > 0.3, `${name} ${mode} back-out: moved ${best.toFixed(2)} m ${JSON.stringify(bw)}`);
    }
  }
}
// slides: diagonal into long faces must keep moving along them
for (const [name, start, move] of [['bunk long side', [-2.6, BOLT.down, 2.0], [-0.7, 0, 0.7]], ['table front', [2.2, BOLT.down, 2.2], [0.6, 0, 0.8]], ['crates', [-3.2, BOLT.down, -2.8], [-0.7, 0, -0.7]], ['console', [-1.5, BOLT.down, -7.0], [0.6, 0, -0.8]]])
  for (const mode of ['walk', 'float']) { const o0 = place(mode, start); const r = drive(o0, move, 150); const p0 = r.o.pos; const r2 = drive(r.o, move, 60); const slid = Math.hypot(r2.o.pos[0] - p0[0], r2.o.pos[2] - p0[2]);
    ok(!r.worst && !r2.worst, `${name} ${mode} slide overlap`); ok(slid > 0.3 || Math.abs(r2.o.pos[0]) > 2.4 || Math.abs(r2.o.pos[2]) > 4.4, `${name} ${mode} slide: only moved ${slid.toFixed(2)} m along the face in 1 s (stuck?)`); }
// ---- C reachability (simple waypoint mover through the door; same fly controller as the pilot)
function goVia(mode, wps, maxS = 40) { let o = place(mode, [-2.6, mode === 'walk' ? BOLT.down : 1.2, 1.4]); let i = 0, bad = null;
  for (let k = 0; k < maxS * 60 && i < wps.length; k++) { const p = wps[i], d = p.map((x, j) => x - o.pos[j]); if (mode === 'walk') d[1] = 0; const dist = Math.hypot(...d); if (dist < 0.3) { i++; continue; }
    const move = mode === 'walk' ? [d[0] / dist, 0, d[2] / dist] : d.map((x, j) => Math.max(-1, Math.min(1, (x / dist * Math.min(1.4, dist * 0.9) - o.vel[j]) * 1.5)));
    o = step({ move, look: Math.atan2(-d[2], d[0]) }).obs; const h = propOverlaps(o.pos); if (h.length && !bad) bad = h; }
  return { reached: i >= wps.length, bad, at: o.pos.map(x => +x.toFixed(2)), t: o.t_s }; }
const Y = (m, y) => (m === 'walk' ? BOLT.down : y);
for (const mode of ['walk', 'float']) {
  const ck = goVia(mode, [[0, Y(mode, 1.2), -3.8], [0, Y(mode, 1.2), -6.0], [0, Y(mode, 1.2), -6.7]]); ok(ck.reached && !ck.bad, `${mode} reach cockpit seat area: ${JSON.stringify(ck)}`);
  const bed = goVia(mode, [[-3.1, Y(mode, 1.3), 1.4], [-3.1, Y(mode, 1.4), 3.2]]); ok(bed.reached && !bed.bad, `${mode} reach bed area: ${JSON.stringify(bed)}`);
  const win = goVia(mode, [[2.0, Y(mode, 1.8), 0.5], [5.2, Y(mode, 2.2), 0]]); ok(win.reached && !win.bad, `${mode} reach window: ${JSON.stringify(win)}`);
  log.push(`reach ${mode}: cockpit ${ck.reached} (${ck.t}s), bed ${bed.reached} (${bed.t}s), window ${win.reached} (${win.t}s)`);
}
// ---- D scripted pilot seeds 1-8
const runs = {};
for (const m1 of [true, false]) for (let seed = 1; seed <= 8; seed++) {
  const one = () => { reset(seed, { m1 }); const act = makePilot(state()); let o = observe(), hull = 0, mm = 0, worst = null; const end = m1 ? 2400 : 9600;
    while (o.tick < end && !(o.flags.window && o.tick > o.log.find(e => e.type === 'window_look').tick + 60)) { o = step(act(o)).obs; if (o.mode === 'seat') continue;
      const h = propOverlaps(o.pos); if (h.length) { hull++; worst ||= { tick: o.tick, h }; } if (o.tick % 2 === 0) for (const x of meshBad(o)) mm = Math.max(mm, x.depth); }
    return { log: o.log.map(e => e.type + '@' + e.tick).join(' '), hull, mm, worst }; };
  const a = one(), b = one(); runs[`${m1 ? 'M1' : 'M2'}_seed${seed}`] = a;
  ok(a.hull === 0, `pilot ${m1 ? 'M1' : 'M2'} seed ${seed}: ${a.hull} hull-overlap ticks ${JSON.stringify(a.worst)}`); ok(a.mm <= 0.01, `pilot seed ${seed} mesh sinks ${a.mm}`);
  ok(a.log === b.log, `pilot seed ${seed} not deterministic`); ok(a.log.includes('window_look'), `pilot seed ${seed}: no window_look`);
}
// ---- E Self-Driving hand-off, 36 cases
const starts = [['bunk_edge', [-3.2, 1.2, 2.2]], ['table', [1.4, 1.0, 2.6]], ['crates', [-3.4, 1.0, -3.4]], ['shelf_below', [-5.0, 1.6, -1.5]], ['doorway', [0, 1.15, -4.6]], ['cockpit', [0.8, 1.2, -6.4]]];
let hoN = 0;
for (const [sn, sp] of starts) for (const mode of ['walk', 'float']) for (const inp of ['idle', 'toward_prop', 'away']) {
  let o = place(mode, mode === 'walk' ? [sp[0], BOLT.down, sp[2]] : sp); const dirTo = sn === 'shelf_below' ? [-1, 0, 0] : sn === 'doorway' ? [1, 0, 0] : sn === 'cockpit' ? [0, 0, -1] : [-1, 0, 1];
  const pm = inp === 'idle' ? [0, 0, 0] : inp === 'toward_prop' ? dirTo : dirTo.map(x => -x); let bad = null, snap = 0;
  for (let k = 0; k < 60; k++) { o = step({ move: pm, look: o.yaw }).obs; const h = propOverlaps(o.pos); if (h.length) bad ||= h; }
  const ap = makeAutopilot(o); let t = 0; const seen = new Set(); let prevV = [...o.pos];
  for (let k = 0; k < 40 * 60; k++) { t += DT; o = step(blendActions({ move: pm, look: o.yaw }, ap.act(o), Math.min(1, t / HANDOFF_S))).obs; seen.add(ap.poi.replace(' (side-step)', ''));
    const dp = Math.hypot(...o.pos.map((v, i) => v - prevV[i])); if (dp > snap) snap = dp; prevV = [...o.pos]; const h = propOverlaps(o.pos); if (h.length) bad ||= { k, h }; }
  hoN++; ok(!bad, `handoff ${sn}/${mode}/${inp}: overlap ${JSON.stringify(bad)}`); ok(snap <= 2 * 1.8 * DT, `handoff ${sn}/${mode}/${inp}: position jump ${snap.toFixed(3)} m in one tick (max speed step is ${(1.8 * DT).toFixed(3)})`); ok(seen.size >= 3, `handoff ${sn}/${mode}/${inp}: autopilot stuck (visited ${[...seen]})`);
}
// ---- F Self-Driving started while Bolt is asleep on the bunk (Polish baseline: legs sank ~6 cm into the blanket here)
{ reset(1, { m1: true }); let o = observe(); const ap = makeAutopilot(o); let t = 0, mm = 0, hull = 0;
  for (let k = 0; k < 5 * 60; k++) { t += DT; o = step(blendActions({ move: [0, 0, 0] }, ap.act(o), Math.min(1, t / HANDOFF_S))).obs; if (propOverlaps(o.pos).length) hull++; for (const x of meshBad(o)) mm = Math.max(mm, x.depth); }
  ok(hull === 0 && mm <= 0.01, `self-driving from the bunk: hull ticks ${hull}, mesh sinks ${mm} m`); log.push(`self-driving from bunk: hull overlap ticks ${hull}, deepest mesh sink ${mm} m`); }
// ---- G jitter (Playtest Lead 10:35: plant/window-wall pocket snapped back 13-17 cm ~6x/s, big-crate corner 3 cm sawtooth).
// Hold input into the pocket for 4 s; per tick, the backward move (against the input) must stay <= 1.5 cm and there must be
// no repeating snaps (> 5 mm backward on more than 2 ticks). Then a grid scan: every prop, 24 spots around it just outside
// contact, input toward it and +-45 deg, walk + float, 1.5 s each.
function jitter(mode, pos, move, ticks = 240) { const o0 = place(mode, pos); let o = o0, prev = [...o.pos], back = 0, snaps = 0, ov = 0; const m = Math.hypot(move[0], move[2]), u = [move[0] / m, 0, move[2] / m];
  for (let k = 0; k < ticks; k++) { o = step({ move }).obs; const d = o.pos.map((x, i) => x - prev[i]), b = -(d[0] * u[0] + d[2] * u[2]); if (k > 5) { back = Math.max(back, b); if (b > 0.005) snaps++; } if (propOverlaps(o.pos, 0.001).length) ov++; prev = [...o.pos]; }
  return { back: +back.toFixed(4), snaps, ov }; }
let jitN = 0, jitWorst = { back: 0 };
for (const mode of ['walk', 'float']) { const y = mode === 'walk' ? BOLT.down : 1.0;
  for (const [name, pos, moves] of [['plant/window-wall pocket', [5.5, y, 3.3], [[0, 0, 1], [0.5, 0, 1], [1, 0, 1], [-0.3, 0, 1], [1, 0, 0.3]]],
    ['big-crate/corner pocket', [-5.55, y, -4.55], [[1.55, 0, 0.35], [1, 0, 0], [1, 0, 1], [0, 0, 1], [1, 0, -0.3]]]])
    for (const mv of moves) { const r = jitter(mode, pos, mv); jitN++; ok(r.back <= 0.015 && r.snaps <= 2 && r.ov === 0, `jitter ${name} ${mode} move ${mv}: max back ${r.back} m/tick, snaps ${r.snaps}, overlap ticks ${r.ov}`);
      log.push(`jitter ${name} ${mode} [${mv}] max back ${r.back} m/tick, snaps>5mm ${r.snaps}`); } }
let scanN = 0, scanBad = 0, scanWorst = { back: 0 };
for (const [name, mn, mx] of LAYOUT.props) for (const mode of ['walk', 'float']) { const cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2, hx = (mx[0] - mn[0]) / 2, hz = (mx[2] - mn[2]) / 2;
  const y = mode === 'walk' ? BOLT.down : Math.min(3.0, Math.max(0.9, (mn[1] + mx[1]) / 2));
  for (let k = 0; k < 24; k++) { const a = k * Math.PI / 12, dx = Math.cos(a), dz = Math.sin(a), t = Math.min(hx / Math.max(1e-9, Math.abs(dx)), hz / Math.max(1e-9, Math.abs(dz)));
    const sp = [cx + dx * (t + BOLT.r + 0.05), y, cz + dz * (t + BOLT.r + 0.05)]; if (!clearAt(sp)) continue; place(mode, sp); const o0 = step({ move: [0, 0, 0] }).obs; if (Math.hypot(o0.pos[0] - sp[0], o0.pos[2] - sp[2]) > 1e-6 || !clearAt(o0.pos)) continue; // start must be a valid in-ship spot
    for (const da of [0, Math.PI / 4, -Math.PI / 4]) { const b = a + Math.PI + da, r = jitter(mode, sp, [Math.cos(b), 0, Math.sin(b)], 90); scanN++; if (r.back > 0.02 || r.snaps > 2 || r.ov) { scanBad++; (globalThis.SCANBAD ||= []).push({ ...r, name, mode, sp: sp.map(x => +x.toFixed(2)), dir: +((b * 180 / Math.PI) % 360).toFixed(0) }); if (r.back >= scanWorst.back) scanWorst = { ...r, name, mode, sp: sp.map(x => +x.toFixed(2)), dir: +((b * 180 / Math.PI) % 360).toFixed(0) }; } } } }
ok(scanBad === 0, `jitter grid scan: ${scanBad}/${scanN} runs with a > 2 cm backward snap / repeated snaps / overlap, worst ${JSON.stringify(scanWorst)}`);
(globalThis.SCANBAD || []).slice(0, 12).forEach(x => log.push('  scan bad ' + JSON.stringify(x)));
log.push(`jitter regression: ${jitN} pocket runs; grid scan ${scanN} runs, ${scanBad} bad${scanBad ? ' worst ' + JSON.stringify(scanWorst) : ''}`);
// ---- H door lintel collider matches the lintel trim mesh (render.mjs box [2.25, 0.15, 0.35] at (0, 2.65, -5.1))
{ const L = LAYOUT.props.find(p => p[0] === 'door_lintel'); const want = [[-1.125, 2.575, -5.275], [1.125, 2.725, -4.925]];
  ok(L && L[1].every((v, i) => Math.abs(v - want[0][i]) < 1e-9) && L[2].every((v, i) => Math.abs(v - want[1][i]) < 1e-9), `door_lintel collider ${JSON.stringify(L)} != trim mesh ${JSON.stringify(want)}`);
  ok(/\n\s*box\(\[2\.25, 0\.15, 0\.35\], trim, \[0, 2\.65, -5\.1\]\)/.test(fs.readFileSync(new URL('../render.mjs', import.meta.url), 'utf8')), 'lintel trim mesh missing (commented out?) in render.mjs'); }
// ---- I cockpit side of the door wall (Playtest 12:35: the cockpit box ended at z -5.0, the wall's cockpit face is at -5.2, so Bolt
// sank 10 cm into it). Walk/float +z into the wall beside the doorway from 4 cockpit spots: his hull must stop at z <= -5.2.
{ ok(LAYOUT.cockpit.max[2] === -5.2, `cockpit box max z ${LAYOUT.cockpit.max[2]} != -5.2 (door wall cockpit face)`);
  for (const mode of ['walk', 'float']) for (const x of [-2.2, -1.6, 1.6, 2.2]) { place(mode, [x, mode === 'walk' ? BOLT.down : 1.4, -6.2]); let o, zmax = -9;
    for (let k = 0; k < 240; k++) { o = step({ move: [0, 0, 1] }).obs; zmax = Math.max(zmax, o.pos[2] + BOLT.r); }
    ok(zmax <= -5.2 + 1e-6, `cockpit back wall ${mode} x ${x}: hull front reached z ${zmax.toFixed(3)} (wall face -5.2)`); log.push(`cockpit door-wall push ${mode} x ${x}: hull front z max ${zmax.toFixed(3)}`); } }
// ---- determinism hygiene
 for (const f of ['game.mjs', 'pilot.mjs', 'world.mjs', 'director.mjs']) ok(!/Math\.random/.test(fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8')), `${f} uses Math.random`);
console.log(log.join('\n')); console.log(`push tests: ${pushN} (each = push 3 s + back out 2 s), handoff cases: ${hoN}`);
for (const [k, r] of Object.entries(runs)) console.log(k, r.log, `hull_overlap_ticks=${r.hull} mesh_max=${r.mm}`);
console.log(`${checks - fails}/${checks} checks passed`); process.exit(fails ? 1 : 0);
