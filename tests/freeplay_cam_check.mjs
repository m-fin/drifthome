// Free-play follow-camera check (index.html live-play path, keyboard + mouse-yaw routes, 1 frame = dh.tick(2) = 30 fps).
// Routes from the Playtest Lead's 2026-10-20 harness (cabin_walk_tour, float_tour, doorway_pingpong) plus the three repros:
//   seat: wake, walk (0,-6.5) -> (-2.4,-6.0) -> (-2.4,-8.4) around the cockpit seat
//   corner: walk along the cockpit back wall into (2.4,-5.7)
//   ceiling: float to (0,3,0) then along the ceiling under the handholds to (-3,3.1,0) and (3,3.1,0)
// Per frame: camera move (re-frame = > 0.25 m without a room cut), clearance from the camera to the nearest solid box (seat,
// walls, props; near plane 0.10), look-down pitch toward Bolt. v4: camera distance to Bolt's head (minHeadDist), share of
// his 27-point hull sample inside the frame (minInFrame, framesNotFull), the share of the frame his hull's screen box covers
// (maxScreenShare) and the longest hold at the 55 deg cap (capHold_s). v5: judder = camera move reversals (dot < 0, both > 1 cm): judderMaxPerSec
// (most in any 1 s), judderAmp (largest move at a reversal), judderAmpOver5cm; maxPan02_deg (view yaw change in 0.2 s); headTopOut_s (longest run with his head top off-frame). Routes corner_walk / float_wall_corner = Playtest 13:36 repros. One headless Chrome (320x180) + local server, both closed.
//   node tests/freeplay_cam_check.mjs [--old DIR] [--only ROUTE[,ROUTE...]] [--trace t0,t1]
import fs from 'fs'; import http from 'http'; import path from 'path';
import puppeteer from '/workspace/crave-lab/tools/cdp/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const ROOTS = { new: path.resolve(path.dirname(new URL(import.meta.url).pathname), '..') }; if (arg('--old')) ROOTS.old = path.resolve(arg('--old'));
const W0 = { wake: 1 }, H10 = { hold: 10 };
const CORNER = ([x, z], fy) => [W0, H10, { to: [0, 0, -3.5] }, { to: [0, 0, -6.6] }, ...(fy ? [{ float: 1 }, { to: [0, fy, -6.6], y: 1, max: 120 }] : []),
  { to: [x, fy || 0, z], max: 150, tol: 0.05, ...(fy ? { y: 1 } : {}) }, { hold: 30, push: 1 }];
const ROUTES = {
  seat: [W0, H10, { to: [0, 0, -3.5] }, { to: [0, 0, -6.5] }, { to: [-2.4, 0, -6.0] }, { to: [-2.4, 0, -8.4] }, { to: [2.4, 0, -8.4] }, { to: [0, 0, -6.5] }],
  corner: [W0, H10, { to: [0, 0, -3.5] }, { to: [0, 0, -6.5] }, { to: [2.4, 0, -8.4] }, { to: [2.4, 0, -5.7], max: 120 }, { hold: 30 }, { to: [-2.4, 0, -5.7], max: 120 }, { hold: 30 }],
  ceiling: [W0, H10, { float: 1 }, { to: [0, 3.0, 0], y: 1 }, { to: [-3, 3.1, 0], y: 1 }, { to: [3, 3.1, 0], y: 1 }, { to: [0, 3.1, -3], y: 1 }, { to: [-3, 3.1, 0], y: 1 }],
  cabin_walk_tour: [W0, H10, { to: [-2.5, 0, 1.0] }, { to: [-2.0, 0, -3.8] }, { to: [-3.6, 0, -3.3] }, { to: [0, 0, -3.5] }, { to: [0, 0, -6.5] }, { to: [-2.4, 0, -6.0] }, { to: [-2.4, 0, -8.4] },
    { to: [2.4, 0, -8.4] }, { to: [2.4, 0, -5.7] }, { to: [0, 0, -5.8] }, { to: [0, 0, -3.0] }, { to: [5.4, 0, -4.4] }, { to: [5.4, 0, 3.0] }, { to: [5.5, 0, 4.0], max: 90 },
    { to: [3.0, 0, 4.5] }, { to: [-3.0, 0, 4.5] }, { to: [-3.0, 0, 0] }, { to: [-5.4, 0, -1.0] }, { to: [-5.5, 0, -4.6], max: 60 }, { to: [0, 0, 0] }],
  float_tour: [W0, H10, { float: 1 }, { to: [0, 3.0, 0], y: 1 }, { to: [-3, 3.1, 0], y: 1 }, { to: [3, 3.1, 0], y: 1 }, { to: [0, 3.1, -3], y: 1 }, { to: [-5.4, 2.6, -1.5], y: 1 },
    { to: [0, 1.2, -4.0], y: 1 }, { to: [0, 1.2, -7.0], y: 1 }, { to: [2.4, 2.0, -8.4], y: 1 }, { to: [-2.4, 0.6, -8.4], y: 1 }, { to: [0, 1.2, -5.8], y: 1 }, { to: [0, 1.2, -3.0], y: 1 },
    { to: [5.4, 2.2, 0], y: 1 }, { to: [5.4, 0.6, 4.0], y: 1, max: 90 }, { to: [-4.6, 1.4, 3.4], y: 1 }, { to: [0, 2.0, 0], y: 1 }],
  // v4 (Playtest 13:36): the 55 deg cap pinned the camera and lowered it onto him
  corner_walk: [W0, H10, { to: [0, 0, -6.5] }, { to: [-2.4, 0, -6.0] }, { to: [-2.4, 0, -8.4] }, { to: [2.4, 0, -8.4] }, { to: [2.4, 0, -5.7], max: 150 }, { hold: 45 }],
  float_wall_corner: [W0, H10, { float: 1 }, { to: [5.4, 2.2, 0], y: 1 }, { to: [5.4, 0.6, 4.0], y: 1, max: 90 }, { to: [-4.6, 1.4, 3.4], y: 1, max: 400 }, { hold: 60 }],
  // v5: Polish 15:46 corner_check.py corner routes (cockpit corners, floating at 1.8 m / 2.3 m, push into the corner and hold W 1 s)
  float_FL: CORNER([-2.95, -8.95], 1.8), high_FL: CORNER([-2.95, -8.95], 2.3), float_BL: CORNER([-2.95, -5.25], 1.8), high_BL: CORNER([-2.95, -5.25], 2.3),
  walk_FR: CORNER([2.95, -8.95]),
  // v5: Playtest 14:52 spin_near_walls start: turn in place by the door, walk to the plant corner, keep turning there (v4: 4.5 Hz judder 13.1-14.5 s)
  plant_turn: [W0, { hold: 5 }, { to: [-1, 0, -4.2] }, { spin: 0.25, frames: 50 }, { to: [4.8, 0, 3.4] }, { spin: -0.25, frames: 50 }, { spin: -0.25, frames: 50 }],
  doorway_pingpong: [W0, { hold: 5 }, { to: [0, 0, -3.5] }, ...Array(6).fill([{ to: [0, 0, -5.3], tol: 0.12 }, { to: [0, 0, -4.7], tol: 0.12 }]).flat()],
};
const RUN = async ({ route, maxFrames, TR }) => {
  const THREE = await import('./vendor/three.module.js'); const dh = window.dh;
  const solid = []; // static solid boxes (as the Playtest harness): visible, opaque, not Bolt / debug / shadow proxies; the door slab as its 3 parts
  const scene = (() => { let s = null; const f = THREE.Scene.prototype.onBeforeRender; THREE.Scene.prototype.onBeforeRender = function () { s = this; }; dh.tick(0, {}); THREE.Scene.prototype.onBeforeRender = f; return s; })();
  scene.traverse(m => { if (!m.isMesh) return; for (let p = m; p; p = p.parent) { if (p.visible === false) return; if (p.type === 'Group' && p.parent === scene) return; }
    if (m.material.transparent || m.material.wireframe || m.material.colorWrite === false) return; m.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(m, true);
    if (b.max.x < -6.5 || b.min.x > 6.5 || b.min.y > 4.5 || b.max.z > 5.5 || b.min.z < -9.5) return;
    if (m.geometry.type === 'ExtrudeGeometry') { const z0 = b.min.z, z1 = b.max.z; solid.push([[-6, 0, z0], [-1, 4, z1], 'door_wall'], [[1, 0, z0], [6, 4, z1], 'door_wall'], [[-1, 2.6, z0], [1, 4, z1], 'door_wall']); return; }
    solid.push([b.min.toArray(), b.max.toArray(), m.geometry.type + '@' + b.getCenter(new THREE.Vector3()).toArray().map(v => v.toFixed(2)).join(',')]); });
  const clearOf = (c) => { let best = [9, null]; for (const [mn, mx, n] of solid) { const d = Math.hypot(...[0, 1, 2].map(i => Math.max(mn[i] - c[i], 0, c[i] - mx[i]))); if (d < best[0]) best = [d, n]; } return best; };
  const yawTo = (o, t) => Math.atan2(-(t[2] - o.pos[2]), t[0] - o.pos[0]);
  const turn = (dy) => dispatchEvent(new MouseEvent('mousemove', { movementX: -dy / 0.004, movementY: 0 }));
  const B = { r: 0.35, down: 0.53, up: 0.88 }, V = new THREE.Vector3(), CAP = 55;
  const boltView = (cam, o) => { cam.updateMatrixWorld(); let n = 0, tot = 0, x0 = 1, x1 = -1, y0 = 1, y1 = -1; // Playtest's 27-point hull sample: share inside the frame; and the hull's screen box
    for (const dx of [-B.r, 0, B.r]) for (const dz of [-B.r, 0, B.r]) for (const dy of [-B.down, 0, B.up]) { V.set(o.pos[0] + dx, o.pos[1] + dy, o.pos[2] + dz).project(cam); tot++;
      if (V.z < 1 && V.z > -1 && Math.abs(V.x) <= 1 && Math.abs(V.y) <= 1) n++; if (V.z < 1) { x0 = Math.min(x0, V.x); x1 = Math.max(x1, V.x); y0 = Math.min(y0, V.y); y1 = Math.max(y1, V.y); } }
    const cx = Math.max(0, Math.min(1, x1) - Math.max(-1, x0)), cy = Math.max(0, Math.min(1, y1) - Math.max(-1, y0)); return [n / tot, cx * cy / 4]; };
  let o = dh.o, f = 0, prev = null, prevStats = null; const S = { frames: 0, reframes: [], roomCuts: 0, minClear: 9, minClearAt: null, minClearWhat: null, nearPlane: 0, maxPitch: 0, maxPitchAt: null, pitch60: 0, pitch50: 0, worstStep: 0, worstStepAt: null, minHeadDist: 9, minHeadAt: null, minInFrame: 1, minInFrameAt: null, framesNotFull: 0, maxScreenShare: 0, maxShareAt: null, capHold_s: 0, capHoldAt: null };
  let capRun = 0, prevD = null, headRun = 0; const revs = [], yaws = []; const _dir = new THREE.Vector3(); // v5: judder (direction reversals), pan rate, head-top crop
  const rec = () => { const c = dh.cam, p = c.pos; const st = c.stats; const t = +o.t_s.toFixed(2);
    if (prev) { const d = Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]); const rc = st.roomCuts > prevStats.roomCuts;
      if (rc) S.roomCuts++; else { if (d > 0.25) S.reframes.push([t, +d.toFixed(2)]); if (d > S.worstStep) { S.worstStep = +d.toFixed(3); S.worstStepAt = t; } } }
    const [cl, what] = clearOf(p); if (cl < S.minClear) { S.minClear = +cl.toFixed(3); S.minClearAt = t; S.minClearWhat = what; } if (cl < c.near) S.nearPlane++;
    const aimY = o.pos[1] + 0.05, pitch = Math.atan2(p[1] - aimY, Math.hypot(p[0] - o.pos[0], p[2] - o.pos[2])) * 180 / Math.PI;
    if (pitch > S.maxPitch) { S.maxPitch = +pitch.toFixed(1); S.maxPitchAt = t; } if (pitch > 60) S.pitch60++; if (pitch > 50) S.pitch50++;
    const hd = Math.hypot(p[0] - o.pos[0], p[1] - (o.pos[1] + 0.3), p[2] - o.pos[2]); if (hd < S.minHeadDist) { S.minHeadDist = +hd.toFixed(3); S.minHeadAt = t; }
    const [inF, share] = boltView(c.obj, o); if (inF < S.minInFrame) { S.minInFrame = +inF.toFixed(3); S.minInFrameAt = t; } if (inF < 1) S.framesNotFull++; if (share > S.maxScreenShare) { S.maxScreenShare = +share.toFixed(3); S.maxShareAt = t; }
    capRun = pitch >= CAP - 0.5 ? capRun + 1 : 0; if (capRun / 30 > S.capHold_s) { S.capHold_s = +(capRun / 30).toFixed(2); S.capHoldAt = t; }
    if (TR && t >= TR[0] && t <= TR[1]) (S.trace ||= []).push([t, o.pos.map(v => +v.toFixed(2)), p.map(v => +v.toFixed(2)), +pitch.toFixed(1), +hd.toFixed(2), +inF.toFixed(2), JSON.stringify(st.why), st.tgt, st.fixed, st.room]);
    if (prev) { const d = [p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]], L = Math.hypot(...d); // judder: the camera's move reverses (dot < 0), both moves > 1 cm
      if (prevD && L > 0.01 && prevD[3] > 0.01 && d[0] * prevD[0] + d[1] * prevD[1] + d[2] * prevD[2] < 0 && !(st.roomCuts > prevStats.roomCuts)) revs.push([t, Math.max(L, prevD[3])]); prevD = st.roomCuts > prevStats.roomCuts ? null : [...d, L]; if (!prevD) yaws.length = 0; } // a room cut is not judder or a pan
    c.obj.getWorldDirection(_dir); yaws.push(Math.atan2(_dir.z, _dir.x)); if (yaws.length > 6) { let dy = yaws.at(-1) - yaws.at(-7); dy = Math.abs(Math.atan2(Math.sin(dy), Math.cos(dy))) * 180 / Math.PI; if (dy > (S.maxPan02_deg || 0)) { S.maxPan02_deg = +dy.toFixed(1); S.maxPanAt = t; } }
    V.set(o.pos[0], o.pos[1] + B.up, o.pos[2]).project(c.obj); headRun = (V.z >= 1 || Math.abs(V.x) > 1 || Math.abs(V.y) > 1) ? headRun + 1 : 0; if (headRun / 30 > (S.headTopOut_s || 0)) { S.headTopOut_s = +(headRun / 30).toFixed(2); S.headTopOutAt = t; }
    prev = p; prevStats = st; S.frames++; f++; };
  const step = (keys, float) => { o = dh.tick(2, { keys, float }); rec(); };
  for (const seg of route) {
    if (seg.wake) { step(['KeyW']); continue; } if (seg.float) { step([], true); continue; }
    if (seg.spin) { for (let i = 0; i < seg.frames; i++) { turn(seg.spin); step(seg.keys || []); } continue; } // turn in place seg.spin rad per frame (Playtest spin_near_walls)
    if (seg.hold) { for (let i = 0; i < seg.hold; i++) step(seg.push ? ['KeyW'] : []); continue; }
    if (seg.to) for (let i = 0; i < (seg.max || 400) && f < maxFrames; i++) { const d = seg.to.map((v, k) => v - o.pos[k]), hd = Math.hypot(d[0], d[2]);
      if (hd < (seg.tol || 0.3) && (!seg.y || Math.abs(d[1]) < 0.3)) break;
      let dy = yawTo(o, seg.to) - o.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); turn(dy);
      const keys = hd > (seg.tol || 0.3) ? ['KeyW'] : []; if (seg.y && o.mode === 'float') { if (d[1] > 0.2) keys.push('Space'); else if (d[1] < -0.2) keys.push('KeyC'); } step(keys); }
  }
  { let mx = 0, at = null; for (const [t0] of revs) { const n = revs.filter(([t1]) => t1 >= t0 && t1 < t0 + 1).length; if (n > mx) { mx = n; at = t0; } }
    S.judderRevs = revs.length; S.judderMaxPerSec = mx; S.judderAt = at; S.judderAmp = +revs.reduce((m, r) => Math.max(m, r[1]), 0).toFixed(3); S.judderAmpOver5cm = revs.filter(r => r[1] > 0.05).length; S.maxPan02_deg ||= 0; S.headTopOut_s ||= 0; }
  S.reframeCount = S.reframes.length; S.maxReframe = S.reframes.reduce((m, r) => Math.max(m, r[1]), 0); S.end = { t: o.t_s, pos: o.pos.map(v => +v.toFixed(2)) };
  return S;
};
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript' };
const srv = http.createServer((q, s) => { const u = decodeURI(q.url.split('?')[0]); const m = u.match(/^\/([a-z0-9_]+)\/(.*)$/); if (!m || !ROOTS[m[1]]) { s.writeHead(404); return s.end(); }
  const f = path.join(ROOTS[m[1]], m[2]); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); }); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--window-size=320,180'] });
const out = {};
try {
  for (const b of Object.keys(ROOTS)) for (const [name, route] of Object.entries(ROUTES)) { if (arg('--only') && !arg('--only').split(',').includes(name)) continue;
    const page = await browser.newPage(); await page.setViewport({ width: 320, height: 180 }); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(`http://127.0.0.1:${srv.address().port}/${b}/index.html?seed=1&manual=1&w=320&h=180`); await page.waitForFunction(() => window.dh && window.dh.o, { timeout: 60000 });
    if (!(await page.evaluate(() => 'cam' in window.dh))) { console.log(b, name, 'skipped (no dh.cam in this build)'); await page.close(); continue; }
    const r = await page.evaluate(`(${RUN})(${JSON.stringify({ route, maxFrames: 4000, TR: arg('--trace') ? arg('--trace').split(',').map(Number) : null })})`); r.errors = errs; (out[b] ||= {})[name] = r; await page.close();
    const { reframes, trace, ...rest } = r; if (trace) for (const x of trace) console.log('   ', JSON.stringify(x)); console.log(b, name, JSON.stringify(rest), 'reframes', JSON.stringify(reframes.slice(0, 12)));
  }
} finally { await browser.close(); srv.close(); }
fs.writeFileSync(path.join(ROOTS.new, 'tests/freeplay_cam_check_result.json'), JSON.stringify({ when: new Date().toString(), out }, null, 1));
