// Helm and handhold checks that the seeded pilot never exercises.
// Sit from a walk, launch and fly, grab a handhold. node tests/helm.mjs
import { reset, step, state, SEAT_POS, LAYOUT, BOLT } from '../game.mjs';

let fail = 0;
const ok = (c, m) => { if (c) console.log('PASS', m); else { fail++; console.log('FAIL', m); } };

// Sit from a walk in the cockpit, then unbuckle back to float.
{
  reset(1, { m1: false });
  const s = state();
  s.mode = 'walk'; s.gravity = true; s.vel = [0, 0, 0]; s.pos = [0.1, BOLT.down, -6.9];
  let o = step({ mode: 'sit' }).obs;
  ok(o.mode === 'seat' && o.gravity === false, `sit from walk -> ${o.mode}`);
  for (let i = 0; i < 90; i++) o = step({}).obs;
  const d = Math.hypot(o.pos[0] - SEAT_POS[0], o.pos[1] - SEAT_POS[1], o.pos[2] - SEAT_POS[2]);
  ok(d < 0.05, `eased into the seat (${d.toFixed(3)} m)`);
  o = step({ mode: 'unbuckle' }).obs;
  ok(o.mode === 'float' && o.gravity === false, `unbuckle -> ${o.mode}, gravity ${o.gravity}`);
}

// A seated launch command plus nose-forward thrust actually flies the ship.
{
  reset(3, { m1: false });
  const s = state();
  s.mode = 'seat'; s.gravity = false; s.pos = [...SEAT_POS]; s.vel = [0, 0, 0];
  const z0 = state().ship.pos[2];
  let o = step({ ship: { cmd: 'launch', thrust: [0, 0, -1], face: [0, 0, -1], boost: false } }).obs;
  ok(o.ship.mode === 'flight' && o.log.some(e => e.type === 'launch'), 'launch event and flight mode');
  for (let i = 0; i < 180; i++) o = step({ ship: { thrust: [0, 0, -1], face: [0, 0, -1], boost: true } }).obs;
  ok(o.ship.pos[2] < z0 - 30, `flew forward (${(z0 - o.ship.pos[2]).toFixed(1)} m)`);
  ok(o.ship.boost === true, 'boost flag reaches the renderer');
}

// Holding a handhold pulls Bolt toward it and sets the grab pose flag.
{
  reset(1, { m1: true });
  const h = LAYOUT.handholds[1], s = state();
  s.mode = 'float'; s.gravity = false; s.vel = [0.4, 0, 0];
  s.pos = [h[0] + 0.35, h[1] - 1.5, h[2]]; // below the ring, clear of its collider
  const target = [h[0], h[1] - 1.25, h[2]];
  const dist = (p) => Math.hypot(p[0] - target[0], p[1] - target[1], p[2] - target[2]);
  const d0 = dist(s.pos);
  let o = step({ grab: true, move: [1, 0, 0] }).obs;
  for (let i = 0; i < 90; i++) o = step({ grab: true, move: [1, 0, 0] }).obs;
  ok(o.grab === true, 'grab flag observed');
  ok(dist(o.pos) < 0.08, `pulled in (${d0.toFixed(2)} -> ${dist(o.pos).toFixed(2)} m) despite a forward move`);
}

// Without grab, the same spot just drifts on the move command (the old float integrator).
{
  reset(1, { m1: true });
  const h = LAYOUT.handholds[1], s = state();
  s.mode = 'float'; s.gravity = false; s.vel = [0, 0, 0];
  s.pos = [h[0] + 0.55, h[1] - 0.7, h[2]];
  const x0 = s.pos[0];
  let o = step({ move: [1, 0, 0] }).obs;
  for (let i = 0; i < 20; i++) o = step({ move: [1, 0, 0] }).obs;
  ok(o.grab === false && o.pos[0] > x0 + 0.05, `ungrabbed float still integrates move (${(o.pos[0] - x0).toFixed(3)} m)`);
}

console.log(fail ? `${fail} failed` : 'helm ok');
process.exit(fail ? 1 : 0);
