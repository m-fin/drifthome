// node run.mjs [seed] [--m1] -> runs/events_seed<N>.json  (headless, no rendering; the whole M2 run simulates in ~1 s).
// M2 (default): cabin -> seat -> launch -> nebula -> asteroid field -> planet 1 pad -> sky dock -> back to the cabin window.
// Ends HOLD_S after window_look, then logs run_end. M1 (--m1) is the old cabin-only run (11.0 s hold, unchanged Ep1 timing),
// written to runs/m1/events_seed<N>.json so it never overwrites the M2 logs.
import fs from 'fs'; import { reset, step, observe, state, DT } from './game.mjs'; import { makePilot } from './pilot.mjs';
export const HOLD_S = 11.0, HOLD_S_M2 = 4.0;
export function runPilot(seed, maxS = 240, opt = {}) {
  reset(seed, opt); const act = makePilot(state()); let o = observe(), endTick = null; const hold = opt.m1 ? HOLD_S : HOLD_S_M2;
  while (o.t_s < maxS) { o = step(act(o)).obs; if (o.flags.window && endTick === null) endTick = o.log.find(e => e.type === "window_look").tick + Math.round(hold / DT); if (endTick !== null && o.tick >= endTick) break; }
  if (endTick === null) throw new Error(`seed ${seed}: run did not reach window_look within ${maxS} s`);
  const log = [...o.log, { t_s: +(o.tick * DT).toFixed(4), tick: o.tick, type: 'run_end', detail: { hold_after_window_look_s: hold } }];
  return { seed, milestone: opt.m1 ? 'M1' : 'M2', ticks: o.tick, duration_s: +(o.tick * DT).toFixed(4), events: log };
}
if ((process.argv[1] || '').endsWith('run.mjs')) {
  const m1 = process.argv.includes('--m1'), seed = +(process.argv.slice(2).find(a => !a.startsWith('--')) || 1); const r = runPilot(seed, 240, { m1 });
  const dir = m1 ? 'runs/m1' : 'runs'; fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(`${dir}/events_seed${seed}.json`, JSON.stringify(r, null, 1));
  console.log(seed, r.milestone, r.duration_s, r.events.map(e => `${e.type}@${e.t_s}`).join(' '));
}
