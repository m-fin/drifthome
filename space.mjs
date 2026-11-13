// DRIFTHOME M2 exterior: the space scene the ship flies through. Reads sim state only; never changes it.
// createSpace(THREE, W, seed, W_px, H_px) -> { scene, camera, update(o, view) }. W = buildWorld(seed) from world.mjs.
// Look: invented, cozy palette (cream/terracotta ship, rose-peach-teal nebula, warm meadow planet "Ember", amber lamps).
import { SHIP } from './world.mjs';
export function createSpace(THREE, W, seed, PW, PH) {
  const scene = new THREE.Scene(); const SPACE_BG = new THREE.Color(0x070814), SKY_BG = new THREE.Color(0x8fb2d8);
  scene.background = SPACE_BG.clone(); scene.fog = new THREE.FogExp2(0x2a1a3a, 0);
  const cam = new THREE.PerspectiveCamera(PW > PH ? 55 : 68, PW / PH, 0.5, 40000);
  let rs = (seed * 7919 + 17) >>> 0; const rnd = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; };
  const V = (a) => new THREE.Vector3(...a);
  // --- small deterministic 3D value noise for rocks and terrain
  const hash = (x, y, z) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647) ^ seed; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const sm = (t) => t * t * (3 - 2 * t);
  function vnoise(x, y, z) { const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi); let v = 0;
    for (let c = 0; c < 8; c++) { const dx = c & 1, dy = (c >> 1) & 1, dz = c >> 2; v += hash(xi + dx, yi + dy, zi + dz) * (dx ? xf : 1 - xf) * (dy ? yf : 1 - yf) * (dz ? zf : 1 - zf); } return v; }
  const fbm = (x, y, z, o = 4) => { let v = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { v += a * vnoise(x * f, y * f, z * f); a *= 0.5; f *= 2.03; } return v; };
  // --- lights: warm sun from behind the route (+z), soft blue/plum ambient
  const sunDir = new THREE.Vector3(-0.45, 0.62, 0.65).normalize();
  const sun = new THREE.DirectionalLight(0xffe2b8, 2.4); sun.position.copy(sunDir).multiplyScalar(100); scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0x9fb6ff, 0x3a2638, 0.55); scene.add(hemi);
  const fill = new THREE.DirectionalLight(0xb8c8ff, 0.7); fill.position.set(0.6, 0.2, -1).multiplyScalar(100); scene.add(fill); // soft cool fill on the faces the sun misses
  // --- sky: stars + far glow, both follow the camera
  const sky = new THREE.Group(); scene.add(sky);
  { const p = [], c = []; for (let i = 0; i < 3500; i++) { const u = rnd() * 2 - 1, th = rnd() * 6.283, r = Math.sqrt(1 - u * u); p.push(r * Math.cos(th) * 20000, u * 20000, r * Math.sin(th) * 20000); const w = 0.6 + rnd() * 0.4, warm = rnd(); c.push(w, w * (0.9 + warm * 0.1), w * (0.85 + (1 - warm) * 0.15)); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    sky.starMat = new THREE.PointsMaterial({ size: 1.7, vertexColors: true, sizeAttenuation: false, fog: false, transparent: true }); sky.add(new THREE.Points(g, sky.starMat)); }
  // soft round + cloudy sprite textures (canvas, generated, no files)
  function softTex(n = 128) { const cv = document.createElement('canvas'); cv.width = cv.height = n; const x = cv.getContext('2d'); const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); return new THREE.CanvasTexture(cv); }
  function cloudTex(k, n = 128) { const cv = document.createElement('canvas'); cv.width = cv.height = n; const x = cv.getContext('2d'), im = x.createImageData(n, n);
    for (let yy = 0; yy < n; yy++) for (let xx = 0; xx < n; xx++) { const u = xx / n - 0.5, v = yy / n - 0.5, r = Math.hypot(u, v) * 2; const f = fbm(xx / 22 + k * 13, yy / 22, k * 7.1, 5);
      const a = Math.max(0, 1 - r) ** 1.6 * Math.max(0, Math.min(1, (f - 0.28) * 2.2)); const o = (yy * n + xx) * 4; im.data[o] = im.data[o + 1] = im.data[o + 2] = 255; im.data[o + 3] = a * 255; }
    x.putImageData(im, 0, 0); return new THREE.CanvasTexture(cv); }
  const soft = softTex(), clouds = [0, 1, 2, 3].map(k => cloudTex(k));
  for (let i = 0; i < 10; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: clouds[i % 4], color: [0x7a3cff, 0xff6fa8, 0x2fa7ff, 0xffa060][i % 4], transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    const d = new THREE.Vector3(rnd() - 0.5, (rnd() - 0.4) * 0.6, rnd() - 0.5).normalize(); if (d.z > 0.2) d.z *= -1; s.position.copy(d.multiplyScalar(15000)); s.scale.setScalar(5000 + rnd() * 6000); sky.add(s); }
  const sunSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: 0xffd9a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); sunSpr.position.copy(sunDir).multiplyScalar(15000); sunSpr.scale.setScalar(1800); sky.add(sunSpr);
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
  const E = (c, i = 2) => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: c, emissiveIntensity: i });
  // decals that sit a few cm off a surface: pull them toward the camera in depth so they never z-fight from far away
  // (at 900 m with near 0.5 the depth step is ~0.1 m, bigger than the 0.01-0.03 m gaps below)
  const D = (m) => Object.assign(m, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const put = (parent, geo, mat, p, rot, sc) => { const m = new THREE.Mesh(geo, mat); m.position.set(...p); if (rot) m.rotation.set(...rot); if (sc) m.scale.set(...sc); parent.add(m); return m; };
  // ================= ship exterior (nose -z, window on +x, matches the cabin layout) =================
  const ship = new THREE.Group(); scene.add(ship); const nozzles = [];
  const hullM = M(0xeadcc2, { roughness: 0.45, metalness: 0.15 }), stripeM = M(0xc8643c, { roughness: 0.5 }), darkM = M(0x3a3f4a, { metalness: 0.5, roughness: 0.4 });
  put(ship, new THREE.CapsuleGeometry(3, 9, 8, 24), hullM, [0, 0, 1], [Math.PI / 2, 0, 0], [2.05, 1, 0.95]);                 // main cabin hull
  put(ship, new THREE.CapsuleGeometry(3.08, 9, 8, 24), stripeM, [0, -0.2, 1], [Math.PI / 2, 0, 0], [2.07, 0.25, 0.96]);     // terracotta belly stripe
  put(ship, new THREE.SphereGeometry(3.2, 24, 16), hullM, [0, 0.3, -8], null, [1.25, 0.9, 1.2]);                            // cockpit pod
  const canopy = put(ship, new THREE.SphereGeometry(2.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.4), new THREE.MeshStandardMaterial({ color: 0x1c3440, emissive: 0x3fd8e8, emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.3 }), [0, 1.0, -9.1], [-1.15, 0, 0], [1.1, 1, 1]);
  const winGlow = put(ship, new THREE.PlaneGeometry(5.6, 2.0), D(E(0xffa45a, 2.6)), [6.25, 0.3, 0.6], [0, Math.PI / 2, 0]);    // cabin window glows warm
  put(ship, new THREE.BoxGeometry(0.2, 2.3, 5.9), darkM, [6.12, 0.3, 0.6]);
  for (const sx of [-1, 1]) {
    put(ship, new THREE.BoxGeometry(4.2, 0.5, 5), hullM, [sx * 7.3, -0.6, 4.2], [0, 0, sx * -0.12]);                         // stubby wings
    put(ship, new THREE.BoxGeometry(0.4, 2.2, 3.2), stripeM, [sx * 9.2, 0.2, 5.2]);                                          // wing fins
    put(ship, new THREE.CylinderGeometry(1.25, 1.45, 4.4, 20), hullM, [sx * 4.2, -0.3, 8.0], [Math.PI / 2, 0, 0]);           // engine pods
    put(ship, new THREE.CylinderGeometry(1.48, 1.48, 0.7, 20), stripeM, [sx * 4.2, -0.3, 7.0], [Math.PI / 2, 0, 0]);
    put(ship, new THREE.TorusGeometry(1.1, 0.2, 8, 20), darkM, [sx * 4.2, -0.3, 10.2]);
    nozzles.push(put(ship, new THREE.CircleGeometry(0.95, 20), E(0x4fd0e0, 1.2), [sx * 4.2, -0.3, 10.15]));                 // nozzle glow
    put(ship, new THREE.BoxGeometry(0.4, 0.4, 13), darkM, [sx * 3.4, -SHIP.hullDown + 0.2, -0.5]);                           // skids
    for (const z of [-5, 4]) put(ship, new THREE.BoxGeometry(0.3, 1.4, 0.3), darkM, [sx * 3.4, -SHIP.hullDown + 0.9, z]);
    put(ship, new THREE.SphereGeometry(0.28, 8, 6), E(sx > 0 ? 0x5dff8a : 0xff5050, 4), [sx * 9.4, 1.4, 5.2]);                 // running lights
  }
  put(ship, new THREE.CylinderGeometry(0.07, 0.07, 2.2, 6), darkM, [0, 3.6, 3]); const beacon = put(ship, new THREE.SphereGeometry(0.25, 10, 8), E(0xffb03d, 4), [0, 4.75, 3]);
  const plumes = [-1, 1].map(sx => { const m = put(ship, new THREE.ConeGeometry(0.9, 1, 18, 1, true), new THREE.MeshBasicMaterial({ color: 0x7fe9ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }), [sx * 4.2, -0.3, 11], [-Math.PI / 2, 0, 0]); return m; });
  const plumeGlow = [-1, 1].map(sx => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: 0x7fe9ff, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); s.position.set(sx * 4.2, -0.3, 11.2); ship.add(s); return s; });
  const shipLight = new THREE.PointLight(0xffb36b, 30, 30, 2); shipLight.position.set(9, 0.3, 0.6); ship.add(shipLight); // window spill
  // ================= Hearth Dock (the bay the ship starts in) =================
  const dock = new THREE.Group(); scene.add(dock); const H = W.hangar; const bayM = M(0x6b5a4c, { roughness: 0.85 }), panelM = M(0x8e7a66, { roughness: 0.8 });
  const bw = H.max[0] - H.min[0], bh = H.max[1] - H.min[1], bl = H.max[2] - H.min[2], bz = (H.max[2] + H.min[2]) / 2;
  put(dock, new THREE.BoxGeometry(bw + 4, 1, bl), bayM, [0, H.min[1] - 0.5, bz]); put(dock, new THREE.BoxGeometry(bw + 4, 1, bl), panelM, [0, H.max[1] + 0.5, bz]);
  for (const sx of [-1, 1]) put(dock, new THREE.BoxGeometry(1, bh + 2, bl), panelM, [sx * (bw / 2 + 0.5), 0, bz]);
  put(dock, new THREE.BoxGeometry(bw + 2, bh + 2, 1), bayM, [0, 0, H.max[2] + 0.5]);
  for (let z = H.min[2] + 3; z < H.max[2]; z += 6) { for (const sx of [-1, 1]) put(dock, new THREE.BoxGeometry(0.3, 0.5, 3), E(0xffb26b, 2.5), [sx * (bw / 2 - 0.1), H.max[1] - 1.2, z]); put(dock, new THREE.BoxGeometry(bw, 0.06, 0.4), E(0xffc98a, 1.2), [0, H.min[1] + 0.03, z]); }
  for (const z of [H.max[2] - 8, H.min[2] + 10]) { const l = new THREE.PointLight(0xffb36b, 400, 50, 1.6); l.position.set(0, H.max[1] - 2, z); dock.add(l); }
  // mouth frame + outer hull of the dock module
  const frameM = M(0xc8643c, { roughness: 0.5 }), shellM = M(0xd8c8ae, { roughness: 0.6 }), T = 3;
  put(dock, new THREE.BoxGeometry(bw + 2 * T + 2, T, bl), shellM, [0, H.max[1] + 1 + T / 2, bz]); put(dock, new THREE.BoxGeometry(bw + 2 * T + 2, T, bl), shellM, [0, H.min[1] - 1 - T / 2, bz]);
  for (const sx of [-1, 1]) put(dock, new THREE.BoxGeometry(T, bh + 2, bl), shellM, [sx * (bw / 2 + 1 + T / 2), 0, bz]);
  put(dock, new THREE.BoxGeometry(bw + 2 * T + 2, bh + 2 * T + 2, 4), shellM, [0, 0, H.max[2] + 3]);
  // framed mouth: terracotta frame + amber lamps
  const fw = bw + 2 * T + 2.4, fh = bh + 2 * T + 2.4;
  put(dock, new THREE.BoxGeometry(fw, 1.4, 1.6), frameM, [0, fh / 2 - 0.7, H.min[2]]); put(dock, new THREE.BoxGeometry(fw, 1.4, 1.6), frameM, [0, -fh / 2 + 0.7, H.min[2]]);
  for (const sx of [-1, 1]) put(dock, new THREE.BoxGeometry(1.4, fh, 1.6), frameM, [sx * (fw / 2 - 0.7), 0, H.min[2]]);
  for (let k = 0; k < 7; k++) { const x = -bw / 2 + k * bw / 6; put(dock, new THREE.SphereGeometry(0.45, 8, 6), E(0xffb03d, 4), [x, fh / 2 - 0.7, H.min[2] - 0.9]); put(dock, new THREE.SphereGeometry(0.45, 8, 6), E(0xffb03d, 4), [x, -fh / 2 + 0.7, H.min[2] - 0.9]); }
  // roof greebles: tanks, a little garden dome, mast with solar wings
  for (const [x, z] of [[-9, -10], [-9, 0], [9, 6]]) put(dock, new THREE.CapsuleGeometry(2, 4, 6, 14), M(0xb4553a, { roughness: 0.5 }), [x, H.max[1] + 1 + T + 2, z], [Math.PI / 2, 0, 0]);
  put(dock, new THREE.SphereGeometry(5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9fe0d8, emissive: 0x2a6a5a, emissiveIntensity: 0.6, roughness: 0.1, transparent: true, opacity: 0.6 }), [4, H.max[1] + 1 + T, -12]);
  put(dock, new THREE.SphereGeometry(3, 10, 8), M(0x4f8a4a, { flatShading: true }), [4, H.max[1] + 1 + T + 1, -12]);
  put(dock, new THREE.BoxGeometry(1.2, 22, 1.2), darkM, [-2, H.max[1] + T + 12, 8]); put(dock, new THREE.BoxGeometry(16, 0.8, 0.8), darkM, [-2, H.max[1] + T + 22, 8]);
  for (const sx of [-1, 1]) put(dock, new THREE.BoxGeometry(6, 0.2, 8), M(0x2b3d5a, { metalness: 0.6, roughness: 0.3, emissive: 0x10203a }), [-2 + sx * 11, H.max[1] + T + 22, 8]);
  put(dock, new THREE.SphereGeometry(0.4, 8, 6), E(0xff5050, 4), [-2, H.max[1] + T + 23.4, 8]);
  // ================= nebula: layered cloud sprites + drifting motes + coloured lights =================
  const neb = new THREE.Group(); scene.add(neb); const NC = V(W.nebula.c), NR = W.nebula.r; const nebCols = [0xff7fae, 0xffa96b, 0x63d2ff, 0xb08bff, 0xffc08a];
  const nebSprites = [];
  for (let i = 0; i < 110; i++) { const u = rnd() * 2 - 1, th = rnd() * 6.283, rr = Math.cbrt(rnd()) * NR * 0.95, s = Math.sqrt(1 - u * u);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: clouds[i % 4], color: nebCols[i % 5], transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    sp.position.set(NC.x + rr * s * Math.cos(th), NC.y + rr * u * 0.6, NC.z + rr * s * Math.sin(th)); sp.scale.setScalar(140 + rnd() * 320); sp.material.rotation = rnd() * 6.28; sp.base = 0.09 + rnd() * 0.13; neb.add(sp); nebSprites.push(sp); }
  { const n = 5000, p = new Float32Array(n * 3), c = new Float32Array(n * 3), col = new THREE.Color();
    for (let i = 0; i < n; i++) { const u = rnd() * 2 - 1, th = rnd() * 6.283, rr = Math.cbrt(rnd()) * NR, s = Math.sqrt(1 - u * u); p.set([NC.x + rr * s * Math.cos(th), NC.y + rr * u * 0.6, NC.z + rr * s * Math.sin(th)], i * 3); col.set(nebCols[i % 5]).lerp(new THREE.Color(1, 1, 1), 0.35); c.set([col.r, col.g, col.b], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    neb.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 2.2, map: soft, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }))); }
  const nebLights = [[0xff6fae, [-200, 40, 150]], [0x4fc8ff, [220, -30, -200]]].map(([c, o]) => { const l = new THREE.PointLight(c, 0, 900, 1.2); l.position.copy(NC).add(V(o)); scene.add(l); return l; });
  // ================= asteroid field =================
  function rockGeo(k, detail) { const g = new THREE.IcosahedronGeometry(1, detail), pa = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).normalize(); const f = fbm(v.x * 1.7 + k * 5, v.y * 1.7, v.z * 1.7, 4); v.multiplyScalar(0.72 + f * 0.6); v.y *= 0.82 + k * 0.05; pa.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals(); return g; }
  const rockM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });
  const shapes = [0, 1, 2, 3].map(k => rockGeo(k, 2)), small = W.asteroids.filter(a => !['tumbler', 'twin'].includes(a.id));
  const tints = [0x8a7a6c, 0x9a8470, 0x6f6a72, 0xa0806a, 0x7d7466];
  const inst = shapes.map((g, k) => { const list = small.filter(a => a.shape === k), im = new THREE.InstancedMesh(g, rockM, list.length); im.list = list; const c = new THREE.Color();
    list.forEach((a, n) => im.setColorAt(n, c.set(tints[Math.floor(a.tint * tints.length)]))); scene.add(im); return im; });
  const big = W.asteroids.filter(a => ['tumbler', 'twin'].includes(a.id)).map((a, k) => { const m = new THREE.Mesh(rockGeo(7 + k, 4), new THREE.MeshStandardMaterial({ color: k ? 0x8a7a6c : 0x9c8672, roughness: 0.95, flatShading: true }));
    m.scale.setScalar(a.r); m.position.copy(V(a.c)); scene.add(m); m.a = a;
    if (!k) for (let i = 0; i < 9; i++) { const d = new THREE.Vector3(rnd() - 0.5, rnd() - 0.2, rnd() - 0.5).normalize(); const cr = put(m, new THREE.OctahedronGeometry(0.09 + rnd() * 0.07, 0), E(0x6ff0e0, 2.2), d.clone().multiplyScalar(0.86).toArray()); cr.scale.set(0.6, 1.8, 0.6); cr.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); } // glowing crystals
    return m; });
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  // ================= planet Ember: displaced, vertex-coloured sphere + atmosphere shell =================
  const PC = V(W.planet.c), PR = W.planet.r, padUp = new THREE.Vector3(0, 1, 0), PADC = V(W.pad.c);
  const terrain = (n) => { const h = (fbm(n.x * 3.1 + 11, n.y * 3.1, n.z * 3.1, 5) - 0.45) * 46 + (fbm(n.x * 14, n.y * 14, n.z * 14, 3) - 0.5) * 6; const flat = Math.min(1, Math.max(0, (n.angleTo(padUp) * PR - 70) / 160)); return h * flat; };
  { const g = new THREE.SphereGeometry(PR, 384, 240), pa = g.attributes.position, n = new THREE.Vector3(), col = new Float32Array(pa.count * 3), c = new THREE.Color();
    const sea = new THREE.Color(0x2e8c96), meadow = new THREE.Color(0x86b866), moss = new THREE.Color(0x5f9a5a), sand = new THREE.Color(0xe0b07a), rust = new THREE.Color(0xc77a4e), cream = new THREE.Color(0xf3e6cc);
    for (let i = 0; i < pa.count; i++) { n.fromBufferAttribute(pa, i).normalize(); const h = terrain(n), dPad = n.angleTo(padUp) * PR; n.multiplyScalar(PR + Math.max(h, -2)); pa.setXYZ(i, n.x, n.y, n.z);
      const m2 = fbm(n.x * 0.02, n.y * 0.02 + 5, n.z * 0.02, 3);
      const band = (x, a, b) => Math.max(0, Math.min(1, (x - a) / (b - a)));
      c.copy(sea).lerp(new THREE.Color(0x3fb0a8), band(h, -30, -4)); c.lerp(meadow.clone().lerp(moss, m2), band(h, -4, 0));
      c.lerp(sand.clone().lerp(meadow, 0.3), band(h, 10, 15)); c.lerp(rust, band(h, 18, 22)); c.lerp(cream, band(h, 24, 28));
      if (dPad < 140) c.lerp(meadow, 0.6);
      col.set([c.r, c.g, c.b], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    put(scene, g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }), PC.toArray()); }
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(PR * 1.05, 96, 64), new THREE.ShaderMaterial({ transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
    uniforms: { c1: { value: new THREE.Color(0x8fd8ff) }, c2: { value: new THREE.Color(0xffb38a) }, vis: { value: 1 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform vec3 c1; uniform vec3 c2; uniform float vis; varying vec3 vN; varying vec3 vV; void main(){ float f = clamp(1.0 + dot(vN, vV), 0.0, 1.0); float g = pow(f, 3.0) * vis; gl_FragColor = vec4(mix(c1, c2, 0.3) * g * 0.6, g); }' }));
  atmo.position.copy(PC); scene.add(atmo);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(18000, 48, 24), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, transparent: true, fog: false,
    uniforms: { lim: { value: 0 }, up: { value: new THREE.Vector3(0, 1, 0) }, zen: { value: new THREE.Color(0x7fb0e0) }, hor: { value: new THREE.Color(0xf2d0b8) }, a: { value: 0 } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float lim; uniform vec3 up; uniform vec3 zen; uniform vec3 hor; uniform float a; varying vec3 vD; void main(){ float h = dot(normalize(vD), up); vec3 c = mix(hor, zen, smoothstep(lim - 0.02, lim + 0.3, h)); gl_FragColor = vec4(c, a); }' }));
  dome.renderOrder = -2; sky.add(dome);
  // a far second planet as a tease (sky decoration)
  { const p2 = put(sky, new THREE.SphereGeometry(900, 48, 32), M(0x8a76c8, { roughness: 1 }), [-6500, 2600, -14000]); p2.material.fog = false; }
  // surface dressing near the pad: pad, lamps, hut, trees (all placed on the same terrain function)
  const onSurf = (dx, dz, up = 0) => { const n = new THREE.Vector3(PADC.x + dx - PC.x, 0, PADC.z + dz - PC.z); n.y = Math.sqrt(Math.max(0, PR * PR - n.x * n.x - n.z * n.z)); n.normalize(); return [PC.clone().add(n.clone().multiplyScalar(PR + terrain(n) + up)), n]; };
  const padG = new THREE.Group(); padG.position.copy(PADC); scene.add(padG);
  put(padG, new THREE.CylinderGeometry(W.pad.r, W.pad.r + 1.5, W.pad.h + 2, 6), M(0x4a4f5a, { roughness: 0.6, metalness: 0.3 }), [0, W.pad.h / 2 - 1, 0]);
  put(padG, new THREE.RingGeometry(W.pad.r * 0.55, W.pad.r * 0.62, 48), D(E(0xffd59a, 1.6)), [0, W.pad.h + 0.03, 0], [-Math.PI / 2, 0, 0]);
  put(padG, new THREE.RingGeometry(W.pad.r * 0.92, W.pad.r * 0.98, 6), D(E(0xff8a3d, 2.2)), [0, W.pad.h + 0.03, 0], [-Math.PI / 2, 0, 0]);
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + Math.PI / 6, x = Math.cos(a) * (W.pad.r + 3), z = Math.sin(a) * (W.pad.r + 3);
    put(padG, new THREE.CylinderGeometry(0.15, 0.2, 4, 6), M(0x3a3f4a), [x, 1, z]); put(padG, new THREE.SphereGeometry(0.45, 10, 8), E(0xffb26b, 4), [x, 3.2, z]); }
  const padLight = new THREE.PointLight(0xffb36b, 120, 70, 1.6); padLight.position.set(0, 10, 0); padG.add(padLight);
  { const [hp] = onSurf(30, 14); const hut = new THREE.Group(); hut.position.copy(hp); scene.add(hut); put(hut, new THREE.BoxGeometry(7, 4.5, 6), M(0xd9c3a0), [0, 2, 0]); put(hut, new THREE.ConeGeometry(5.6, 3, 4), M(0xb4553a), [0, 5.6, 0], [0, Math.PI / 4, 0]);
    put(hut, new THREE.PlaneGeometry(1.6, 1.2), D(E(0xffb060, 2.5)), [-3.53, 2.3, 0], [0, -Math.PI / 2, 0]); put(hut, new THREE.PlaneGeometry(1.2, 2.2), D(E(0xffb060, 1.6)), [0, 1.3, -3.03], [0, Math.PI, 0]); }
  { const n = 420, trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 1, 6), M(0x6b4a33), n), crown = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true }), n);
    const cs = [0x3f7d5a, 0x4f8f55, 0x2f6e62, 0xd98a3c, 0xc9643a, 0xe0b04a]; const c = new THREE.Color(); let k = 0;
    for (let tries = 0; k < n && tries < 4000; tries++) { const a = rnd() * 6.283, d = 26 + Math.sqrt(rnd()) * 520, dx = Math.cos(a) * d, dz = Math.sin(a) * d;
      if (Math.hypot(dx - 30, dz - 14) < 9) continue; const [p, nn] = onSurf(dx, dz); if (terrain(nn) < -1) continue; const h = 5 + rnd() * 8, q = new THREE.Quaternion().setFromUnitVectors(padUp, nn);
      _m.compose(p.clone().add(nn.clone().multiplyScalar(h * 0.15)), q, _s.set(1, h * 0.3, 1)); trunk.setMatrixAt(k, _m);
      _m.compose(p.clone().add(nn.clone().multiplyScalar(h * 0.62)), q, _s.set(h * 0.28, h * 0.8, h * 0.28)); crown.setMatrixAt(k, _m); crown.setColorAt(k, c.set(cs[Math.floor(rnd() * (d < 200 ? 6 : 3))])); k++; }
    trunk.count = crown.count = k; scene.add(trunk, crown); }
  // ================= sky dock (station above the pad) =================
  const st = new THREE.Group(); st.position.copy(V(W.station.c)); scene.add(st); const S = W.station;
  put(st, new THREE.CylinderGeometry(9, 9, 14, 16), hullM, [0, 0, 0]); put(st, new THREE.CylinderGeometry(9.2, 9.2, 2, 16), stripeM, [0, 2, 0]);
  put(st, new THREE.SphereGeometry(8.6, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9fe0d8, emissive: 0x2a6a5a, emissiveIntensity: 0.5, roughness: 0.1, transparent: true, opacity: 0.55 }), [0, 7, 0]);
  for (let k = 0; k < 5; k++) put(st, new THREE.SphereGeometry(1.8 + (k % 2), 8, 6), M([0x4f8a4a, 0x5f9a5a, 0xd98a3c][k % 3], { flatShading: true }), [Math.cos(k * 1.3) * 4, 8.5, Math.sin(k * 1.3) * 4]); put(st, new THREE.ConeGeometry(9, 6, 16), stripeM, [0, -10, 0], [Math.PI, 0, 0]);
  put(st, new THREE.TorusGeometry(30, 2.6, 12, 48), hullM, [0, 15, 0], [Math.PI / 2, 0, 0]);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; put(st, new THREE.BoxGeometry(1.6, 1.6, 22), hullM, [Math.cos(a) * 19, 15, Math.sin(a) * 19], [0, -a + Math.PI / 2, 0]); }
  for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; put(st, new THREE.SphereGeometry(0.5, 6, 4), E(k % 2 ? 0xffb26b : 0x6fe9ff, 3.5), [Math.cos(a) * 30, 17.4, Math.sin(a) * 30]); }
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; put(st, new THREE.PlaneGeometry(1.6, 1.0), D(E(0xffb060, 2.2)), [Math.cos(a) * 9.05, 0.5, Math.sin(a) * 9.05], [0, -a + Math.PI / 2, 0]); }
  put(st, new THREE.BoxGeometry(5, 5, S.armLen - 6), hullM, [0, 0, 6 + (S.armLen - 6) / 2]); for (let z = 10; z < S.armLen - 1; z += 4) put(st, new THREE.BoxGeometry(5.3, 0.6, 0.6), stripeM, [0, 2.4, z]);                    // docking arm toward +z
  put(st, new THREE.TorusGeometry(3.4, 0.6, 10, 24), E(0x5fe8ff, 3), [0, 0, S.armLen]); put(st, new THREE.CylinderGeometry(3.6, 3.6, 2, 20, 1, true), darkM, [0, 0, S.armLen - 1], [Math.PI / 2, 0, 0]);
  const portLight = new THREE.PointLight(0x5fe8ff, 60, 40, 1.8); portLight.position.set(0, 0, S.armLen + 4); st.add(portLight);
  const stLight = new THREE.PointLight(0xffb36b, 120, 90, 1.6); stLight.position.set(0, -14, 0); st.add(stLight);
  // ================= per-frame update + cameras =================
  const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), basis = new THREE.Matrix4(), rollQ = new THREE.Quaternion();
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // v6 touchdown settle (render only, sim untouched): on the land tick the sim drops the hull up to 6 cm onto the pad and stops
  // it dead. Show it where it would have been and ease the rest out over ~0.3 s. Stateful like the follow camera; a seek or
  // still (tick jump) skips the ease. Also remembers the touchdown time for the landed push-in below.
  let td = null;
  function touchdown(o, P) { const sh = o.ship, prev = td, dT = prev ? o.tick - prev.tick : 0;
    td = { tick: o.tick, mode: sh.mode, y: P.y, vy: sh.vel[1], off: 0, t0: prev && prev.t0 };
    if (!prev || dT <= 0 || dT > 6) { td.t0 = null; return P; }
    if (sh.mode === 'landed' && prev.mode === 'flight') { td.off = prev.y + prev.vy * dT / 60 - P.y; td.t0 = o.t_s; }
    else if (sh.mode === 'landed') td.off = prev.off * 0.7;
    if (Math.abs(td.off) < 1e-4) { td.off = 0; return P; } return P.clone().add(V([0, td.off, 0])); }
  // v6.2 dock ease (render only, sim untouched; Captain: the drawn ship must be fully at rest on the port AT the dock tick).
  // The sim docks on the first tick the hull is < 0.8 m from dockTarget (game.mjs: then sh.pos = dockTarget, vel 0), so the
  // last <= 0.8 m used to be skipped in one frame (v6.1 glided it in afterwards, resting ~141.25 s). Instead, over the final
  // DOCK_R m of the approach, draw the hull on the line to the port at the eased distance D = DOCK_R * h(u), u = (d - 0.8) /
  // (DOCK_R - 0.8): h(1) = 1, h'(1) = (DOCK_R - 0.8) / DOCK_R and h''(1) = 0 (joins the sim approach at the same distance and speed),
  // h(0) = h'(0) = 0 (reaches the port exactly as the sim does, at zero speed). Stateless (a seek/still is exact); returns the fade
  // weight for the engine glow (1 = flight, 0 = docked). Only reached in M2 (the station approach); Ep1 never flies.
  const DOCK_R = 10, DOCK_M = (DOCK_R - 0.8) / DOCK_R, DK_A = 6 - 3 * DOCK_M, DK_B = 5 * DOCK_M - 8, DK_C = 3 - 2 * DOCK_M;
  let dockW = 1;
  function dockEase(o, P) { const sh = o.ship; dockW = 1; if (o.m1) return P;
    if (sh.mode === 'docked') { dockW = 0; return P; }
    if (sh.mode !== 'flight') return P;
    const T = V(W.dockTarget), d = P.distanceTo(T); if (d >= DOCK_R || d <= 0.8) return P;
    const u = (d - 0.8) / (DOCK_R - 0.8), D = DOCK_R * u * u * (DK_A + u * (DK_B + u * DK_C));
    dockW = u * u * (3 - 2 * u); return T.clone().lerp(P, D / d); }
  function update(o, view = 'chase') {
    const sh = o.ship, t = o.t_s, P = dockEase(o, touchdown(o, V(sh.pos))), F = V(sh.fwd).normalize();
    _z.copy(F).negate(); _x.crossVectors(up, _z).normalize(); _y.crossVectors(_z, _x); basis.makeBasis(_x, _y, _z);
    ship.position.copy(P); ship.quaternion.setFromRotationMatrix(basis); ship.quaternion.multiply(rollQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), sh.bank * 0.5));
    const thr = sh.mode === 'flight' ? Math.max(0, sh.thr) * dockW : 0, L = 1.5 + thr * 9 + (sh.boost ? 14 : 0); // v6.2: dockW fades the engine over the dock ease (1 outside it)
    nozzles.forEach(n => n.material.emissiveIntensity = sh.mode === 'flight' ? 0.35 + (0.65 + thr * 0.8) * dockW : 0.35);
    plumes.forEach(p => { p.scale.set(1, L, 1); p.position.z = 10.3 + L / 2; p.material.color.set(sh.boost ? 0xffc27a : 0x7fe9ff); p.visible = thr > 0.02; });
    plumeGlow.forEach(s => { s.scale.setScalar(1.6 + thr * 3 + (sh.boost ? 3 : 0)); s.material.color.set(sh.boost ? 0xffc27a : 0x7fe9ff); s.material.opacity = sh.mode === 'flight' ? (0.35 + thr * 0.3) * dockW : 0; });
    beacon.material.emissiveIntensity = (Math.sin(t * 4) > 0.3) ? 5 : 0.6;
    // asteroids tumble slowly (time-based, deterministic)
    inst.forEach(im => { im.list.forEach((a, n) => { _q.setFromEuler(_e.set(a.spin[0] * t * 0.4, a.spin[1] * t * 0.4, a.spin[2] * t * 0.4)); _m.compose(_p.set(...a.c), _q, _s.setScalar(a.r)); im.setMatrixAt(n, _m); }); im.instanceMatrix.needsUpdate = true; });
    big.forEach(m => m.rotation.set(m.a.spin[0] * t, m.a.spin[1] * t, m.a.spin[2] * t));
    // camera
    camFor(view, o, P, F);
    sky.position.copy(cam.position);
    // nebula: inside-ness drives fog, tint and lights; sprites fade near the camera so they read as depth, not a wall
    const dn = cam.position.distanceTo(NC), inside = 1 - smooth(NR * 0.75, NR * 1.08, dn);
    for (const s of nebSprites) { const d = s.position.distanceTo(cam.position); s.material.opacity = s.base * smooth(s.scale.x * 0.15, s.scale.x * 0.8, d) * (0.55 + 0.45 * inside); }
    nebLights.forEach(l => l.intensity = 600 * inside);
    // atmosphere near the planet: sky turns soft blue-peach, stars fade
    const alt = cam.position.distanceTo(PC) - PR, atm = 1 - smooth(120, 700, alt);
    scene.background.copy(SPACE_BG).lerp(scene.fog.color.clone().set(0x3a2450), inside * 0.85);
    dome.material.uniforms.a.value = smooth(0, 0.55, atm); scene.background.lerp(SKY_BG, atm); dome.material.uniforms.up.value.copy(cam.position).sub(PC).normalize(); dome.material.uniforms.lim.value = -Math.sqrt(Math.max(0, 1 - (PR / Math.max(PR + 1, PR + alt)) ** 2)); // horizon dip below level
    atmo.material.uniforms.vis.value = Math.exp(-(((0.0009 * inside) * cam.position.distanceTo(PC)) ** 2)) * (1 - atm);
    scene.fog.color.set(0x3a2450).lerp(new THREE.Color(0xc9c6d8), atm); scene.fog.density = 0.0009 * inside + 0.0011 * atm;
    sky.starMat.opacity = 1 - atm * 0.95;
    cam.updateMatrixWorld();
  }
  function lookFrom(pos, target) { cam.position.copy(pos); cam.lookAt(target); }
  const port = PH > PW; // 9:16: pull side offsets and look-ahead in toward the ship so it stays inside the narrow frame
  function camFor(view, o, P, F) {
    const R = _x.clone(), U = _y.clone(), W2 = W, k = port ? 0.3 : 1, at = (p) => p.clone();
    if (view === 'launch') { lookFrom(V([30 * (port ? 0.45 : 1), 9, W2.hangar.mouthZ - 50 - (port ? 18 : 0)]), P.clone().lerp(V([0, 0, W2.hangar.mouthZ]), port ? 0.1 : 0.4).add(V([0, 1, 0]))); return; }
    // v6.1: nebula, near-miss + approach offsets follow the flight path (velocity, same 5-15 m/s blend as the chase cam) instead of the nose:
    // a pilot turn swings the nose at the 1.1 rad/s cap (2.1 deg/frame, 29.20 s / 77.90 s / 98.97 s) while the velocity turns <= 0.17 deg/frame.
    if (view === 'nebula' || view === 'nearmiss' || view === 'approach') { const vel = V(o.ship.vel), w = smooth(5, 15, vel.length()), A = F.clone();
      if (w > 0 && vel.clone().normalize().dot(F) > 0) A.lerp(vel.normalize(), w).normalize();
      const az = A.clone().negate(), Ra = new THREE.Vector3().crossVectors(up, az).normalize(), Ua = new THREE.Vector3().crossVectors(az, Ra);
      if (view === 'nebula') { lookFrom(P.clone().add(A.clone().multiplyScalar(port ? -32 : -26)).add(Ra.clone().multiplyScalar(-16 * k)).add(Ua.clone().multiplyScalar(7)), P.clone().add(A.clone().multiplyScalar(30 * k))); return; }
      if (view === 'approach') { lookFrom(P.clone().add(A.clone().multiplyScalar(-34)).add(Ua.clone().multiplyScalar(13)).add(Ra.clone().multiplyScalar(6 * k)), P.clone().add(A.clone().multiplyScalar(60)).add(Ua.clone().multiplyScalar(-25))); return; }
      const rk = V(W2.asteroids[0].c); const mid = P.clone().lerp(rk, port ? 0.18 : 0.35);
      lookFrom(P.clone().add(A.clone().multiplyScalar(port ? -36 : -30)).add(Ra.clone().multiplyScalar(-14 * k)).add(Ua.clone().multiplyScalar(9)), mid.add(A.clone().multiplyScalar(14 * k))); return; }
    if (view === 'landed') { const [cp] = onSurf(port ? -40 : -30, port ? 4 : 3, port ? 5.5 : 4.6), tg = P.clone().add(V([port ? 0 : 5, port ? 1 : -0.3, port ? 1 : -1]));
      if (td && td.t0 != null) cp.lerp(tg, 0.12 * smooth(0, 5.5, o.t_s - td.t0)); // v6: slow push-in from touchdown, so the 3.5 s pad hold isn't a frozen frame
      lookFrom(cp, tg); return; }
    if (view === 'docked') { lookFrom(V(W2.station.c).add(V(port ? [30, 4, 86] : [34, 9, 62])), V(W2.station.c).add(V(port ? [-2, 6, 36] : [-2, 3, 32]))); return; }
    // chase. v6: aim along the flight path (velocity) above 15 m/s, the nose below 5 m/s: a waypoint hand-off snaps the nose up to
    // 2 deg in one frame (67.03 s) while the velocity turns <= 0.04 deg per frame. Steep climb after liftoff (nose straight up):
    // keep the offset within ~20 deg of level, or the camera sits 36 m below the ship, under the ground (127.53-128.4 s).
    const vel = V(o.ship.vel), w = smooth(5, 15, vel.length()); let C = F.clone();
    if (w > 0 && vel.clone().normalize().dot(F) > 0) C.lerp(vel.normalize(), w).normalize();
    const ay = Math.abs(C.y); if (ay > 0.25) { // soft knee: unchanged up to 0.25, smoothly saturating at 0.35 (~20 deg)
      const y = Math.sign(C.y) * (0.25 + 0.1 * Math.tanh((ay - 0.25) / 0.1)), hl = Math.hypot(C.x, C.z), kh = Math.max(0, 0.3 - hl);
      // heading: the nose's own when it has one; nearly vertical, lean on the pad-to-station heading (the nose's tiny sideways part is noise)
      const h = V([C.x, 0, C.z]).add(V([W.dockTarget[0] - W.pad.c[0], 0, W.dockTarget[2] - W.pad.c[2]]).normalize().multiplyScalar(kh)).normalize();
      C = h.multiplyScalar(Math.sqrt(1 - y * y)).add(V([0, y, 0])); }
    const cz = C.clone().negate(), cr = new THREE.Vector3().crossVectors(up, cz).normalize(), cu = new THREE.Vector3().crossVectors(cz, cr);
    lookFrom(P.clone().add(C.clone().multiplyScalar(-36)).add(cu.multiplyScalar(10)), P.clone().add(C.multiplyScalar(24)));
  }
  return { scene, camera: cam, update, ship };
}
