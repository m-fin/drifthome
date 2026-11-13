// DRIFTHOME sim: pure, deterministic, seedable. No Three.js, runs in Node and browser.
// Interface: reset(seed, {m1}) -> obs, step(action) -> {obs, events, done}, observe() -> obs. Fixed timestep DT = 1/60 s.
// M1 = cabin only (reset(seed, {m1: true}) reproduces the old Ep1 runs exactly). M2 (default) adds the ship: Bolt sits in
// the pilot seat, the ship launches out of the Hearth Dock bay, crosses a nebula and an asteroid field, lands on planet 1's
// pad, docks at the sky station, then Bolt floats back to the cabin window.
import { buildWorld, SHIP } from './world.mjs';
export const DT = 1 / 60;
export const SEAT_POS = [0, 1.075, -7.6];
// Layout (metres). Cabin: x[-6,6] y[0,4] z[-5,5]. Window on +x wall. Doorway at z=-5, x[-1,1], y[0,2.6]. Cockpit: x[-3,3] y[0,3] z[-9,-5].
export const LAYOUT = {
  cabin: { min: [-6, 0, -5], max: [6, 4, 5] },
  cockpit: { min: [-3, 0, -9], max: [3, 3, -5.2] }, // v3: max z = the door wall's cockpit face (was -5.0: Bolt sank 10 cm into the wall from the cockpit side)
  door: { x: [-1, 1], y: [0, 2.6], z: -5 },
  window: { x: 6, y: [1.0, 3.4], z: [-3, 3] },
  bed: [-4.5, 0, 3.5],
  handholds: [[-3, 3.6, 0], [0, 3.6, 0], [3, 3.6, 0], [0, 3.6, -3], [0, 2.4, -4.8], [0, 2.6, -7]],
  seat: [0, 0, -7.6],
  // Solid cabin/cockpit props as AABBs [min, max] (match the meshes in render.mjs). Bolt can't pass through these.
  props: [
    ['bunk', [-5.7, 0, 1.9], [-3.5, 0.7, 4.9]], ['shelf', [-6, 2.36, -3], [-5.6, 2.84, 0]],
    ['crate_big', [-5.2, 0, -4.4], [-4.4, 0.8, -3.6]], ['crate_small', [-4.3, 0, -4.5], [-3.7, 0.6, -3.9]],
    ['plant', [4.35, 0, 3.85], [5.25, 1.2, 4.75]], ['table', [1.8, 0, 3.15], [3.2, 0.84, 4.05]],
    ['door_trim_l', [-1.125, 0, -5.275], [-0.975, 2.6, -4.925]], ['door_trim_r', [0.975, 0, -5.275], [1.125, 2.6, -4.925]],
    ['door_lintel', [-1.125, 2.575, -5.275], [1.125, 2.725, -4.925]], // = the lintel trim mesh (was up to y 4: 7.5 cm proud of the wall with nothing drawn)
    ['console', [-2, 0, -8.9], [2, 1.2, -8.1]], ['seat', [-0.45, 0, -8.05], [0.45, 0.625, -7.15]], ['seat_back', [-0.45, 0.6, -7.225], [0.45, 1.6, -7.075]],
    // added 2026-10-20 (collision pass 2): parts of the visible meshes the first box set missed
    ['pillow', [-5.1, 0.65, 4.1], [-4.1, 0.85, 4.7]], ['mug', [2.32, 0.84, 3.52], [2.48, 0.995, 3.68]],
    ['console_screens', [-1.625, 1.2, -8.39], [1.625, 1.24, -8.21]],
    ['window_sill', [5.85, 0.94, -3.1], [6, 1.06, 3.1]], ['window_head', [5.85, 3.34, -3.1], [6, 3.46, 3.1]], ['window_mullion', [5.85, 1, -0.06], [6, 3.4, 0.06]],
    ['lamp_0', [-3.14, 3.46, 2.36], [-2.86, 3.74, 2.64]], ['lamp_1', [2.36, 3.46, 2.36], [2.64, 3.74, 2.64]], ['lamp_2', [-1.14, 3.46, -3.14], [-0.86, 3.74, -2.86]],
  ],
};
// handhold rings (half-torus r 0.22, tube 0.04, hanging down from the anchor point) are solid too
for (const [i, h] of LAYOUT.handholds.entries()) LAYOUT.props.push([`handhold_${i}`, [h[0] - 0.27, h[1] - 0.27, h[2] - 0.05], [h[0] + 0.27, h[1] + 0.05, h[2] + 0.05]]);
// Bolt's hull relative to pos: vertical capsule-ish cylinder of radius r (torso + head + resting arms; render.mjs scales the
// mesh so it spans exactly y -down..+up), below, above (antenna tip).
export const BOLT = { r: 0.35, down: 0.53, up: 0.88 };
const R = 0.45; // Bolt radius vs ship walls (sides/floor)
function rng(s) { let t = (s + 0x6D2B79F5) >>> 0, r = t; r = Math.imul(r ^ (r >>> 15), r | 1); r ^= r + Math.imul(r ^ (r >>> 7), r | 61); return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t]; }
let S = null;
export function reset(seed = 1, opt = {}) {
  let r = seed >>> 0, v; const jit = () => { [v, r] = rng(r); return v - 0.5; };
  S = { seed, tick: 0, t: 0, mode: 'sleep', pos: [LAYOUT.bed[0], 0.7 + BOLT.down, LAYOUT.bed[2]], vel: [0, 0, 0], yaw: Math.PI / 2, gravity: true,
    jitter: [jit(), jit(), jit(), jit()], flags: {}, events: [], log: [] };
  S.m1 = !!opt.m1; S.fj = [jit(), jit(), jit(), jit()]; // extra flight jitter, drawn after the M1 jitter so cabin timing is unchanged
  S.world = S.m1 ? null : buildWorld(seed);
  S.ship = { mode: 'home', pos: [0, 0, 0], vel: [0, 0, 0], fwd: [0, 0, -1], bank: 0, boost: false, thr: 0, nmMin: Infinity, nmId: null };
  return observe();
}
// ---------------- ship (M2) ----------------
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], vlen = (a) => Math.hypot(a[0], a[1], a[2]);
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], norm = (a) => { const l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function turnToward(f, t, maxA) { // rotate unit f toward unit t by at most maxA radians (Rodrigues), deterministic
  const c = Math.max(-1, Math.min(1, dot(f, t))), ang = Math.acos(c); if (ang <= maxA) return [...t];
  let ax = cross(f, t); if (vlen(ax) < 1e-9) ax = [0, 1, 0]; ax = norm(ax); const s = Math.sin(maxA), k = Math.cos(maxA), d = dot(ax, f), x = cross(ax, f);
  return norm([0, 1, 2].map(i => f[i] * k + x[i] * s + ax[i] * d * (1 - k)));
}
export function shipClearance(W, p) { // closest asteroid surface minus hull radius
  let best = Infinity, id = null; for (const a of W.asteroids) { const d = vlen(vsub(p, a.c)) - a.r - SHIP.radius; if (d < best) { best = d; id = a.id; } } return [best, id];
}
function shipStep(s, c, emit) {
  const sh = s.ship, W = s.world; if (!W) return;
  const P = () => sh.pos.map(x => +x.toFixed(1));
  if (c.cmd === 'launch' && sh.mode === 'home') { sh.mode = 'flight'; emit('launch', { from: 'hearth_dock', pos: P() }); }
  if (c.cmd === 'liftoff' && sh.mode === 'landed') { sh.mode = 'flight'; emit('liftoff', { pos: P() }); }
  if (sh.mode !== 'flight') { sh.vel = [0, 0, 0]; sh.thr = 0; sh.boost = false; sh.bank *= 0.95; return; }
  if (c.face) sh.fwd = turnToward(sh.fwd, norm(c.face), SHIP.turn * DT);
  const f = sh.fwd, t = c.thrust || [0, 0, 0]; let along = dot(t, f); let perp = t.map((x, i) => x - f[i] * along);
  along = Math.max(-SHIP.rev, Math.min(1, along)); const pm = vlen(perp); if (pm > SHIP.rcs) perp = perp.map(x => x * SHIP.rcs / pm);
  const boost = !!c.boost && along > 0.7, fa = along * SHIP.accel * (boost ? SHIP.boostMul : 1);
  const acc = [0, 1, 2].map(i => f[i] * fa + perp[i] * SHIP.accel);
  const toC = vsub(sh.pos, W.planet.c), dc = vlen(toC), alt = dc - W.planet.r;
  if (alt < SHIP.gravAlt) { const g = SHIP.gravity * Math.min(1, (SHIP.gravAlt - alt) / 150); for (let i = 0; i < 3; i++) acc[i] -= toC[i] / dc * g; }
  for (let i = 0; i < 3; i++) { sh.vel[i] = (sh.vel[i] + acc[i] * DT) * (1 - SHIP.drag * DT); }
  const sp = vlen(sh.vel); if (sp > SHIP.vmax) sh.vel = sh.vel.map(x => x * SHIP.vmax / sp);
  for (let i = 0; i < 3; i++) sh.pos[i] += sh.vel[i] * DT;
  // collisions: bay walls, asteroids (push out, cancel inward speed), planet ground and pad
  const H = W.hangar; if (sh.pos[2] > H.mouthZ) { for (const i of [0, 1]) { const lo = H.min[i] + (i ? SHIP.hullDown : SHIP.radius), hi = H.max[i] - (i ? SHIP.hullDown : SHIP.radius); if (sh.pos[i] < lo) { sh.pos[i] = lo; sh.vel[i] = Math.max(0, sh.vel[i]); } if (sh.pos[i] > hi) { sh.pos[i] = hi; sh.vel[i] = Math.min(0, sh.vel[i]); } } }
  for (const a of W.asteroids) { const d = vsub(sh.pos, a.c), L = vlen(d), m = a.r + SHIP.radius * 0.8; if (L < m) { const n = d.map(x => x / L); sh.pos = a.c.map((x, i) => x + n[i] * m); const vn = dot(sh.vel, n); if (vn < 0) sh.vel = sh.vel.map((x, i) => x - n[i] * vn); sh.flags_bump = true; } }
  const dc2 = vlen(vsub(sh.pos, W.planet.c)), minR = W.planet.r + SHIP.hullDown; if (dc2 < minR) { const n = vsub(sh.pos, W.planet.c).map(x => x / dc2); sh.pos = W.planet.c.map((x, i) => x + n[i] * minR); const vn = dot(sh.vel, n); if (vn < 0) sh.vel = sh.vel.map((x, i) => x - n[i] * vn); }
  const ph = Math.hypot(sh.pos[0] - W.pad.c[0], sh.pos[2] - W.pad.c[2]), floorY = W.padTop + SHIP.hullDown;
  const vPre = vlen(sh.vel); // speed before ground contact, used for the touchdown speed
  if (ph < W.pad.r && sh.pos[1] < floorY) { sh.pos[1] = floorY; sh.vel[1] = Math.max(0, sh.vel[1]); }
  // visual state: bank into side thrust, engine level
  const right = norm(cross(f, [0, 1, 0])); sh.bank += (-dot(perp, right) * 0.9 - sh.bank) * Math.min(1, 2.5 * DT); sh.boost = boost; sh.thr = along;
  // events from state, not from the pilot
  const F = s.flags, inNeb = vlen(vsub(sh.pos, W.nebula.c)) < W.nebula.r, inField = vlen(vsub(sh.pos, W.field.c)) < W.field.r;
  if (inNeb && !F.nebula) { F.nebula = true; emit('nebula_enter', { pos: P(), speed_mps: +vlen(sh.vel).toFixed(1) }); }
  if (!inNeb && F.nebula && !F.nebula_out) { F.nebula_out = true; emit('nebula_exit', { pos: P() }); }
  if (inField && !F.field) { F.field = true; emit('asteroid_field_enter', { pos: P(), speed_mps: +vlen(sh.vel).toFixed(1) }); }
  if (!inField && F.field && !F.field_out) { F.field_out = true; emit('asteroid_field_exit', { pos: P() }); }
  if (F.field && !F.near_miss) { // closest pass under 10 m of hull clearance; logged at the tick the gap starts opening again
    const [clr, id] = shipClearance(W, sh.pos);
    if (clr < 10) { if (clr < sh.nmMin) { sh.nmMin = clr; sh.nmId = id; } else if (clr > sh.nmMin + 0.02) { F.near_miss = true; emit('asteroid_near_miss', { asteroid: sh.nmId, clearance_m: +sh.nmMin.toFixed(2), speed_mps: +vlen(sh.vel).toFixed(1) }); } }
  }
  const dPad = vlen(vsub(sh.pos, [W.pad.c[0], W.padTop, W.pad.c[2]]));
  if (!F.approach && dPad < W.approachR) { F.approach = true; emit('planet_approach', { planet: W.planet.name, pad_dist_m: +dPad.toFixed(0), speed_mps: +vlen(sh.vel).toFixed(1) }); }
  const vs = vlen(sh.vel);
  if (!F.land && ph < W.pad.r - 2 && sh.pos[1] - floorY < 0.06 && vPre < 1.5) { F.land = true; sh.mode = 'landed'; sh.pos[1] = floorY; emit('land', { pad: 'ember_pad', touchdown_mps: +vPre.toFixed(2), offset_m: +ph.toFixed(2) }); sh.vel = [0, 0, 0]; }
  const dd = vlen(vsub(sh.pos, W.dockTarget));
  if (F.land && !F.dock && dd < 0.8 && vs < 1.5 && dot(f, W.station.portDir.map(x => -x)) > 0.97) { F.dock = true; sh.mode = 'docked'; sh.pos = [...W.dockTarget]; sh.vel = [0, 0, 0]; emit('dock', { station: 'sky_dock', closing_mps: +vs.toFixed(2), miss_m: +dd.toFixed(2) }); }
}
const room = (p) => (p[2] < -5 ? 'cockpit' : 'cabin');
function shipBounds(p) { // allowed centre range per axis for Bolt at p: cabin box, cockpit box, or the doorway between them
  const inDoor = Math.abs(p[0]) < 1 - R * 0.6 && p[1] < 2.6 - R * 0.6;
  const box = room(p) === 'cockpit' ? LAYOUT.cockpit : LAYOUT.cabin, lo = [], hi = [];
  for (let i = 0; i < 3; i++) {
    lo[i] = box.min[i] + (i === 1 ? BOLT.down : R); hi[i] = box.max[i] - (i === 1 ? BOLT.up : R);
    if (i === 2 && inDoor) { lo[i] = LAYOUT.cockpit.min[2] + R; hi[i] = LAYOUT.cabin.max[2] - R; }
  }
  return [lo, hi];
}
function clampToShip(p, v) {
  // collide sphere with cabin box, cockpit box, and the doorway opening between them
  const [lo, hi] = shipBounds(p);
  for (let i = 0; i < 3; i++) {
    if (p[i] < lo[i]) { p[i] = lo[i]; if (v[i] < 0) v[i] *= -0.2; }
    if (p[i] > hi[i]) { p[i] = hi[i]; if (v[i] > 0) v[i] *= -0.2; }
  }
}
// Bolt hull vs prop AABBs. Bolt is a vertical cylinder (radius BOLT.r, y from -down to +up) and each prop a box, so
// box corners are rounded off in the horizontal plane and Bolt slides around them instead of snagging. Each pass pushes
// Bolt out along the smallest penetration (side normal, up or down) and removes only the velocity going into the prop,
// so he slides along it. Fixed prop order and fixed tie-breaks: fully deterministic.
export function propExits(p, mn, mx, r = BOLT.r) { // -> [] (no overlap) or every way out [{d, n}], shortest first
  const lo = p[1] - BOLT.down, hi = p[1] + BOLT.up; if (hi <= mn[1] || lo >= mx[1]) return [];
  const qx = Math.max(mn[0], Math.min(mx[0], p[0])), qz = Math.max(mn[2], Math.min(mx[2], p[2])), dx = p[0] - qx, dz = p[2] - qz, d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return [];
  const c = [];
  if (d2 > 1e-12) { const d = Math.sqrt(d2); c.push({ d: r - d, n: [dx / d, 0, dz / d] }); }
  else c.push({ d: p[0] - mn[0] + r, n: [-1, 0, 0] }, { d: mx[0] - p[0] + r, n: [1, 0, 0] }, { d: p[2] - mn[2] + r, n: [0, 0, -1] }, { d: mx[2] - p[2] + r, n: [0, 0, 1] }); // centre inside the footprint
  // side exits around the box (used only when the direct way out is walled off, e.g. a prop in a corner)
  if (d2 > 1e-12) c.push({ d: p[0] - mn[0] + r, n: [-1, 0, 0] }, { d: mx[0] - p[0] + r, n: [1, 0, 0] }, { d: p[2] - mn[2] + r, n: [0, 0, -1] }, { d: mx[2] - p[2] + r, n: [0, 0, 1] });
  // rounded-corner exits along one horizontal axis only (keep the other coordinate): the smallest move that clears the
  // corner when the radial way out is walled off (Bolt pressed into the pocket between a prop corner and a ship wall)
  if (d2 > 1e-12 && Math.abs(dx) < r && Math.abs(dz) < r) {
    const sz = Math.sqrt(r * r - dx * dx), sx = Math.sqrt(r * r - dz * dz);
    for (const sg of dz !== 0 ? [Math.sign(dz)] : [-1, 1]) c.push({ d: Math.abs(qz + sg * sz - p[2]), n: [0, 0, sg] });
    for (const sg of dx !== 0 ? [Math.sign(dx)] : [-1, 1]) c.push({ d: Math.abs(qx + sg * sx - p[0]), n: [sg, 0, 0] });
  }
  c.push({ d: mx[1] - lo, n: [0, 1, 0] }, { d: hi - mn[1], n: [0, -1, 0] });
  return c.map((e, k) => [e, k]).sort((a, b) => a[0].d - b[0].d || a[1] - b[1]).map(e => e[0]); // stable: fixed tie-break order
}
export const propPen = (p, mn, mx, r = BOLT.r) => propExits(p, mn, mx, r)[0] || null;
const clampShipPt = (q) => { const [lo, hi] = shipBounds(q); return q.map((x, i) => Math.max(lo[i], Math.min(hi[i], x))); };
export function collideProps(p, v) {
  for (let pass = 0; pass < 4; pass++) {
    let any = false;
    for (const [, mn, mx] of LAYOUT.props) {
      const ex = propExits(p, mn, mx); if (!ex.length) continue;
      // walls + this prop resolved jointly: try every exit, put the result back inside the ship (what the wall clamp
      // would do anyway), keep only results that are clear of the prop, and take the smallest actual displacement.
      // (was: shortest exit unless it left the ship, else the next exit in full -> in the narrow pockets between the plant
      // and the window wall, or the big crate and the corner, Bolt snapped back 3-17 cm several times a second)
      let best = null;
      const mv = (q, e) => clampShipPt(q.map((x, i) => x + e.n[i] * (e.d + 1e-6))), clr = (q) => { const r = propExits(q, mn, mx); return !r.length || r[0].d <= 1e-6; };
      const cand = (q) => { const c = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]); if (!best || c < best.c - 1e-9) best = { q, c }; };
      for (const e of ex) { const q = mv(p, e); if (clr(q)) { cand(q); continue; }
        for (const e2 of propExits(q, mn, mx)) { const q2 = mv(q, e2); if (clr(q2)) cand(q2); } } // 2nd step from the wall-clamped point: lands exactly in the pocket corner
      let n;
      if (best && best.c > 1e-12) { n = best.q.map((x, i) => (x - p[i]) / best.c); for (let i = 0; i < 3; i++) p[i] = best.q[i]; }
      else if (best) continue;
      else { const h = ex[0]; n = h.n; for (let i = 0; i < 3; i++) p[i] += h.n[i] * (h.d + 1e-6); } // nothing clears in one go: shortest exit, next pass continues
      const vn = v[0] * n[0] + v[1] * n[1] + v[2] * n[2]; if (vn < 0) for (let i = 0; i < 3; i++) v[i] -= n[i] * vn; // slide
      any = true;
    }
    if (!any) break;
  }
}
// Test/debug helper: every prop Bolt's hull overlaps at pos, with the depth (m). Empty = clear.
export function propOverlaps(p, eps = 1e-4) { const out = []; for (const [name, mn, mx] of LAYOUT.props) { const h = propPen(p, mn, mx); if (h && h.d > eps) out.push({ name, depth: +h.d.toFixed(4) }); } return out; }
// action: { mode?: 'wake'|'walk'|'float', move:[x,y,z] in [-1,1] (y used only when floating), look?: yaw }
export function step(a = {}) {
  const s = S; s.events = [];
  const emit = (type, detail = {}) => { const e = { t_s: +((s.tick + 1) * DT).toFixed(4), tick: s.tick + 1, type, detail }; s.events.push(e); s.log.push(e); };
  if (a.mode === 'wake' && s.mode === 'sleep') { s.mode = 'walk'; emit('wake', { room: 'cabin' }); }
  if (a.mode === 'float' && s.mode === 'walk') { s.mode = 'float'; s.gravity = false; emit('float_start', { pos: s.pos.map(x => +x.toFixed(2)) }); }
  if (a.mode === 'walk' && s.mode === 'float') { s.mode = 'walk'; s.gravity = true; }
  if (a.mode === 'sit' && s.mode === 'float' && room(s.pos) === 'cockpit') { s.mode = 'seat'; s.vel = [0, 0, 0]; }
  if (a.mode === 'unbuckle' && s.mode === 'seat') { s.mode = 'float'; s.pos = [0, 1.25, -6.7]; s.vel = [0, 0, 0.3]; }
  shipStep(s, a.ship || {}, emit);
  const m = a.move || [0, 0, 0];
  if (s.mode === 'walk') {
    s.vel[0] = m[0] * 1.6; s.vel[2] = m[2] * 1.6; s.vel[1] -= 9.8 * DT;
  } else if (s.mode === 'float') {
    for (let i = 0; i < 3; i++) { s.vel[i] += m[i] * 2.2 * DT; s.vel[i] *= 0.985; const c = 1.8; if (s.vel[i] > c) s.vel[i] = c; if (s.vel[i] < -c) s.vel[i] = -c; }
  } else s.vel = [0, 0, 0];
  if (s.mode === 'seat') { for (let i = 0; i < 3; i++) s.pos[i] += (SEAT_POS[i] - s.pos[i]) * Math.min(1, 4 * DT); a = { ...a, look: Math.PI / 2 }; }
  for (let i = 0; i < 3; i++) s.pos[i] += s.vel[i] * DT;
  if (s.mode !== 'seat') clampToShip(s.pos, s.vel);
  if (s.mode !== 'sleep' && s.mode !== 'seat') { collideProps(s.pos, s.vel); clampToShip(s.pos, s.vel); }
  if (a.look != null) { let d = a.look - s.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); s.yaw += Math.max(-3 * DT, Math.min(3 * DT, d)); }
  s.tick++; s.t = s.tick * DT;
  // event detection from state (not from the pilot), so any controller fires the same events
  if (!s.flags.cockpit && room(s.pos) === 'cockpit' && s.pos[2] < -6.4) { s.flags.cockpit = true; emit('cockpit_reach', { pos: s.pos.map(x => +x.toFixed(2)) }); }
  const facing = Math.cos(s.yaw - 0) > 0.95; // yaw 0 = looking toward +x (window)
  const flown = s.m1 || s.flags.dock; // M2: the window beat comes after docking
  if (!s.m1 && s.flags.dock && !s.flags.cabin && room(s.pos) === 'cabin' && s.mode === 'float') { s.flags.cabin = true; emit('cabin_enter', { pos: s.pos.map(x => +x.toFixed(2)) }); }
  if (flown && s.flags.cockpit && !s.flags.window && s.pos[0] > 4.6 && facing && Math.abs(s.pos[2]) < 3) { s.flags.window = true; emit('window_look', { pos: s.pos.map(x => +x.toFixed(2)) }); }
  return { obs: observe(), events: s.events, done: !!s.flags.window };
}
export function observe() {
  const s = S; return { tick: s.tick, t_s: +s.t.toFixed(4), mode: s.mode, room: room(s.pos), gravity: s.gravity, pos: [...s.pos], vel: [...s.vel], yaw: s.yaw,
    near_handhold: LAYOUT.handholds.findIndex(h => Math.hypot(h[0] - s.pos[0], h[1] - s.pos[1], h[2] - s.pos[2]) < 0.9), flags: { ...s.flags }, log: s.log,
    ship: { mode: s.ship.mode, pos: [...s.ship.pos], vel: [...s.ship.vel], fwd: [...s.ship.fwd], bank: s.ship.bank, boost: s.ship.boost, thr: s.ship.thr }, m1: s.m1 };
}
export const state = () => S;
