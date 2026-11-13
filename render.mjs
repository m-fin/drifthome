// Three.js renderer for the cabin (interior scene) and, from M2, the exterior flight scene (space.mjs). Reads sim state only.
import * as THREE from './vendor/three.module.js';
import { LAYOUT, BOLT, SEAT_POS } from './game.mjs';
import { buildWorld } from './world.mjs';
import { createSpace } from './space.mjs';
import { EXTERIOR } from './director.mjs';
export function createRenderer(canvas, W, H, seed = 1, opt = {}) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  r.setSize(W, H, false); r.shadowMap.enabled = true; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x05060f);
  const cam = new THREE.PerspectiveCamera(W > H ? 60 : 75, W / H, 0.1, 1000); // near/far tightened from 0.05/2000 (depth precision x4 at the walls)
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
  const add = (geo, mat, p, rot) => { const m = new THREE.Mesh(geo, mat); m.position.set(...p); if (rot) m.rotation.set(...rot); m.castShadow = m.receiveShadow = true; scene.add(m); return m; };
  const box = (s, mat, p) => add(new THREE.BoxGeometry(...s), mat, p);
  // --- sky: seeded stars + nebula sprites, outside the window
  let rs = seed >>> 0; const rnd = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; };
  const sp = [], sc = [];
  for (let i = 0; i < 2500; i++) { const u = rnd() * 2 - 1, th = rnd() * 6.283, rr = Math.sqrt(1 - u * u); sp.push(rr * Math.cos(th) * 600, u * 600, rr * Math.sin(th) * 600); const w = 0.7 + rnd() * 0.3; sc.push(w, w, 0.85 + rnd() * 0.15); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.6, vertexColors: true, sizeAttenuation: false })));
  const neb = document.createElement('canvas'); neb.width = neb.height = 256; const nx = neb.getContext('2d');
  const grd = nx.createRadialGradient(128, 128, 0, 128, 128, 128); grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); nx.fillStyle = grd; nx.fillRect(0, 0, 256, 256);
  const ntex = new THREE.CanvasTexture(neb);
  const cols = [0x8a3cff, 0xff4fa3, 0x2fb7ff, 0x5a2dff];
  for (let i = 0; i < 14; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ntex, color: cols[i % 4], transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.set(400, (rnd() - 0.3) * 160, (rnd() - 0.5) * 300); s.scale.setScalar(120 + rnd() * 160); scene.add(s); }
  add(new THREE.SphereGeometry(40, 32, 16), M(0xc98a5a, { roughness: 1 }), [500, -60, 120]); // distant planet
  // --- cabin shell (walls built as panels so the window and doorway are real openings)
  const wall = M(0x8a6f55), floor = M(0x6b4a33), ceil = M(0x9b8670), trim = M(0x3a3f47, { metalness: 0.5, roughness: 0.4 });
  box([12, 0.2, 10], floor, [0, -0.1, 0]); box([12, 0.2, 10], ceil, [0, 4.1, 0]);
  box([0.2, 4, 10], wall, [-6.1, 2, 0]); box([12, 4, 0.2], wall, [0, 2, 5.1]);
  // +x wall with window opening (y 1..3.4, z -3..3)
  box([0.2, 1, 10], wall, [6.1, 0.5, 0]); box([0.2, 0.6, 10], wall, [6.1, 3.7, 0]); box([0.2, 2.4, 2], wall, [6.1, 2.2, -4]); box([0.2, 2.4, 2], wall, [6.1, 2.2, 4]);
  box([0.3, 0.12, 6.2], trim, [6.0, 1.0, 0]); box([0.3, 0.12, 6.2], trim, [6.0, 3.4, 0]); box([0.3, 2.4, 0.12], trim, [6.0, 2.2, 0]);
  const glass = add(new THREE.PlaneGeometry(6, 2.4), new THREE.MeshPhysicalMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.08, roughness: 0.05, depthWrite: false }), [6.05, 2.2, 0], [0, -Math.PI / 2, 0]); glass.castShadow = false;
  // -z wall with doorway (x -1..1, y 0..2.6)
  { // one extruded U-shaped slab (x -6..6, y 0..4, z -5.2..-5.0) with the doorway cut out (x -1..1, y 0..2.6): was 3 boxes whose
    // T-junctions above the door rendered as hairline seams. One mesh = shared vertices, no coplanar overlaps, no cracks.
    const sh = new THREE.Shape([[-6, 0], [-1, 0], [-1, 2.6], [1, 2.6], [1, 0], [6, 0], [6, 4], [-6, 4]].map(([x, y]) => new THREE.Vector2(x, y)));
    const dw = add(new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: false }), wall, [0, 0, -5.2]); dw.castShadow = false;
    // v3: the extruded slab drew hard dark wedges along its big cap triangles in the lamps' shadow maps, so it no longer casts;
    // three invisible sheets (shadow pass only) over the cockpit-facing part of the wall (|x| <= 2.95) still keep the cabin lamps out
    // of the cockpit (without them its right wall picks up lamp light). The wall left/right of that has no caster at all. They are 2 cm
    // sheets at the cockpit face (z -5.195..-5.175), 17.5 cm behind the cabin face the lamps light: flush or 5 cm-deep casters
    // still self-shadowed the wall at grazing lamp angles (the same wedge). The cockpit face points away from the lamps, so it's unlit either way.
    const proxy = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    for (const [sz, ps] of [[[1.97, 2.6, 0.02], [-1.975, 1.3, -5.185]], [[1.97, 2.6, 0.02], [1.975, 1.3, -5.185]], [[5.9, 1.4, 0.02], [0, 3.3, -5.185]]]) { const m = box(sz, proxy, ps); m.receiveShadow = false; m.userData.shadowProxy = true; } }
  box([0.15, 2.575, 0.35], trim, [-1.05, 1.2875, -5.1]); box([0.15, 2.575, 0.35], trim, [1.05, 1.2875, -5.1]); // side trims stop under the lintel trim (were coplanar with it)
  box([2.25, 0.15, 0.35], trim, [0, 2.65, -5.1]); // lintel trim (y 2.575-2.725; had been swallowed by the comment above, so its collider stuck out with no mesh)
  // cozy props: bunk, blanket, rug, shelf, crates, plant, table
  box([2.2, 0.5, 3], M(0x5a3b28), [-4.6, 0.25, 3.4]); box([2.1, 0.2, 2.9], M(0xb3473a), [-4.6, 0.6, 3.4]); box([1.0, 0.2, 0.6], M(0xe8dcc8), [-4.6, 0.75, 4.4]);
  add(new THREE.CylinderGeometry(2.2, 2.2, 0.03, 40), M(0x8c5a3c), [0, 0.02, 0.5]);
  box([0.4, 0.08, 3], M(0x5a3b28), [-5.8, 2.4, -1.5]); for (let i = 0; i < 5; i++) box([0.3, 0.4, 0.15], M([0x7aa2c4, 0xd9a24a, 0x6e8f5a, 0xc75b4a, 0xe0d3b8][i]), [-5.75, 2.64, -2.6 + i * 0.5]);
  box([0.8, 0.8, 0.8], M(0x7d6a4f), [-4.8, 0.4, -4.0]); box([0.6, 0.6, 0.6], M(0x6a5a44), [-4.0, 0.3, -4.2]);
  add(new THREE.CylinderGeometry(0.25, 0.2, 0.4, 16), M(0x7a4b3a), [4.8, 0.2, 4.3]); add(new THREE.SphereGeometry(0.45, 16, 12), M(0x4f8a4a), [4.8, 0.75, 4.3]);
  box([1.4, 0.08, 0.9], M(0x5a3b28), [2.5, 0.8, 3.6]); box([0.08, 0.8, 0.08], M(0x3a2a1e), [2.0, 0.4, 3.3]); box([0.08, 0.8, 0.08], M(0x3a2a1e), [3.0, 0.4, 3.9]);
  add(new THREE.CylinderGeometry(0.08, 0.06, 0.15, 12), M(0xe8dcc8), [2.4, 0.92, 3.6]); // mug
  // handholds: yellow bars along the ceiling and doorway
  const hh = M(0xf2b33d, { metalness: 0.3, roughness: 0.4 });
  for (const h of LAYOUT.handholds) add(new THREE.TorusGeometry(0.22, 0.04, 8, 20, Math.PI), hh, h, [Math.PI, 0, 0]);
  // cockpit
  const cp = M(0x4a505a, { metalness: 0.3 });
  box([6, 0.2, 4], M(0x33373e), [0, -0.1, -7]); [box([6, 0.2, 3.9], cp, [0, 3.1, -7.05]), box([0.2, 3, 3.9], cp, [-3.1, 1.5, -7.05]), box([0.2, 3, 3.9], cp, [3.1, 1.5, -7.05])].forEach(m => m.castShadow = false); // no shadow casting: their ends inside the door slab drew a faint dashed line at x=+-3 // end at z=-5.1, inside the cabin wall slab (was -5.0: coplanar with the wall face -> z-fighting)
  box([6, 1.0, 0.2], cp, [0, 0.5, -9.1]); box([6, 0.6, 0.2], cp, [0, 2.9, -9.1]); // cockpit front window gap y 1..2.6
  box([4, 0.6, 0.8], M(0x2a2e35), [0, 0.9, -8.5]);
  for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.25, 0.04, 0.18), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: [0x36e7ff, 0x7dff6a, 0xffb03d][i % 3], emissiveIntensity: 2 }), [-1.5 + i * 0.6, 1.22, -8.3]);
  box([0.9, 0.15, 0.9], M(0x9b4a3a), [0, 0.55, -7.6]); box([0.88, 1.0, 0.15], M(0x9b4a3a), [0, 1.1, -7.15]);
  // thin trims: out of the shadow passes; handhold rings still cast their (now clean) shadows but don't receive (4-15 cm faces stair-stepped in the 512 px cube maps)
  scene.traverse(m => { if (m.isMesh && m.material === trim) m.castShadow = m.receiveShadow = false; if (m.isMesh && m.material === hh) m.receiveShadow = false; });
  // lights: warm lamps in the cabin, cool fill from the window, teal panel glow in the cockpit
  scene.add(new THREE.HemisphereLight(0xffe2c0, 0x2a1d14, 0.35));
  const warm = (p, i, sm = 512) => { const l = new THREE.PointLight(0xffb26b, i, 14, 1.6); l.position.set(...p); l.castShadow = true; l.shadow.mapSize.set(sm, sm); l.shadow.bias = -0.004; l.shadow.normalBias = 0.03; scene.add(l);
    add(new THREE.SphereGeometry(0.14, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb26b, emissiveIntensity: 3 }), p).castShadow = false; };
  warm([-3, 3.6, 2.5], 18, 1024); warm([2.5, 3.6, 2.5], 14); warm([-1, 3.6, -3], 10);
  const cool = new THREE.DirectionalLight(0x9fb8ff, 0.6); cool.position.set(20, 6, 2); scene.add(cool);
  const teal = new THREE.PointLight(0x36e7ff, 6, 6, 2); teal.position.set(0, 1.6, -8.2); scene.add(teal);
  // --- Bolt: primitives only
  const bolt = new THREE.Group(); scene.add(bolt);
  // the primitive mesh spans y -0.52..+0.87 (feet to antenna ball); scale + lift it so it spans the sim hull exactly (-BOLT.down..+BOLT.up)
  const BS = Math.min((BOLT.down + BOLT.up) / 1.39, 0.956) /* capped so arms stay inside hull radius */, BY = -BOLT.down + 0.52 * BS; bolt.scale.setScalar(BS);
  const body = M(0xd8dde3, { metalness: 0.4, roughness: 0.35 }), dark = M(0x2b3038), eye = new THREE.MeshStandardMaterial({ color: 0x111, emissive: 0x6af2ff, emissiveIntensity: 3 });
  const part = (g, m, p, parent = bolt) => { const x = new THREE.Mesh(g, m); x.position.set(...p); x.castShadow = true; parent.add(x); return x; };
  part(new THREE.CapsuleGeometry(0.26, 0.3, 6, 16), body, [0, 0, 0]);
  const head = new THREE.Group(); head.position.set(0, 0.45, 0); bolt.add(head);
  part(new THREE.BoxGeometry(0.42, 0.3, 0.36), body, [0, 0, 0], head); part(new THREE.BoxGeometry(0.06, 0.24, 0.3), dark, [0.2, 0, 0], head);
  const eyes = [part(new THREE.SphereGeometry(0.045, 10, 8), eye, [0.23, 0.03, 0.08], head), part(new THREE.SphereGeometry(0.045, 10, 8), eye, [0.23, 0.03, -0.08], head)];
  part(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), dark, [0, 0.26, 0], head); part(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshStandardMaterial({ color: 0x222, emissive: 0xffb03d, emissiveIntensity: 3 }), [0, 0.38, 0], head);
  const arms = [-1, 1].map(sd => { const a = part(new THREE.CapsuleGeometry(0.06, 0.3, 4, 8), dark, [0, 0.02, sd * 0.29]); return a; });
  const legs = [-1, 1].map(sd => part(new THREE.CapsuleGeometry(0.07, 0.18, 4, 8), dark, [0, -0.36, sd * 0.13]));
  const jet = part(new THREE.ConeGeometry(0.08, 0.2, 10), new THREE.MeshStandardMaterial({ color: 0x111, emissive: 0x6af2ff, emissiveIntensity: 2, transparent: true, opacity: 0.8 }), [-0.24, -0.05, 0]); jet.rotation.z = Math.PI / 2;
  // debug: draw every collider (LAYOUT.props) + Bolt's hull. ?colliders=1 or the B key in index.html, or R.setDebug(true).
  const dbg = new THREE.Group(); dbg.visible = !!opt.debug; scene.add(dbg);
  for (const [, mn, mx] of LAYOUT.props) { const b = new THREE.Box3(new THREE.Vector3(...mn), new THREE.Vector3(...mx)); dbg.add(new THREE.Box3Helper(b, 0x39ff6a)); }
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(BOLT.r, BOLT.r, BOLT.down + BOLT.up, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xff3df0, wireframe: true, depthTest: false }));
  hull.renderOrder = 10; dbg.add(hull);
  let space = null; // exterior scene, built on first use so cabin-only stills stay as cheap as before
  function render(o, view = 'follow') {
    if (view === 'follow' && o.mode === 'seat' && o.ship && (o.ship.mode === 'flight' || o.ship.mode === 'landed')) view = 'chase';
    if (EXTERIOR.has(view) && o.ship) { space ||= createSpace(THREE, buildWorld(seed), seed, W, H); space.update(o, view); r.render(space.scene, space.camera); return; }
    bolt.position.set(o.pos[0], o.pos[1] + BY, o.pos[2]); bolt.rotation.set(0, o.yaw, 0);
    const t = o.t_s, sleep = o.mode === 'sleep', fl = o.mode === 'float';
    bolt.rotation.z = sleep ? 1.2 : fl ? Math.sin(t * 0.9) * 0.12 : 0; // seat mode renders as the upright pose bolt.rotation.x = fl ? Math.sin(t * 0.7) * 0.1 : 0;
    if (sleep) bolt.position.set(LAYOUT.bed[0], 1.0, 3.85); // on his back, head on the pillow, resting on the blanket (was y 0.85: sank 13 cm into the bunk, face down)
    eyes.forEach(e => e.material.emissiveIntensity = sleep ? 0.2 : 3);
    arms.forEach((a, k) => { a.rotation.x = 0; a.rotation.z = fl ? -0.9 : Math.sin(t * 6 + k * Math.PI) * 0.4 * Math.hypot(o.vel[0], o.vel[2]); });
    legs.forEach((l, k) => { l.rotation.z = fl ? 0.4 : Math.sin(t * 6 + k * Math.PI) * 0.5 * Math.hypot(o.vel[0], o.vel[2]); });
    hull.position.set(o.pos[0], o.pos[1] + (BOLT.up - BOLT.down) / 2, o.pos[2]);
    jet.visible = fl; jet.scale.setScalar(fl ? 0.6 + Math.min(0.7, Math.hypot(...o.vel)) : 1); // max 1.3 keeps the flame inside the hull radius
    placeCam(o, view);
    r.render(scene, cam);
  }
  // v6.2 (M2 capture only; Playtest 20:28): when Bolt sits down the sim pulls him into the seat (game.mjs: 4/s toward SEAT_POS,
  // speed jumps from ~0.3 to ~2.6 m/s in one tick), and the fixed cockpit camera's lookAt followed him 1:1: a 2.5-2.7 deg/frame
  // whip at ~16.1-16.3 s. From the first seat frame, pan instead with a cubic Hermite from the aim and aim speed it had (so it
  // starts without a kink) to the seated aim over CK_T s, ending at rest. Before that it tracks him as before. Ep1 / free play: as before.
  const CK_T = 2.4, CK_END = new THREE.Vector3(SEAT_POS[0], SEAT_POS[1], SEAT_POS[2] - 0.6), _ckT = new THREE.Vector3();
  let ck = null;
  function cockpitAim(o, P) { _ckT.set(P[0], P[1], P[2] - 0.6); if (FREE || o.m1) { ck = null; return _ckT; }
    const tick = o.tick ?? 0, prev = ck && tick - ck.tick >= 1 && tick - ck.tick <= 6 ? ck : null;
    ck = { tick, t: o.t_s, a: _ckT.clone(), plan: prev ? prev.plan : null };
    if (prev && !ck.plan && o.mode === 'seat') ck.plan = { t0: prev.t, a0: prev.a.clone(), v0: prev.v || new THREE.Vector3() };
    if (ck.plan) { const pl = ck.plan, u = Math.min(1, (o.t_s - pl.t0) / CK_T), u2 = u * u, u3 = u2 * u;
      ck.a.copy(pl.a0).multiplyScalar(2 * u3 - 3 * u2 + 1).addScaledVector(pl.v0, CK_T * (u3 - 2 * u2 + u)).addScaledVector(CK_END, 3 * u2 - 2 * u3); }
    if (prev) ck.v = ck.a.clone().sub(prev.a).divideScalar(Math.max(1e-6, o.t_s - prev.t));
    return ck.a; }
  function placeCam(o, view) { // camera only, no draw (also used by the headless camera check)
    const P = o.pos;
    if (view === 'wide') { cam.position.set(4.6, 3.3, -3.6); cam.lookAt(-3, 0.9, 2.2); }
    else if (view === 'window') { cam.position.set(P[0] - 2.4, P[1] + 0.5, P[2] - 1.6); cam.lookAt(P[0] + 2, P[1], P[2] + 0.4); }
    else if (view === 'cockpit') { cam.position.set(2.2, 1.9, -5.8); cam.lookAt(cockpitAim(o, P)); }
    else followCam(P, o.yaw, o);
    if (view !== 'follow') fc.view = view;
  }
  // Keep the camera inside the room Bolt is in: the cabin box, or the narrower/lower cockpit box (hard cut when he changes
  // room). The old clamp was one box over both rooms, so a spot could sit inside the 0.2 m wall slab at z=-5 or outside the
  // cockpit's side walls (inside a slab every face is back-facing and the wall vanishes), or look through the door frame and
  // get yanked forward as Bolt moved off the door axis.
  const CAB = { x: 5.8, y: 3.45, z0: -4.8, z1: 4.8 }, CKP = { x: 2.75, y: 2.75, z0: -8.75, z1: -5.35 };
  let camRoom = 'cabin';
  // handhold keep-out is round (0.45 m from the ring's box, pushed straight out from its nearest point) so the camera slides
  // smoothly around a ring instead of being shoved off a box face; false only if that push would leave the room (then the
  // box step below handles it)
  const RING = 0.45;
  const ringOut = (p, m, mn, mx, b) => { const q = [Math.max(mn[0], Math.min(mx[0], p.x)), Math.max(mn[1], Math.min(mx[1], p.y)), Math.max(mn[2], Math.min(mx[2], p.z))];
    const v = [p.x - q[0], p.y - q[1], p.z - q[2]], d = Math.hypot(...v); if (d >= RING) return true; if (d < 1e-4) return false;
    const n = v.map((x, i) => q[i] + x * RING / d); if (Math.abs(n[0]) > b.x - m || n[1] < 0.3 + m || n[1] > b.y - m || n[2] < b.z0 + m || n[2] > b.z1 - m) return false;
    p.set(n[0], n[1], n[2]); return true; };
  const ringsOut = (p) => { const b = camRoom === 'cockpit' ? CKP : CAB; for (const [pn, mn, mx] of LAYOUT.props) if (pn.startsWith('handhold')) ringOut(p, 0, mn, mx, b); };
  const clampCam = (p, m = 0) => { const b = camRoom === 'cockpit' ? CKP : CAB; // m: extra margin (candidate spots use 0.3 so the 0.25 m 'fat' LOS points stay in the room)
    p.x = Math.max(-b.x + m, Math.min(b.x - m, p.x)); p.y = Math.max(0.3 + m, Math.min(b.y - m, p.y)); p.z = Math.max(b.z0 + m, Math.min(b.z1 - m, p.z));
    // never inside (or within 12 cm of) a prop, and never within 45 cm of a handhold ring (v3: the camera flew through the doorway
    // ring as it left the cockpit, a big ring sweeping a third of the frame): step out the shortest way that stays in the room
    for (const [pn, mn, mx] of LAYOUT.props) { if (pn.startsWith('handhold') && ringOut(p, m, mn, mx, b)) continue;
      const e = pn.startsWith('handhold') ? 0.45 : 0.12, q = [p.x, p.y, p.z]; if (q.some((v, i) => v <= mn[i] - e || v >= mx[i] + e)) continue;
      const lim = [[-b.x + m, b.x - m], [0.3 + m, b.y - m], [b.z0 + m, b.z1 - m]]; let best = null;
      for (let i = 0; i < 3; i++) for (const [t, d] of [[mn[i] - e, mn[i] - e - q[i]], [mx[i] + e, mx[i] + e - q[i]]]) if (t >= lim[i][0] && t <= lim[i][1] && (!best || Math.abs(d) < Math.abs(best[1]))) best = [i, d];
      if (best) { const k = ['x', 'y', 'z'][best[0]]; p[k] += best[1]; } } };
  // Follow camera with collision. Candidates (in order): the ideal chase spot, a raised spot looking down over props,
  // then pulled in along the ideal line. A candidate is used only if the ray from Bolt's head to it is clear of
  // cabin geometry (bunk, crates, handhold rings, walls). Vertical uses a narrower FOV and a lower aim so the frame
  // isn't a quarter ceiling.
  const portrait = W < H; cam.fov = portrait ? 62 : 58; cam.updateProjectionMatrix();
  // small/thin things (handhold rings, lamp bulbs, mug, console screens, window trims) don't block the camera: briefly passing
  // behind a 4 cm ring used to yank the camera in and back out (the remaining follow-cam pops)
  const thin = (m) => m.userData.shadowProxy || m.material === trim || // v3: handhold rings count again (they block the view / LOS)
     (m.geometry.type === 'SphereGeometry' && m.geometry.parameters.radius < 0.2) || m.geometry.type === 'CylinderGeometry' && m.geometry.parameters.height < 0.2 || (m.geometry.type === 'BoxGeometry' && m.geometry.parameters.height < 0.05);
  { // v4 warm-up: draw the whole cabin once at load with culling off, so every shader is compiled AND linked now. A shader's
    // first use blocks on the link (getProgramInfoLog), e.g. the shadow-only door-wall sheets' basic shader the first time the
    // door wall came into view: a single 0.2-0.7 s free-play hitch. Uses the raw renderer (no follow-camera state); the next real
    // frame redraws everything, and captures refresh the shadow maps on their init frame, so no capture pixel changes.
    const cul = []; scene.traverse(m => { if (m.isMesh || m.isPoints) { cul.push([m, m.frustumCulled]); m.frustumCulled = false; } });
    scene.updateMatrixWorld(true); r.render(scene, cam); for (const [m, f] of cul) m.frustumCulled = f; }
  scene.updateMatrixWorld(true); // static meshes get their world matrices now: a follow frame placed before the first draw (stills, seeks) raycast against identity matrices
  const colliders = []; scene.traverse(m => { if (m.isMesh && m.geometry && !thin(m)) { let p = m; while (p && p !== bolt && p !== dbg) p = p.parent; if (!p) colliders.push(m); } });
  const ray = new THREE.Raycaster(), _t = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
  const clear = (from, to) => { _d.subVectors(to, from); const len = _d.length(); ray.set(from, _d.normalize()); ray.far = len + 0.3; const h = ray.intersectObjects(colliders, false); return h.length ? h[0].distance - 0.3 : Infinity; };
  const _n = new THREE.Vector2();
  // true if any near-frame ray (lower half + center) hits a prop well before Bolt's distance
  const frameBlocked = (camDist) => { cam.updateMatrixWorld(); for (const [x, y] of [[0, 0], [-0.5, -0.5], [0, -0.5], [0.5, -0.5], [0, -0.85]]) {
    _n.set(x, y); ray.setFromCamera(_n, cam); ray.far = camDist * 0.75; const h = ray.intersectObjects(colliders, false).filter(i => i.point.y > 0.06); if (h.length) return true; } return false; };
  // Stateful follow camera (was: re-picked from scratch every frame -> 71 jumps > 0.25 m per 37 s run).
  // - keeps the spot it chose while that spot stays usable; a spot whose frame is only partly covered by props is held for
  //   up to HOLD frames before switching; a spot with a wall/prop between it and Bolt's head is dropped at once
  // - the camera glides toward its spot at most STEP m per sim tick (0.15 m per 30 fps frame)
  // - hard cut only when Bolt changes room, the view changes to follow, or the sim jumped (stills, seeks)
  // - if anything ends up between Bolt's head and the camera it is pulled in in front of it (never left behind a wall)
  // Stateful follow camera.
  // - candidate spots: chase spots behind/around Bolt (clamped >= 0.3 m inside his room, so the fat LOS points can't poke
  //   into a wall), then fixed room spots (cockpit corners + the cockpit view camera; cabin doorway/corner spots)
  // - a spot is only usable if its LOS (fat) is clear, it is MIN_D..MAX_D from Bolt's head and looks down <= MAX_PITCH
  //   (was: every chase spot clamped onto the cockpit walls failed LOS and the fallback lerped the camera onto Bolt's head:
  //   1.15 m overhead, looking straight down, for the whole cockpit visit)
  // - keeps its spot while usable; a partly covered frame is held up to HOLD frames
  // - motion: critically damped spring on the camera's offset from Bolt (eases in and out; was a constant 0.15 m/frame glide),
  //   then the room clamp, then the per-tick cap STEP (so a clamp can never push a frame over the cap)
  // - hard cut only when Bolt changes room, the view changes to follow, or the sim jumped (stills, seeks)
  // - nothing usable at all: the fixed room camera (cockpit view camera / cabin corner), never a pull-in onto his head
  // v3 (Playtest free play): a prop crossing the head->camera line mid-glide no longer pulls the camera in or snaps it to its
  // spot at once (0.8-2.75 m re-frames around the cockpit seat and under the ceiling rings): the camera keeps easing toward
  // the clear spot nearest the camera (re-chosen at the start and after 0.4 s) for up to 2 x OCC_GRACE ticks (0.8 s) and only
  // then pulls in / cuts. Losing him through the doorway is unchanged.
  const OCC_GRACE = 24; const PITCH_CAP = 55, OMEGA_OCC = 6, HEAD_MIN = 0.8, HEAD_SOFT = 1.6, SW_LOCK = 60, W_MAX = 2.5 * Math.PI / 180, FREE = !!opt.freePlay; // FREE: index.html live play only (v4 fixes gated off the capture paths)
  const HOLD = 5, STEP = 0.075, OMEGA = 2.5, MIN_D = 1.6, MAX_D = 5.2, MAX_PITCH = 50, CM = 0.3;
  const fc = { idx: -1, tick: -1e9, room: null, view: null, blocked: 0, pos: new THREE.Vector3(), tgt: null, a: 0, r: 0, h: 0, va: 0, vr: 0, vh: 0, cuts: 0, roomCuts: 0, cutTick: -1e9, pulls: 0, fixed: 0, capped: 0 };
  const _p = new THREE.Vector3(), _g = new THREE.Vector3(), _a = new THREE.Vector3();
  const FIXED = { cockpit: [[2.3, 2.2, -5.65], [-2.3, 2.2, -5.65], [2.2, 1.9, -5.8], [-2.2, 1.9, -5.8], [2.3, 2.2, -8.4], [-2.3, 2.2, -8.4]],
    cabin: [[3.0, 2.6, -3.4], [-3.0, 2.6, -3.4], [4.6, 3.0, -3.6], [-4.6, 3.0, -3.6], [4.8, 3.0, 4.0], [-4.8, 3.0, 4.0], [0, 3.0, 4.2]] };
  function candPos(P, c, out) { if (c.length === 1) out.set(...c[0]); else { const [yw, d, h] = c; out.set(P[0] - d * Math.cos(yw), P[1] + h, P[2] + d * Math.sin(yw)); } clampCam(out, CM); return out; }
  const _o = new THREE.Vector3(), FAT = [[0.25, 0, 0], [-0.25, 0, 0], [0, 0.25, 0], [0, -0.25, 0], [0, 0, 0.25], [0, 0, -0.25]];
  const clearFat = (pos) => { if (clear(_t, pos) !== Infinity) return false; for (const f of FAT) { _o.set(pos.x + f[0], pos.y + f[1], pos.z + f[2]); if (clear(_t, _o) !== Infinity) return false; } return true; };
  const pitchOf = (pos, P, aimY) => Math.atan2(pos.y - aimY, Math.hypot(pos.x - P[0], pos.z - P[2])) * 180 / Math.PI; // look-down angle, deg
  function usable(P, aimY, pos) { const D = pos.distanceTo(_t); if (D < MIN_D || D > MAX_D || pitchOf(pos, P, aimY) > MAX_PITCH || !clearFat(pos)) return 0;
    cam.position.copy(pos); cam.lookAt(P[0], aimY, P[2]); return frameBlocked(pos.distanceTo(_t)) ? 1 : 2; } // 0 unusable, 1 frame partly covered, 2 good
  function fixedCam(room, P, out) { // last resort: a fixed spot of the camera's room with a clear view (no distance/pitch rule), else the room's view camera
    let best = null, bd = 1e9; for (const f of FIXED[room]) { out.set(...f); clampCam(out); const d = Math.abs(out.distanceTo(_t) - 3.5) + (pitchOf(out, P, _t.y - 0.25) > MAX_PITCH ? 50 : 0); if (clear(_t, out) === Infinity && d < bd) { bd = d; best = f; } } // clear spot nearest 3.5 m (v3: one that looks down <= MAX_PITCH first)
    out.set(...(best || FIXED[room][room === 'cockpit' ? 2 : 2])); clampCam(out); return out; }
  // Held spot = polar offset from Bolt in WORLD terms (angle a around him, horizontal radius r, height h): it moves with him
  // but does not swing when he turns, so it never sweeps through him. Re-picked only when it stops being usable; the
  // new spot is the usable candidate closest in angle to the current one (shortest swing). The spring runs on (a, r, h).
  const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));
  const polar = (P, pos) => [Math.atan2(pos.z - P[2], pos.x - P[0]), Math.hypot(pos.x - P[0], pos.z - P[2]), pos.y - P[1]];
  const fromPolar = (P, [a, r, h], out) => out.set(P[0] + r * Math.cos(a), P[1] + h, P[2] + r * Math.sin(a));
  // v5 free play: a clear spot around Bolt's head at horizontal radius rad, at one of the heights ys, that the room clamp does
  // not move (so it is really in open space), nearest to `from`; spots on the side he is moving toward cost up to 1.5 m extra
  // (fc.vel: his horizontal heading while moving > 1 cm/tick; v5 float_tour 114 s: it slid along the wall he was flying at). Angles a0 +- k x 10 deg, toward dir first. null if none.
  function swingSpot(P, from, rad, ys, dir, D3) { const a0 = Math.atan2(from.z - P[2], from.x - P[0]); let best = null, bd = 1e9;
    for (let k = 0; k <= 18; k++) for (const sg of k ? [dir, -dir] : [1]) { const aa = a0 + sg * k * Math.PI / 18;
      for (const y of ys) { if (D3) { rad = Math.sqrt(Math.max(0.36, D3 * D3 - (y - _t.y) ** 2)); if (pitchOf(_a.set(P[0] + rad, y, P[2]), P, _t.y - 0.25) > 48) continue; } /* D3: 3-D distance from his head (higher spots may sit closer horizontally, <= 48 deg) */
        _a.set(P[0] + rad * Math.cos(aa), y, P[2] + rad * Math.sin(aa)); const ax = _a.x, ay = _a.y, az = _a.z; clampCam(_a, CM);
        if (Math.hypot(_a.x - ax, _a.y - ay, _a.z - az) > 0.05 || _a.distanceTo(_t) < HEAD_MIN) continue; const d = _a.distanceTo(from) + k * 0.02 + (fc.vel ? 1.5 * Math.max(0, ((_a.x - P[0]) * fc.vel[0] + (_a.z - P[2]) * fc.vel[1]) / rad) : 0); if (d >= bd || clear(_t, _a) !== Infinity) continue; bd = d; best = _a.clone(); } }
    return best; }
  // v5 free play swing: move the camera from last frame's spot s0 toward spot ALONG AN ARC around Bolt (polar about his
  // feet: bearing, horizontal radius, height), not along the chord (the chord cut past him: 1.42 m, a 58 deg pan in 0.2 s).
  // Pitch-cap swing (arc): bearing rate <= 2.5 deg per tick (150 deg/s, 30 deg per 0.2 s; v4 whip: 375 deg/s), ramping up by
  // <= 0.5 deg/tick per frame; radius and height <= 5 cm per tick. Head keep-out swing (chord, so it can slide along a wall): <= STEP per tick,
  // ramping by 1.5 cm/tick per frame, never closer to him horizontally than where it started or where it goes, bearing rate <= W_MAX
  // (dropped when he is already within 1.3 m: getting away from his face comes first). The swung spot becomes the spring's target for SW_LOCK ticks (hysteresis: v4's spring dragged the
  // camera back toward the blocked bearing and the cap tripped again, a 4.5 Hz judder while he turned by the plant).
  function easeTo(spot, s0, P, dT, arc) { const n = Math.max(1, dT), a0 = Math.atan2(s0.z - P[2], s0.x - P[0]), r0 = Math.hypot(s0.x - P[0], s0.z - P[2]);
    const a1 = Math.atan2(spot.z - P[2], spot.x - P[0]), r1 = Math.hypot(spot.x - P[0], spot.z - P[2]), lim = (x, m) => Math.max(-m, Math.min(m, x));
    if (arc) { const rem = Math.abs(wrap(a1 - a0)) * 180 / Math.PI, wMax = Math.min(2.5, Math.max(1, (fc.swW || 0) + 0.5), Math.max(0.3, Math.sqrt(0.5 * rem))) * Math.PI / 180, da = lim(wrap(a1 - a0), wMax * n), /* eases out too: <= sqrt(2 x 0.25 deg/tick^2 x remaining) */ r = r0 + lim(r1 - r0, 0.05 * n);
      fc.pos.set(P[0] + r * Math.cos(a0 + da), s0.y + lim(spot.y - s0.y, 0.05 * n), P[2] + r * Math.sin(a0 + da)); fc.swW = Math.abs(da) / n * 180 / Math.PI; }
    else { const d = _p.subVectors(spot, s0), L = d.length(), m = Math.min(STEP * n, Math.max(STEP * n * 0.3, (fc.swL || 0) + 0.015 * n), Math.max(0.01, Math.sqrt(0.015 * L)) * n); /* eases out */ if (L > m) d.multiplyScalar(m / L); fc.pos.copy(s0).add(d);
      let hx = fc.pos.x - P[0], hz = fc.pos.z - P[2], rh = Math.hypot(hx, hz); const rf = Math.min(r0, r1); if (rh < rf && rh > 1e-3) { hx *= rf / rh; hz *= rf / rh; rh = rf; } // never cut past him
      const ab = a0 + lim(wrap(Math.atan2(hz, hx) - a0), s0.distanceTo(_t) < HEAD_SOFT - 0.3 ? 9 : W_MAX * n); /* closer than 1.3 m: distance first, no bearing cap */ fc.pos.x = P[0] + rh * Math.cos(ab); fc.pos.z = P[2] + rh * Math.sin(ab); // and the same bearing-rate cap as the arc
      fc.swL = fc.pos.distanceTo(s0); }
    clampCam(fc.pos, CM); fc.swung = true; fc.tgt = polar(P, spot); fc.lock = fc.tick + n + SW_LOCK; }
  function followCam(P, yaw, o = {}) {
    const dist = portrait ? 3.9 : 3.8, aimY = P[1] + (portrait ? -0.15 : 0.05);
    _t.set(P[0], P[1] + 0.3, P[2]); // Bolt's head
    const tick = o.tick ?? fc.tick + 2, broom = P[2] < -5 ? 'cockpit' : 'cabin', dT = tick - fc.tick;
    // The camera has its own room. It stays in it while it can still see Bolt (e.g. through the doorway) and only cuts to
    // his room when no spot in its room works, and never within 0.5 s of a director cut (was: a hard 3-4 m cut on every
    // doorway crossing, one 0.3 s after the director's cockpit->follow cut in Ep1).
    const fresh = fc.view !== 'follow' || dT < 0 || dT > 30; // director cut, seek or still: re-pick in Bolt's room
    if (fresh) fc.cutTick = tick;
    let room = fresh ? broom : fc.room, cands, roomCut = false;
    const build = (rm) => { camRoom = rm; cands = []; // chase spots (ideal first, raised, swung around incl. side and front 3/4 spots), then the fixed spots of the camera's room
      for (const dy of [0, 0.6, -0.6, 1.1, -1.1, 1.7, -1.7, 2.4, -2.4, Math.PI]) for (const [d, h] of [[dist, 1.15], [dist * 0.85, 1.7], [dist * 0.7, 2.2]]) cands.push([yaw + dy, d, h]);
      for (const f of FIXED[rm]) cands.push([f]); };
    build(room);
    const pick = (near, ok) => { let best = null; // fresh: first good in order; else the good (then partly covered) spot with the shortest swing
      for (let k = 0; k < cands.length; k++) { const u = usable(P, aimY, candPos(P, cands[k], _c)); if (!u || (ok && !ok(_c))) continue; const pl = polar(P, _c);
        const cost = (u === 2 ? 0 : 100) + (near == null ? k * 0.01 : Math.abs(wrap(pl[0] - near)) + k * 0.001); if (!best || cost < best.cost) best = { cost, pl }; if (near == null && u === 2) break; }
      return best && best.pl; };
    const pickNearCam = (P, aimY) => { let best = null; for (let k = 0; k < cands.length; k++) { const u = usable(P, aimY, candPos(P, cands[k], _c)); if (!u) continue;
      const cost = (u === 2 ? 0 : 100) + _c.distanceTo(fc.pos); if (!best || cost < best.cost) best = { cost, pl: polar(P, _c) }; } return best && best.pl; };
    let tgt = fresh ? null : fc.tgt;
    if (tgt && FREE && tick < (fc.lock || 0)) { fromPolar(P, tgt, _c); clampCam(_c, CM); if (clear(_t, _c) !== Infinity) { fc.lock = 0; tgt = pick(fc.a); fc.blocked = 0; } } // v5 free play: hold the swung spot (hysteresis) while it stays clear
    else if (tgt) { fromPolar(P, tgt, _c); clampCam(_c, CM); const u = usable(P, aimY, _c); if (u === 2) fc.blocked = 0; else if (u === 0 || ++fc.blocked >= HOLD) { tgt = pick(fc.a); fc.blocked = 0; } }
    else { tgt = pick(fresh ? null : fc.a); fc.blocked = 0; }
    if (!tgt && room !== broom && tick - fc.cutTick >= 30) { room = broom; build(room); tgt = pick(null); roomCut = true; fc.roomCuts++; fc.cutTick = tick; }
    if (!tgt) { fixedCam(room, P, _g); tgt = polar(P, _g); fc.fixed++; }
    fc.tgt = tgt; fromPolar(P, tgt, _g); clampCam(_g, CM); // the target spot in the world (always clear: checked above)
    fc.swung = false; fc.hard = false;
    const _s0 = fc.pos.clone(); // v5: where the camera was last frame (the free-play soft swing caps the whole frame's move from here)
    if (fresh || roomCut) { [fc.a, fc.r, fc.h] = tgt; fc.va = fc.vr = fc.vh = 0; fc.pos.copy(_g); if (fc.view === 'follow') fc.cuts++; }
    else {
      const om = fc.occ > 0 ? OMEGA_OCC : OMEGA, h = 1 / 60, W2 = om * om, Z = 2 * om; /* v3: a quicker (still eased) spring while he's hidden */ for (let k = 0; k < Math.max(1, dT); k++) { // critically damped spring: eases in and out
        fc.va += (W2 * wrap(tgt[0] - fc.a) - Z * fc.va) * h; fc.vr += (W2 * (tgt[1] - fc.r) - Z * fc.vr) * h; fc.vh += (W2 * (tgt[2] - fc.h) - Z * fc.vh) * h;
        fc.a = wrap(fc.a + fc.va * h); fc.r += fc.vr * h; fc.h += fc.vh * h; }
      fromPolar(P, [fc.a, fc.r, fc.h], _c); clampCam(_c, CM); // room clamp first (same 0.3 m margin as the spots) ...
      _p.subVectors(_c, fc.pos); const L = _p.length(), cap = STEP * Math.max(1, dT) * (fc.occ > 0 ? 1.6 : 1); if (L > cap) { _p.multiplyScalar(cap / L); fc.capped++; } fc.pos.add(_p); // ... then the cap
    }
    const _w0 = fc.pos.clone(); fc.why = [];
    const hit = clear(_t, fc.pos); // something between his head and the camera mid-glide: pull in, but never closer than MIN_D; else cut to the (clear) target spot
    // v6.1 (M2 capture, 9:16 only): on the way back he walks out of the cockpit into the cabin while the narrow frame is parked
    // by the door wall; once he is through and the wall starts covering the frame (spot no longer clean), take the doorway cut
    // now instead of waiting for the wall to hide his head (Ep2 9:16: wall over ~40% of the frame 142.60-142.87 s, cut 142.90).
    // 16:9 keeps its own later cut (146.23 s); free play and Ep1 unchanged.
    const early = !FREE && !o.m1 && portrait && room === 'cockpit' && broom === 'cabin' && tick - fc.cutTick >= 30 && hit === Infinity && usable(P, aimY, fc.pos.clone()) !== 2;
    if ((hit !== Infinity || early) && room !== broom && tick - fc.cutTick >= 30) { // lost him through the doorway mid-glide: one clean cut to his room (not a pull-in, then a cut)
      // v6: the cut must read as a cut. In 9:16 the first spot in his room was 1.17 m / 27 deg from the camera, straight through
      // the door wall (the wall "vanished" with Bolt held in place, Ep2 9:16 142.90 s). Prefer a spot >= 2.5 m away and >= 40 deg round (v6: capture only; free play keeps v5).
      const aim = new THREE.Vector3(P[0], aimY, P[2]), dOld = aim.clone().sub(fc.pos).normalize();
      const realCut = (c) => c.distanceTo(fc.pos) >= 2.5 && aim.clone().sub(c).normalize().angleTo(dOld) >= 0.7;
      build(broom); const t2 = (!FREE && pick(null, realCut)) || pick(null) || polar(P, fixedCam(broom, P, _g)); fromPolar(P, t2, _g); clampCam(_g, CM); fc.pos.copy(_g); [fc.a, fc.r, fc.h] = t2; fc.tgt = t2; fc.va = fc.vr = fc.vh = 0; fc.cuts++; fc.roomCuts++; fc.cutTick = tick; room = broom; }
    else if (hit !== Infinity && (fc.occ = (fc.occ || 0) + Math.max(1, dT)) <= 2 * OCC_GRACE) { // v3 free play: keep easing, no snap
      if (fc.occ <= Math.max(1, dT) || (fc.occ > OCC_GRACE && fc.occ - Math.max(1, dT) <= OCC_GRACE)) { // on the first occluded frame and again after 0.4 s:
        const tn = pickNearCam(P, aimY); if (tn) { fc.tgt = tgt = tn; fc.why.push(['retarget']); } } } // ease to the clear spot nearest the camera itself
    else if (hit !== Infinity) { const D = _t.distanceTo(fc.pos), f = hit / D; if (f * D >= MIN_D) { fc.pos.copy(_t.clone().lerp(fc.pos, f)); fc.pulls++; } else { fc.pos.copy(_g); [fc.a, fc.r, fc.h] = tgt; fc.va = fc.vr = fc.vh = 0; fc.cuts++; } }
    if (hit === Infinity) fc.occ = 0;
    if (hit !== Infinity) fc.why.push(['occ', +(hit + 0.3).toFixed(2), +_t.distanceTo(_w0).toFixed(2)]);
    if (fc.pos.distanceTo(_w0) > 0.01) fc.why.push(['hit', +fc.pos.distanceTo(_w0).toFixed(2)]); const _w1 = fc.pos.clone();
    { // v3 free play: never steeper than PITCH_CAP (Playtest: 79 deg, 1.7 m straight above him in the cockpit's back-right corner).
      // Push it out along its own bearing to the cap distance; if a wall stops that, lower it to the cap height.
      const hx = fc.pos.x - P[0], hz = fc.pos.z - P[2], hd = Math.hypot(hx, hz), lim = Math.tan(PITCH_CAP * Math.PI / 180);
      if (!FREE) { if (fc.pos.y - aimY > lim * hd) { const _q = fc.pos.clone(), want = (fc.pos.y - aimY) / lim, k = want / Math.max(hd, 1e-3); // capture: v3 as-is
        if (hd > 1e-3) { fc.pos.x = P[0] + hx * k; fc.pos.z = P[2] + hz * k; clampCam(fc.pos, CM); }
        const hd2 = Math.hypot(fc.pos.x - P[0], fc.pos.z - P[2]);
        if (fc.pos.y - aimY > lim * hd2) fc.pos.y = Math.max(aimY + 0.2, aimY + lim * hd2);
        fc.why.push(['pitch', +fc.pos.distanceTo(_q).toFixed(2)]); } }
      else { // free play. v4: over the cap, push out along its bearing (instant, as v3); if a wall stops that, swing around him
        // instead of lowering it onto him (v3: 0.36 m from his head). v5 (Playtest 14:52: 4.5 Hz judder turning by the plant,
        // 75 deg whip in 0.2 s, 55 deg held 2.0 s): the swing starts at 46 deg (before the cap), aims for a 38 deg spot (else 55),
        // runs along an eased arc (easeTo), keeps going down to 41 deg (hysteresis), and its spot becomes the spring target (SW_LOCK).
        const over = fc.pos.y - aimY > lim * hd, pNow = pitchOf(fc.pos, P, aimY);
        if (over || pNow > (fc.pitchOn ? 41 : 46)) { /* starts at 46 deg so the eased swing has time before the cap; runs down to 41 */ const _q = fc.pos.clone(), dy = fc.pos.y - aimY;
          if (over && hd > 1e-3) { const k = dy / lim / hd; fc.pos.x = P[0] + hx * k; fc.pos.z = P[2] + hz * k; clampCam(fc.pos, CM); }
          const base = fc.pos.clone(), still = pitchOf(base, P, aimY) > 41;
          if (still) { const a0 = Math.atan2(_q.z - P[2], _q.x - P[0]), dir = fc.tgt && wrap(fc.tgt[0] - a0) < 0 ? -1 : 1; let sw = null;
            for (const pd of [38, PITCH_CAP]) { const want = dy / Math.tan(pd * Math.PI / 180); _a.set(P[0] + hx / Math.max(hd, 1e-3) * want, _q.y, P[2] + hz / Math.max(hd, 1e-3) * want); const ax = _a.x, az = _a.z; clampCam(_a, CM);
              if (Math.hypot(_a.x - ax, _a.z - az) < 0.05 && clear(_t, _a) === Infinity) { sw = _a.clone(); break; } // straight out works
              if ((sw = swingSpot(P, _q, want, [_q.y], dir))) break; }
            if (sw) { if (fresh || roomCut) fc.pos.copy(sw); else easeTo(sw, over ? base : _s0, P, dT, true); fc.pitchOn = true; fc.why.push(['swing']); }
            else { fc.pitchOn = false; if (over) { const hd2 = Math.hypot(base.x - P[0], base.z - P[2]); if (base.y - aimY > lim * hd2) { fc.pos.copy(_q); fc.why.push(['pitchHold']); } } } }
          else fc.pitchOn = false;
          [fc.a, fc.r, fc.h] = polar(P, fc.pos); fc.va = fc.vr = fc.vh = 0; fc.why.push(['pitch', +fc.pos.distanceTo(_q).toFixed(2)]); }
        else fc.pitchOn = false; } }
    if (FREE) { // free play: personal space around his head
      // v5 (Polish 15:46: floating into the cockpit's front-left corner left the camera parked in the clamp corner, 0.52 m from
      // his face, half of him off-screen; v4 pushed straight out, the clamp pulled it back, the up-fallback stopped at the
      // ceiling). Inside HEAD_SOFT (1.6 m = MIN_D) it now swings around him, eased (<= 0.18 m per frame), to the nearest clear in-room
      // spot at HEAD_SOFT + 0.2 m, and the spring restarts from there (its polar state had been left outside the walls).
      const top = (camRoom === 'cockpit' ? CKP.y : CAB.y) - CM, L0 = fc.pos.distanceTo(_t);
      if (L0 >= HEAD_SOFT + 0.15) fc.softOn = false;
      if (L0 < HEAD_SOFT || (fc.softOn && L0 < HEAD_SOFT + 0.15)) { fc.softOn = false; const _q = fc.pos.clone(), dir = fc.tgt && wrap(fc.tgt[0] - Math.atan2(_q.z - P[2], _q.x - P[0])) < 0 ? -1 : 1;
        const sw = swingSpot(P, _q, 0, [_q.y, Math.min(top, _t.y + 0.5), Math.min(top, _t.y + 1.0), Math.min(top, _t.y + 1.4), Math.max(0.5, _t.y - 0.2)], dir, HEAD_SOFT + 0.3); /* goes to 1.9 m, stops once past 1.75 m (v5 rc2: stop band 1.85 > spot 1.8 kept it on, fighting the occlusion retarget at 10-30 Hz by the seat) */
        if (sw && !fresh && !roomCut) { easeTo(sw, fc.swung ? fc.pos.clone() : _s0, P, dT); fc.softOn = true; // hysteresis: keeps going until 0.15 m past HEAD_SOFT
          [fc.a, fc.r, fc.h] = polar(P, fc.pos); fc.va = fc.vr = fc.vh = 0; fc.why.push(['soft', +fc.pos.distanceTo(_q).toFixed(2)]); } }
      // v4 hard floor HEAD_MIN (0.8 m): push straight out from his head; if a wall stops that, the nearest clear spot at
      // HEAD_MIN + 0.1 m (no ease: last resort); else up to the ceiling.
      _a.subVectors(fc.pos, _t); const L = _a.length(); if (L < HEAD_MIN) { const _q = fc.pos.clone(); if (L > 1e-3) fc.pos.copy(_t).addScaledVector(_a, HEAD_MIN / L); clampCam(fc.pos, CM);
        if (fc.pos.distanceTo(_t) < HEAD_MIN) { const sw = swingSpot(P, _q, HEAD_MIN + 0.1, [_q.y, Math.min(top, _t.y + 0.5)], 1); if (sw) fc.pos.copy(sw); }
        const L2 = fc.pos.distanceTo(_t); if (L2 < HEAD_MIN) fc.pos.y = Math.min(top, _t.y + Math.sqrt(Math.max(0, HEAD_MIN * HEAD_MIN - (fc.pos.x - _t.x) ** 2 - (fc.pos.z - _t.z) ** 2)));
        [fc.a, fc.r, fc.h] = polar(P, fc.pos); fc.va = fc.vr = fc.vh = 0; fc.hard = true; fc.why.push(['head', +fc.pos.distanceTo(_q).toFixed(2)]); } }
    if (FREE && fc.swung && !fresh && !roomCut && !fc.hard) { const d = _p.subVectors(fc.pos, _s0), L = d.length(), m = 0.1 * Math.max(1, dT); if (L > m) { fc.pos.copy(_s0).addScaledVector(d, m / L); [fc.a, fc.r, fc.h] = polar(P, fc.pos); fc.why.push(['frameCap', +L.toFixed(2)]); } } // v5: a swing frame moves <= 0.2 m in free play (swing + keep-out together; pull-ins/cuts untouched)
    camRoom = room; ringsOut(fc.pos); if (FREE && !fc.swung) fc.swW = fc.swL = 0; if (fc.pos.distanceTo(_w1) > 0.01) fc.why.push(['rings', +fc.pos.distanceTo(_w1).toFixed(2)]); // the cap / a pull-in can leave it a few cm inside a ring's keep-out: settle it back out
    if (FREE) { const vx = fc.lastP && dT > 0 ? (P[0] - fc.lastP[0]) / dT : 0, vz = fc.lastP && dT > 0 ? (P[2] - fc.lastP[2]) / dT : 0, sp = Math.hypot(vx, vz); fc.vel = sp > 0.01 && !fresh ? [vx / sp, vz / sp] : null; fc.lastP = [P[0], P[2]]; }
    Object.assign(fc, { idx: tgt ? 1 : -1, tick, room, view: 'follow' });
    cam.position.copy(fc.pos); cam.lookAt(P[0], aimY, P[2]);
  }
  // window resize (free play): new drawing-buffer size, aspect and the same portrait/landscape FOV rules as at start.
  // The exterior camera keeps its own FOV rule (space.mjs); its 9:16 framing offsets are still chosen once, at creation.
  function resize(w, h) {
    if (!(w > 0 && h > 0) || (w === W && h === H)) return false; W = w; H = h; r.setSize(w, h, false);
    cam.aspect = w / h; cam.fov = w < h ? 62 : 58; cam.updateProjectionMatrix();
    if (space) { space.camera.aspect = w / h; space.camera.fov = w > h ? 55 : 68; space.camera.updateProjectionMatrix(); }
    return true;
  }
  return { render, resize, placeCam, renderer: r, scene, camera: cam, bolt, get space() { return space; }, setDebug(v) { dbg.visible = !!v; return dbg.visible; }, get debug() { return dbg.visible; }, camStats: () => ({ cuts: fc.cuts, roomCuts: fc.roomCuts, pulls: fc.pulls, fixed: fc.fixed, capped: fc.capped, idx: fc.idx, room: fc.room, why: fc.why, tgt: fc.tgt && fc.tgt.map(v => +v.toFixed(2)) }) /* why: what moved the camera this frame (occ/retarget/hit/pitch/rings), for the tests */ };
}
