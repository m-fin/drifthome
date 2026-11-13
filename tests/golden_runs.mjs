// Golden-run check (node only): re-simulates seeds 1-8 for M2 and M1 and compares every event
// (type, tick, t_s, detail) with the committed logs in runs/ and runs/m1/.
// Any change to game.mjs / pilot.mjs / world.mjs that moves an event shows up here, so captures
// made from those logs don't silently drift.   node tests/golden_runs.mjs  -> exit 0 = all match
import fs from 'fs';
import { runPilot } from '../run.mjs';

let fail = 0, checked = 0;
for (const m1 of [false, true]) {
  for (let seed = 1; seed <= 8; seed++) {
    const file = `${m1 ? 'runs/m1' : 'runs'}/events_seed${seed}.json`;
    if (!fs.existsSync(file)) { console.log(`SKIP ${file} (missing)`); continue; }
    const want = JSON.parse(fs.readFileSync(file, 'utf8'));
    const got = JSON.parse(JSON.stringify(runPilot(seed, 240, { m1 })));
    checked++;
    const a = JSON.stringify(got), b = JSON.stringify(want);
    if (a === b) { console.log(`PASS ${file} (${got.events.length} events, ${got.duration_s} s)`); continue; }
    fail++;
    const n = Math.max(got.events.length, want.events.length);
    let first = '';
    for (let i = 0; i < n; i++) {
      if (JSON.stringify(got.events[i]) !== JSON.stringify(want.events[i])) {
        const g = got.events[i], w = want.events[i];
        first = `event ${i}: got ${g ? `${g.type}@${g.t_s}` : 'none'}, want ${w ? `${w.type}@${w.t_s}` : 'none'}`;
        break;
      }
    }
    console.log(`FAIL ${file}: ${first || 'top-level fields differ'}`);
  }
}
console.log(`${checked - fail}/${checked} golden runs match`);
process.exit(fail ? 1 : 0);
