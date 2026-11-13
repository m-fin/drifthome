// Bolt's visible mesh (same primitives as render.mjs) posed per sim state, in node, so tests can check the *mesh*
// (not just the sim hull) against the prop colliders. variant 'v3' = the old Ep1 build pose, 'new' = current render.mjs.
import * as THREE from '../vendor/three.module.js';
import { LAYOUT, BOLT } from '../game.mjs';
export function makeBolt(variant = 'new') {
  const bolt = new THREE.Group(), parts = [];
  const part = (g, p, parent = bolt) => { const x = new THREE.Mesh(g); x.position.set(...p); parent.add(x); parts.push(x); return x; };
  part(new THREE.CapsuleGeometry(0.26, 0.3, 6, 16), [0, 0, 0]);
  const head = new THREE.Group(); head.position.set(0, 0.45, 0); bolt.add(head);
  part(new THREE.BoxGeometry(0.42, 0.3, 0.36), [0, 0, 0], head); part(new THREE.BoxGeometry(0.06, 0.24, 0.3), [0.2, 0, 0], head);
  part(new THREE.SphereGeometry(0.045, 10, 8), [0.23, 0.03, 0.08], head); part(new THREE.SphereGeometry(0.045, 10, 8), [0.23, 0.03, -0.08], head);
  part(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), [0, 0.26, 0], head); part(new THREE.SphereGeometry(0.04, 8, 6), [0, 0.38, 0], head);
  const arms = [-1, 1].map(sd => part(new THREE.CapsuleGeometry(0.06, 0.3, 4, 8), [0, 0.02, sd * 0.29]));
  const legs = [-1, 1].map(sd => part(new THREE.CapsuleGeometry(0.07, 0.18, 4, 8), [0, -0.36, sd * 0.13]));
  const jet = part(new THREE.ConeGeometry(0.08, 0.2, 10), [variant === 'new' ? -0.24 : -0.28, -0.05, 0]); jet.rotation.z = Math.PI / 2;
  const BS = variant === 'new' ? Math.min((BOLT.down + BOLT.up) / 1.39, 0.956) : 1, BY = variant === 'new' ? -BOLT.down + 0.52 * BS : null;
  bolt.scale.setScalar(BS);
  function pose(o) {
    const t = o.t_s, sleep = o.mode === 'sleep', fl = o.mode === 'float';
    bolt.position.set(o.pos[0], o.pos[1] + (variant === 'new' ? BY : (fl ? 0 : 0.05)), o.pos[2]); bolt.rotation.set(0, o.yaw, 0);
    bolt.rotation.z = sleep ? (variant === 'new' ? 1.2 : -1.45) : fl ? Math.sin(t * 0.9) * 0.12 : 0;
    if (sleep) { if (variant === 'new') bolt.position.set(LAYOUT.bed[0], 1.0, 3.85); else bolt.position.y = 0.85; }
    arms.forEach((a, k) => { a.rotation.x = 0; a.rotation.z = fl ? -0.9 : Math.sin(t * 6 + k * Math.PI) * 0.4 * Math.hypot(o.vel[0], o.vel[2]); });
    legs.forEach((l, k) => { l.rotation.z = fl ? 0.4 : Math.sin(t * 6 + k * Math.PI) * 0.5 * Math.hypot(o.vel[0], o.vel[2]); });
    jet.visible = fl; jet.scale.setScalar(fl ? 0.6 + Math.min(variant === 'new' ? 0.7 : 1, Math.hypot(...o.vel)) : 1);
    bolt.updateMatrixWorld(true);
  }
  const v = new THREE.Vector3();
  // deepest penetration of any mesh vertex into any prop box or the floor: [{name, depth}]
  function overlaps(o, eps = 0.005, posed = false) {
    if (!posed) pose(o); const best = {};
    for (const m of parts) { if (!m.visible) continue; const pa = m.geometry.attributes.position;
      for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(m.matrixWorld);
        if (v.y < -eps) best.floor = Math.max(best.floor || 0, -v.y);
        for (const [name, mn, mx] of LAYOUT.props) { if (v.x <= mn[0] || v.x >= mx[0] || v.y <= mn[1] || v.y >= mx[1] || v.z <= mn[2] || v.z >= mx[2]) continue;
          const d = Math.min(v.x - mn[0], mx[0] - v.x, v.y - mn[1], mx[1] - v.y, v.z - mn[2], mx[2] - v.z); if (d > eps) best[name] = Math.max(best[name] || 0, d); } } }
    return Object.entries(best).map(([name, depth]) => ({ name, depth: +depth.toFixed(3) }));
  }
  return { bolt, pose, overlaps };
}
