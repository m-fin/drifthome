// Shared camera director for M2 capture and stills: picks the view from the event log + sim state, so a capture is a
// pure function of (seed, tick). Interior views come from render.mjs (wide/follow/cockpit/window); exterior from space.mjs.
export const EXTERIOR = new Set(['chase', 'launch', 'nebula', 'nearmiss', 'approach', 'landed', 'docked']);
export function m2View(o, ev) {
  const at = (type) => (ev.find(e => e.type === type) || {}).t_s ?? 1e9, t = o.t_s;
  if (o.m1) { // old Ep1 director
    if (t < at('wake') + 1.5) return 'wide'; if (t >= at('cockpit_reach') - 1 && t < at('cockpit_reach') + 2.5) return 'cockpit'; if (t >= at('window_look') - 0.5) return 'window'; return 'follow';
  }
  if (t < at('wake') + 1.5) return 'wide';
  if (t < at('cockpit_reach') - 1) return 'follow';
  if (t < at('launch') - 0.2) return 'cockpit';
  if (t < at('launch') + 7) return 'launch';
  if (t < at('nebula_enter') + 1) return 'chase';
  if (t < at('asteroid_field_enter') - 2) return 'nebula';
  if (Math.abs(t - at('asteroid_near_miss')) < 3) return 'nearmiss';
  if (t < at('planet_approach')) return 'chase';
  if (t < at('land') - 9) return 'approach';
  if (t < at('liftoff') + 2) return 'landed';
  if (t < at('dock') - 7) return 'chase';
  if (t < at('dock') + 1.5) return 'docked';
  if (t < at('window_look') - 0.5) return 'follow';
  return 'window';
}
