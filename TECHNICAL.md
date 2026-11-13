# DRIFTHOME: cabin (M1) + first flight (M2)

Local only. Nothing is pushed or posted. Free stack: three.js 0.186.1 (from npm, copied into `vendor/`, no CDN), Node 20, headless Chrome with SwiftShader.

## Files
| file | role |
|---|---|
| `game.mjs` | Pure, deterministic sim with no three.js. `reset(seed, {m1})`: M2 by default, `{m1: true}` = old cabin-only run (reproduces the M1 logs). `reset(seed)`, `step(action)`, `observe()`. Fixed `DT = 1/60` s. Modes: sleep → walk (gravity) → float (zero-g, thrust + light damping). Sphere collision vs cabin, doorway, cockpit; capsule-vs-box collision with sliding against every prop in `LAYOUT.props` (`propOverlaps(pos)` for tests). Fires `wake`, `float_start`, `cockpit_reach`, `window_look` from state checks. |
| `pilot.mjs` | Scripted waypoint pilot with seeded jitter (pause lengths, waypoint offsets). M2: same cabin path to the cockpit, then sit -> `flightPilot` flies `world.route` (speed governor + gravity compensation) -> unbuckle -> float back to the window. |
| `world.mjs` | M2 seeded world + ship constants, shared by sim, pilot and renderer: Hearth Dock bay, nebula sphere, asteroid field (230 seeded rocks kept off the route, plus the scripted `tumbler` rock 5.5 m off the line), planet Ember (r 900 m) with the landing pad, sky dock station + port. |
| `space.mjs` | M2 exterior three.js scene: cream/terracotta ship with warm cabin-window glow, dock bay, layered cloud-sprite nebula + 5000 motes + coloured light, instanced tumbling asteroids, vertex-coloured planet with trees, hut, pad lamps, sky dome near the ground, sky dock. Cameras: `chase`, `launch`, `nebula`, `nearmiss`, `approach`, `landed`, `docked` (with 9:16 framing). |
| `director.mjs` | `m2View(obs, events)`: event-driven camera cuts for capture and stills (M1 logs keep the old cabin cuts). |
| `stills_m2.mjs` | `node stills_m2.mjs [seed] [names]` -> `stills/m2/*.png` at 1280x720 (env `W`, `H`, `OUT`). One Chrome, sim stepped headless, one frame per still. |
| `render.mjs` | Three.js `render(obs, view)`. Cabin (12×4×10 m) with warm point lights, rug, bunk, shelf, crates, plant, table + mug, 8 yellow handholds, a window to a seeded starfield + nebula sprites + distant planet, a doorway to the cockpit (console, seat, front window). Bolt is built from primitives. Views: `follow`, `wide`, `cockpit`, `window`. |
| `index.html` | Live play: `?seed=1&view=follow`. Still: `&t=SEC&w=1280&h=720` steps the sim to t, renders one frame, then sets title `READY`. `&hud=0` hides the HUD. `&colliders=1` (or the B key) draws every collision box and Bolt's hull. |
| `run.mjs` | `node run.mjs <seed>` → `runs/events_seed<seed>.json` (M2, headless, ~1 s, ends 4 s after `window_look`). `--m1` writes the old cabin run to `runs/m1/` (11 s hold). |
| `tests/playtest_collision.mjs` | Headless collision playtest (v3: + I, cockpit side of the door wall): 298 push+back-out tests (each prop, 8 directions, walking and floating), slides, reachability (cockpit, bed, window), pilot seeds 1-8 M1+M2 (hull and mesh), 36 Self-Driving hand-off cases, Self-Driving from the bunk. Exit 0 = pass. |
| `tests/render_check.mjs` | One headless Chrome: z-fighting sweeps (ID-pass A->B->A flips), shadow-shimmer sweeps, follow-camera jumps per frame (Ep1 + M2 runs), optional before/after (`--old DIR`), stills (`--stills DIR`), capture contract on extracted bundles (`--bundle name=dir`). |
| `tests/cam_check.mjs` | One headless Chrome, no drawing: follow camera placed per frame exactly like a capture (Ep1 M1 + M2, seeds 1-2, 16:9 + 9:16). Flags look-down > 60 deg, camera < 1.2 m or > 5.5 m from Bolt, Bolt off-screen, jumps > 0.25 m, frames at the 0.15 m cap; `--old DIR` for before/after, `--trace '[t0,t1,portrait]'` per-frame dump. v3: camera clearance to every prop / handhold box (`minPropDist`, `minHandholdDist`), prop filling the lens (16x9 ray grid, prop hits within 1 m: `nearLens1/5` = frames over 1% / 5%), per-frame camera track diffed against `--old DIR` / `--ref DIR`. |
| `tests/gamepad_check.mjs` | One headless Chrome, live-play input path with a stubbed standard gamepad: RB/LB + D-pad up/down in zero-g vs Space, reach every handhold and lamp pad-only, analog stick speed (deadzone + proportional), LT brake (walk + float), pad hand-off from Self-Driving. |
| `tests/freeplay_cam_check.mjs` | One headless Chrome (320x180), live-play path (`index.html?manual=1`, keyboard + mouse-yaw routes; Playtest Lead's cabin_walk_tour / float_tour / doorway_pingpong + seat / corner / ceiling repros). Per frame: re-frames (> 0.25 m without a room cut), camera clearance to the nearest solid box (near plane 0.10), look-down pitch. Uses `dh.cam` (index.html). v5: + float_FL/high_FL/float_BL/high_BL/walk_FR/plant_turn routes, `spin` + `hold push` segments, judder (reversals/s, amplitude), maxPan02_deg, headTopOut_s; `--only a,b`. v4: + corner_walk / float_wall_corner routes; minHeadDist, minInFrame, maxScreenShare, capHold_s (longest run at >= 54.5 deg); `--old DIR` before/after; `--trace t0,t1` per-frame rows. |
| `tests/capture_cam_identity.mjs` | `--ref DIR [--seeds N]`: capture camera (position + rotation, every frame) stepped exactly like capture.html with drawing stubbed, Ep1 M1 + M2, seeds 1-N (default 8), 16:9 + 9:16, vs a reference tree. Exits 1 if any frame differs. |
| `tests/cockpit_stills.mjs` | Before/after cockpit-visit framing stills rendered through capture.html from t=0 (real camera history). |
| `tests/bolt_mesh.mjs` | Bolt's mesh posed in node so tests can check the visible mesh, not just the hull. |
| `runs/make_m1_bundle.py` | Ep1 (M1) re-capture bundle -> `out/capture_m1/drifthome_ep1_m1_game.tar`, validated offline like the M2 one. |
| `vendor/three.module.js`, `vendor/three.core.js` | Local three.js. |

## Event log
`t_s = tick / 60`. There's no intro offset, so the video editor adds any title-card time.

M2 order: `wake, float_start, cockpit_reach, launch, nebula_enter, nebula_exit, asteroid_field_enter, asteroid_near_miss,
asteroid_field_exit, planet_approach, land, liftoff, dock, cabin_enter, window_look, run_end`. All are detected from sim state:
launch = docking clamps release; nebula/field = entering their spheres; near miss = closest pass under 10 m of hull clearance
(logged as the gap opens, `clearance_m` in detail); planet_approach = within 900 m of the pad; land = skids on the pad under
1.5 m/s; dock = within 0.8 m of the port, under 1.5 m/s, nose aligned. Seed 1 = 154.98 s, seed 2 = 152.92 s (3.5 s pad hold on Ember).

## Run
```
python3 -m http.server 8765 --bind 127.0.0.1     # module imports need http, not file://
google-chrome --headless=new --no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1280,720 \
  --virtual-time-budget=15000 --screenshot=stills/x.png "http://127.0.0.1:8765/index.html?seed=1&t=14.8&view=cockpit&w=1280&h=720"
```
Box is memory-tight: one Chrome at a time.

## Capture
`capture.html` + `capture.mjs` are frame-locked (2 ticks per 30 fps frame). Full captures run on Frog's Mac via HomeRender only;
see `runs/M2_CAPTURE_PLAN.md`. `capture.html` also has `cap.still(tick, view)` for single stills.

## Live play
`index.html` interactive mode is still the M1 cabin sandbox (no manual ship controls yet). `&t=SEC` / `&demo=1` play the M2 run
(`&view=chase|launch|nebula|nearmiss|approach|landed|docked` for exterior views, `&m1=1` for the old run).

## Next (M3)
Mac capture of M2 (16:9 + 9:16), manual flight controls, live view from the cabin windows during flight, handhold grab animation.
