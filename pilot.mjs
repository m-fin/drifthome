// Scripted waypoint pilot.
// M1 (st.m1): wake -> walk off the bunk -> float_start -> float via handholds to cockpit -> float back -> window_look.
// M2 (default): same cabin path up to cockpit_reach, then sit -> launch -> fly the seeded route (flightPilot) -> land ->
// liftoff -> dock -> unbuckle -> float back through the doorway (cabin_enter) -> window_look.
// Seeded variation comes from state().jitter / state().fj (small waypoint offsets, pause lengths, cruise speeds).
import { LAYOUT, propOverlaps as _po } from './game.mjs';
const propOverlaps = (q) => _po(q).length > 0;
import { SHIP } from './world.mjs';
export function makePilot(st) {
  const j = st.jitter;
  const cabinBack = [
    { kind: 'fly', to: [0, 1.15, -4.2], tol: 0.4 }, // back through the doorway, under the handhold
    { kind: 'fly', to: [0, 1.6, -3.5] },
    { kind: 'fly', to: [5.0, 2.2, 0.4 * j[1]], look: 0 },
    { kind: 'hold', look: 0 },
  ];
  const plan = st.m1 ? null : [
    { kind: 'wait', until: 1.2 + j[0] * 0.4, mode: 'sleep' },
    { kind: 'wake' },
    { kind: 'walk', to: [-2.5 + j[1], 0, 1.1] },
    { kind: 'wait', dur: 0.8 },
    { kind: 'float' },
    { kind: 'fly', to: [0 + j[2] * 0.5, 2.4, -2.5] },
    { kind: 'fly', to: [0, 1.15, -4.4] },
    { kind: 'fly', to: [0, 1.2, -6.75], tol: 0.3 },
    { kind: 'sit' },
    { kind: 'wait', dur: 2.2 + st.fj[0] * 0.4 },     // buckle in, glance at the console
    { kind: 'flight' },                              // hands the controls to flightPilot until the ship is docked
    { kind: 'wait', dur: 1.0 },
    { kind: 'unbuckle' },
    ...cabinBack,
  ];
  return plan ? runPlan(plan, st) : runPlan(m1Plan(j), st);
}
function m1Plan(j) {
  return [
    { kind: 'wait', until: 1.2 + j[0] * 0.4, mode: 'sleep' },
    { kind: 'wake' },
    { kind: 'walk', to: [-2.5 + j[1], 0, 1.1] }, // ends clear of the bunk so Bolt steps down off it,
    { kind: 'wait', dur: 0.8 },
    { kind: 'float' },
    { kind: 'fly', to: [0 + j[2] * 0.5, 2.4, -2.5] },
    { kind: 'fly', to: [0, 1.15, -4.4] }, // duck under the doorway handhold
    { kind: 'fly', to: [0, 1.2, -6.75], tol: 0.3 }, // stop just in front of the pilot seat
    { kind: 'wait', dur: Math.max(0.3, 0.16 + j[3]) }, // short cockpit pause keeps seed 1 at 38.0 s (doorway path is longer)
    { kind: 'fly', to: [0, 1.15, -4.2], tol: 0.4 }, // back through the doorway, under the handhold
    { kind: 'fly', to: [0, 1.6, -3.5] },
    { kind: 'fly', to: [5.0, 2.2, 0.4 * j[1]], look: 0 },
    { kind: 'hold', look: 0 },
  ];
}
function runPlan(plan, st) {
  let i = 0, t0 = null, fp = null;
  return function act(o) {
    for (;;) {
      const p = plan[i]; if (!p) return {};
      if (p.kind === 'sit') { i++; return { mode: 'sit' }; }
      if (p.kind === 'unbuckle') { i++; return { mode: 'unbuckle' }; }
      if (p.kind === 'flight') { fp ||= flightPilot(st.world, st.fj); const sa = fp(o); if (sa === null) { i++; continue; } return { ship: sa }; }
      if (p.kind === 'wait') { if (t0 === null) t0 = o.t_s; const end = p.until ?? t0 + p.dur; if (o.t_s < end) return { move: [0, 0, 0] }; i++; t0 = null; continue; }
      if (p.kind === 'wake') { i++; return { mode: 'wake' }; }
      if (p.kind === 'float') { i++; return { mode: 'float' }; }
      if (p.kind === 'hold') { const d = sub([5.0, 2.2, o.pos[2]], o.pos); return { move: d.map(x => x * 0.5 - 0), look: 0 }; }
      const d = sub(p.to, o.pos); if (p.kind === 'walk') d[1] = 0; const dist = Math.hypot(...d);
      if (dist < (p.tol || 0.35)) { i++; continue; }
      const yaw = Math.atan2(-d[2], d[0]);
      if (p.kind === 'walk') return { move: [d[0] / dist, 0, d[2] / dist], look: yaw };
      // fly: steer toward target, brake as we arrive
      const want = d.map(x => (x / dist) * Math.min(1.4, dist * 0.9));
      return { move: want.map((w, k) => Math.max(-1, Math.min(1, (w - o.vel[k]) * 1.5))), look: p.look ?? yaw };
    }
  };
}
const sub = (a, b) => a.map((x, k) => x - b[k]);
// ---------------------------------------------------------------------------------------------
// FLIGHT PILOT (M2). Steers the ship through world.route with a speed governor: wanted velocity points at the waypoint,
// its size is min(cruise, the speed from which it can still brake to the next waypoint's speed). Thrust = (wanted - actual)
// velocity error plus gravity compensation; game.mjs then limits it (strong main drive, weaker side/reverse thrusters),
// so the nose has to turn toward where it wants to go. Returns null once the ship is docked.
export function flightPilot(W, fj = [0, 0, 0, 0]) {
  const R = W.route; let i = 0, t0 = null; const ab = { go: 4.2, stop: 3.2, land: 1.5, dock: 1.2 };
  const vmul = 1 + fj[1] * 0.06; // seeded cruise-speed variation (+-3 %)
  const hz = (v) => { const l = Math.hypot(v[0], v[2]) || 1; return [v[0] / l, 0, v[2] / l]; };
  return function (o) {
    const sh = o.ship;
    for (;;) {
      const p = R[i]; if (!p) return null;
      if (p.kind === 'launch') { if (sh.mode === 'home') return { cmd: 'launch' }; i++; continue; }
      if (p.kind === 'liftoff') { if (sh.mode === 'landed') return { cmd: 'liftoff' }; i++; continue; }
      if (p.kind === 'hold') { if (t0 === null) t0 = o.t_s; if (o.t_s - t0 < p.dur) return {}; t0 = null; i++; continue; }
      if (p.kind === 'land' && sh.mode === 'landed') { i++; continue; }
      if (p.kind === 'dock' && sh.mode === 'docked') { i++; continue; }
      const d = sub(p.to, sh.pos), dist = Math.hypot(...d), sp = Math.hypot(...sh.vel);
      if (p.kind === 'go' && dist < p.tol) { i++; continue; }
      if (p.kind === 'stop' && dist < p.tol && sp < p.vtol) { i++; continue; }
      const nx = R[i + 1], vEnd = p.kind === 'go' && nx && nx.v ? Math.min(p.v, nx.v) * vmul : (p.kind === 'land' || p.kind === 'dock' ? 0.5 : 0);
      const vCap = p.v * (p.kind === 'go' ? vmul : 1);
      let vWant = Math.min(vCap, Math.sqrt(vEnd * vEnd + 2 * ab[p.kind] * Math.max(0, dist - (p.kind === 'go' ? p.tol * 0.5 : 0))));
      if (p.kind === 'land') vWant = Math.min(vWant, 0.35 + 0.45 * dist);   // flare: soft touchdown
      if (p.kind === 'dock') vWant = Math.min(vWant, 0.3 + 0.35 * dist);    // creep into the port
      const want = dist > 1e-6 ? d.map(x => x / dist * vWant) : [0, 0, 0];
      const k = p.kind === 'go' ? 0.6 : 1.6;
      const thrust = want.map((w, n) => (w - sh.vel[n]) * k / SHIP.accel);
      const toC = sub(sh.pos, W.planet.c), dc = Math.hypot(...toC), alt = dc - W.planet.r;
      if (alt < SHIP.gravAlt) { const g = SHIP.gravity * Math.min(1, (SHIP.gravAlt - alt) / 150) / SHIP.accel; for (let n = 0; n < 3; n++) thrust[n] += toC[n] / dc * g; }
      // nose: along the wanted velocity in cruise; level (horizontal) when settling, landing or docking
      const face = p.face || (p.kind === 'go' ? (vWant > 2 ? want : sh.fwd) : hz(dist > 25 ? d : sh.fwd));
      return { thrust, face, boost: !!p.boost && sp < vCap * 0.95 };
    }
  };
}
export const HANDHOLDS = LAYOUT.handholds;

// ---------------------------------------------------------------------------------------------
// AUTOPILOT (interactive play only; index.html). Nothing below is used by makePilot, run.mjs or capture.html,
// so the seeded capture run is untouched. Bolt loops these points of interest, starting from the nearest one.
export const POI = [
  { name: 'cabin_mid', to: [0, 2.4, -2.5] },
  { name: 'door_in', to: [0, 1.0, -4.4] },            // under the doorway handhold
  { name: 'cockpit', to: [0, 1.2, -6.75], tol: 0.3, pause: 2.0 },
  { name: 'door_out', to: [0, 1.0, -4.2], tol: 0.4 },
  { name: 'cabin_back', to: [0, 1.6, -3.5] },
  { name: 'window', to: [5.0, 2.2, 0], look: 0, pause: 4.0 },
  { name: 'cabin_tour', to: [-2.5, 2.2, 0.5] },      // over the rug, clear of bunk and shelf
];
const inCockpit = (p) => p[2] < -5;
export function nearestPoi(pos) {
  let best = 0, bd = Infinity;
  POI.forEach((q, k) => { if (inCockpit(q.to) !== inCockpit(pos)) return; const d = Math.hypot(...sub(q.to, pos)); if (d < bd) { bd = d; best = k; } });
  return best;
}
export const HANDOFF_S = 0.5;
// makeAutopilot(obs) -> { act(obs), poi }. Starts at the POI nearest Bolt, switches to float, steers with the same
// fly controller as makePilot. Prop collision still runs inside game.step(), so no clipping in either mode.
export function makeAutopilot(o0) {
  let i = nearestPoi(o0.pos), t0 = null, det = null, best = Infinity, stall = 0;
  // Stall escape (2026-10-20): the POI tour flies straight lines, so a prop between Bolt and the next point (e.g. the
  // pilot seat's back when he was pushed in front of it) could pin him there forever. If he makes < 5 cm progress in
  // 0.75 s, he side-steps 0.9 m (left first, then right, then up, whichever spot is clear), then carries on.
  const room = (p) => (p[2] < -5 ? 'cockpit' : 'cabin');
  const act = (o) => {
    if (o.mode === 'sleep') return { mode: 'wake' };
    const p = POI[i], goal = det || p.to, d = sub(goal, o.pos), dist = Math.hypot(...d);
    if (det) { if (dist < 0.3) { det = null; best = Infinity; stall = 0; return act(o); } }
    else {
      if (dist < (p.tol || 0.35) || t0 !== null) {
        if (t0 === null) t0 = o.t_s;
        if (o.t_s - t0 >= (p.pause || 0)) { i = (i + 1) % POI.length; t0 = null; best = Infinity; stall = 0; return act(o); }
      } else if (dist < best - 0.05) { best = dist; stall = 0; }
      else if (++stall > 45) {
        const h = Math.hypot(d[0], d[2]) || 1, side = [-d[2] / h, 0, d[0] / h], lim = room(o.pos) === 'cockpit' ? [2.4, 2.0, -8.4, -5.6] : [5.4, 3.0, -4.4, 4.4];
        const opts = [side.map((x, k) => o.pos[k] + x * 0.9), side.map((x, k) => o.pos[k] - x * 0.9), [o.pos[0], o.pos[1] + 0.8, o.pos[2]]]
          .map(q => [Math.max(-lim[0], Math.min(lim[0], q[0])), Math.max(0.5, Math.min(lim[1], q[1])), Math.max(lim[2], Math.min(lim[3], q[2]))]);
        det = opts.find(q => !propOverlaps(q)) || opts[2]; stall = 0; best = Infinity; return act(o);
      }
    }
    const want = dist < 1e-6 ? [0, 0, 0] : d.map(x => (x / dist) * Math.min(1.4, dist * 0.9));
    const yaw = dist > 0.2 ? Math.atan2(-d[2], d[0]) : o.yaw;
    return { mode: o.mode === 'walk' ? 'float' : undefined, move: want.map((w, k) => Math.max(-1, Math.min(1, (w - o.vel[k]) * 1.5))), look: (det ? null : p.look) ?? yaw };
  };
  return { act, get poi() { return det ? POI[i].name + ' (side-step)' : POI[i].name; } };
}
// Engage blend: w ramps 0 -> 1 over HANDOFF_S; the float sim integrates move as acceleration, so Bolt's velocity
// eases from whatever the player was doing onto the pilot path with no snap.
export function blendActions(player, pilot, w) {
  const pm = player.move || [0, 0, 0], am = pilot.move || [0, 0, 0];
  const out = { mode: pilot.mode ?? player.mode, move: am.map((x, k) => pm[k] * (1 - w) + x * w) };
  const look = w >= 0.5 ? (pilot.look ?? player.look) : (player.look ?? pilot.look); if (look != null) out.look = look;
  return out;
}
