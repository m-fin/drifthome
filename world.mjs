// DRIFTHOME M2 flight world: pure data, no three.js. buildWorld(seed) is shared by game.mjs (physics/events),
// pilot.mjs (route) and render.mjs (meshes), so all three see the same seeded layout. Units: metres, +y up.
// Ship local frame: nose = -z (cockpit end), +x = cabin window side, +y = up. The cabin interior lives inside the hull.
export const SHIP = {
  halfLen: 11, noseOff: 11, hullDown: 2.6, radius: 7,     // hull sphere for asteroid clearance, skid height below centre
  accel: 13, boostMul: 2.4, rcs: 0.55, rev: 0.5,          // m/s^2 main drive; boost multiplies forward thrust; side (RCS) and reverse limits
  turn: 1.1, vmax: 120, drag: 0.02,                        // rad/s nose turn rate, speed cap, light space drag (1/s)
  gravity: 3.2, gravAlt: 600,                              // gentle planet pull below 600 m altitude
};
function mulberry(seed) { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const add = (a, b) => a.map((x, i) => x + b[i]), sub = (a, b) => a.map((x, i) => x - b[i]), mul = (a, k) => a.map(x => x * k);
const len = (a) => Math.hypot(...a);
function segDist(p, a, b) { const ab = sub(b, a), t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2))); return len(sub(p, add(a, mul(ab, t)))); }
export function buildWorld(seed = 1) {
  const r = mulberry(seed + 101), j = () => r() - 0.5;
  const pad = { c: [150, -140, -3720], r: 16, h: 1.2 };     // landing pad on top (north pole) of planet 1
  const planet = { c: [pad.c[0], pad.c[1] - 900, pad.c[2]], r: 900, name: 'Ember' };
  const padTop = pad.c[1] + pad.h;
  const station = { c: add(pad.c, [0, 56, -92]), portDir: [0, 0, 1], armLen: 24, ringR: 34 };
  station.port = add(station.c, mul(station.portDir, station.armLen));
  const dockTarget = add(station.port, mul(station.portDir, SHIP.noseOff)); // ship centre when its nose sits in the port
  const W = {
    seed, pad, planet, padTop, station, dockTarget,
    hangar: { min: [-12, -7, -26], max: [12, 7, 14], mouthZ: -26 },     // the Hearth Dock bay the ship starts in
    nebula: { c: [40 + j() * 20, 30, -860], r: 720 },
    field: { c: [0, -10, -2160], r: 560 },
    approachR: 900,                                                      // planet_approach: within this distance of the pad
  };
  // Autopilot route. kind: go (pass through, speed v, arrive at vEnd), stop (arrive and settle), land, liftoff, dock.
  const gate = [-18 + j() * 6, -6 + j() * 4, -2400];
  W.route = [
    { kind: 'launch' },
    { kind: 'go', to: [0, 0, -50], v: 12, tol: 6 },
    { kind: 'go', to: [0, 14, -330], v: 80, boost: true, tol: 25 },
    { kind: 'go', to: [70 + j() * 30, 40 + j() * 10, -900], v: 50, tol: 30 },
    { kind: 'go', to: [j() * 20, 10, -1560], v: 50, tol: 30 },
    { kind: 'go', to: [-8, 0, -2020], v: 40, tol: 20 },
    { kind: 'go', to: gate, v: 38, tol: 3.5, name: 'near_miss_gate' },
    { kind: 'go', to: [20, -10, -2760], v: 44, tol: 25 },
    { kind: 'go', to: add(pad.c, [0, 120, 400]), v: 50, tol: 25 },
    { kind: 'go', to: add(pad.c, [0, 30, 30]), v: 26, tol: 8 },
    { kind: 'land', to: [pad.c[0], padTop + SHIP.hullDown, pad.c[2]], v: 9 },
    { kind: 'hold', dur: 3.5 },                                         // rest on Ember's pad (Captain: 3.5 s)
    { kind: 'liftoff' },
    { kind: 'go', to: add(pad.c, [0, 14, 0]), v: 8, tol: 3 },          // straight up off the pad first
    { kind: 'go', to: add(dockTarget, [0, 0, 20]), v: 14, tol: 2.5, face: [0, 0, -1] },
    { kind: 'dock', to: dockTarget, v: 4, face: [0, 0, -1] },
  ];
  // Scripted near miss: a big tumbling rock just right of the gate (Bolt passes ~5.5 m off its surface) and a smaller one
  // on the far side, so the line threads between them.
  const rock = { c: add(gate, [16 + SHIP.radius + 5.5, 2, 0]), r: 16, id: 'tumbler' };
  const rocks = [rock, { c: add(gate, [-(12 + SHIP.radius + 20), -4, -8]), r: 12, id: 'twin' }];
  const path = W.route.filter(p => p.to).map(p => p.to);
  const ast = [];
  for (let tries = 0; ast.length < 230 && tries < 20000; tries++) {
    const u = r() * 2 - 1, th = r() * 6.2832, rr = Math.cbrt(r()) * W.field.r, s = Math.sqrt(1 - u * u);
    const c = add(W.field.c, [rr * s * Math.cos(th), rr * u * 0.55, rr * s * Math.sin(th)]);
    const rad = 2.5 + r() ** 3 * 24;
    let dmin = Infinity; for (let k = 0; k + 1 < path.length; k++) dmin = Math.min(dmin, segDist(c, path[k], path[k + 1]));
    if (dmin < 42 + rad) continue;
    if (rocks.some(q => len(sub(q.c, c)) < q.r + rad + 25) || ast.some(q => len(sub(q.c, c)) < q.r + rad + 4)) continue;
    ast.push({ c, r: rad, id: 'a' + ast.length, shape: Math.floor(r() * 4), spin: [j(), j(), j()], tint: r() });
  }
  rocks.forEach(q => Object.assign(q, { shape: 0, spin: [0.08, 0.15, 0.05], tint: 0.4 }));
  W.asteroids = [...rocks, ...ast];
  return W;
}
