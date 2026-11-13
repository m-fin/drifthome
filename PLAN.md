# Premiere Game Plan — codename DRIFTHOME (alts: Hearthship, Starhold)

Star: **Bolt** (official). Keep "No Man's Sky" out of titles/thumbnails.

## Pillars
Cozy cabin, wonder outside, fun to watch.

## First playable slice
- Cabin + cockpit: walking and zero-g floating, window, handholds, warm light.
- One seeded star system: nebula skybox, 2 planets (simple landing on planet 1, no on-foot), station, asteroid field.
- Momentum flight, boost, docking. Scripted waypoint AI pilot with seeded variation.
- Events: wake, cabin_enter, float_start, cockpit_reach, launch, nebula_enter, asteroid_near_miss, planet_approach, land, dock, window_look.
- Out of scope: on-foot exploration, more systems, combat, inventory, learning AI.

## Milestones
- M0 Neon Snake finishes (pipeline proof)
- M1 Cabin graybox
- M2 Flight, docking, landing: **built 2026-10-17 (sim, autopilot, event logs, 6 stills). Full capture not run yet** (plan in `runs/M2_CAPTURE_PLAN.md`, needs Frog's OK for the Mac jobs). Manual flying controls in live play are not wired yet.
- M3 AI run + event log + silent capture
- M4 Episode 1 "First Light" rough cut for Frog's review
- M5 Trailer + expansion

## Team
- **Builder:** Three.js, local in crave-lab/games/premiere/, reset/step/observe/render, frame-locked 16:9 + 9:16, free camera for trailer.
- **Sonic Rift:** cabin theme first, event layers, trailer cue; stems in /workspace/sonic-rift/game/premiere/; wake/float_start/cockpit_reach/window_look cues.
- **Content Writer:** STORY.md; timed script as `event | offset_s | line`.
- **Video Creator:** /workspace/videos/premiere/, Kokoro am_michael, music ~16 LU under voice, event-driven edit, 60–90s trailer.

## Rules
Free tools only. Ask Frog before any public repo. Nothing posted or uploaded without his OK. No false claims about Frog.

## M2 status (2026-10-17)
- Done: momentum ship physics (main drive + boost, weaker side/reverse thrusters, nose turn rate, light drag, gentle planet pull),
  seeded world (`world.mjs`: Hearth Dock bay, nebula, 230-rock asteroid field with a scripted near-miss rock, planet Ember with a
  landing pad, sky dock station), flight autopilot (`pilot.mjs` `flightPilot`), state-based events, exterior renderer (`space.mjs`),
  camera director (`director.mjs`), stills `stills/m2/01..06`.
- Event logs `runs/events_seed1.json` (155.0 s) and `events_seed2.json` (152.92 s), re-locked 5:50 PM after the Captain's 3.5 s pad hold on Ember (liftoff = land + 3.52 s; everything up to touchdown unchanged, everything after +2.0 s). Pre-hold logs: `.bak-padhold`; old M1 logs: `.bak-m1`.
- Capture bundle built + dry-run validated: `out/capture_m2/drifthome_m2_game.tar` (seed 1 = 4650 frames). The helper's fixed capture encoder is VideoToolbox 12 Mb/s; 20 Mb/s needs the drafted helper patch (`runs/rh_capture_20M.patch`, not applied). Output is full-range yuvj420p BT.601, so Ep1's full-to-limited conversion still applies.
  Cabin events wake / float_start / cockpit_reach keep the current code's times; window_look now comes after docking (re-based).
- Next: Frog's OK -> Mac capture (16:9 + 9:16); Sonic Rift re-cuts the Ep2 bed to the log; Content Writer fills narration offsets.
- Known gaps: no manual ship controls in `index.html` live play, cabin windows show the old static starfield during flight,
  no shadows outside, the planet is small (900 m radius) on purpose for the cozy look.

## Collision + wall-flicker pass (2026-10-20, Builder; local only, nothing submitted/pushed)
- Frog's playtest: Bolt through furniture, walls flickering, glitchy textures. Ep1 (Oct 17 finals) withdrawn; re-capture on this build.
- Wall flicker root cause: cockpit ceiling + side walls ended exactly on the cabin door-wall face (z=-5.0, same facing) -> z-fighting
  strips around the doorway. Fixed (they now end inside the wall slab). Glitchy textures: point-light shadow acne (no bias) -> bias,
  1024 map on the main lamp, trims/rings out of shadows. Follow camera smoothed (0 jumps > 0.25 m per frame, was 34 in Ep1's run); reworked again 10:40 AM (see below).
- Collision: capsule-vs-box with sliding, 9 more colliders (pillow, mug, console screens, window frame, lamps), plant box fixed,
  wall-aware push-out (no wedging next to props in corners), Bolt mesh fitted to the hull, sleep pose on top of the bunk,
  debug overlay (B key / `&colliders=1`). Self-Driving side-steps when a prop blocks its straight line.
- Collision/flicker changes alone left every event time unchanged (seeds 1-8, M1 + M2). Then BOLT.down 0.45 -> 0.53 (Polish report):
  wake + float_start unchanged; from cockpit_reach on, seeds 1,4,5,7,8 move 1 tick earlier, seed 6 2 ticks, seeds 2,3 unchanged.
  Seed 1 M2: cockpit_reach 15.933->15.917, dock 139.817->139.800, cabin_enter 142.733->142.717, window_look 151.000->150.983,
  run_end 155.000->154.983 (still 4650 frames). Ep1 M1 seed 1: cockpit_reach 15.933->15.917, window_look 27.000->26.983, run_end 38.000->37.983 (1140 frames).
  Pre-change logs: `runs/bak-down-0931/`.
- Follow-camera pass (10:02-10:50 AM, Polish gate NOT YET): the follow camera no longer goes overhead onto Bolt's head in the cockpit
  and doorway (candidate spots kept >= 0.3 m inside the room, cockpit corner + cockpit-camera spots, spots must be 1.6-5.2 m from
  his head and look down <= 50 deg, fallback = fixed room camera, never a pull-in onto him). The held spot is a world-space offset
  from Bolt eased by a critically damped spring (no constant-speed glide); room clamp before the per-frame cap. Door wall is one
  extruded mesh (no hairline seams); cockpit shell casts no shadows. `node tests/cam_check.mjs [--old DIR]` (Ep1 M1 + M2, seeds 1-2,
  16:9 + 9:16): pitch > 60 deg 78 -> 0, camera < 1.2 m 86 -> 0, frames at the 0.15 m cap 59 -> 0, max move 0.203 -> 0.117 m,
  jumps 0, Ep1 seed 1 16:9. Event logs unchanged (render-only). (Intermediate bundles 373a4be2... / 4b0d7cc3... superseded by the Playtest pass below.)
- Bundles rebuilt + validated offline: M2 `out/capture_m2/drifthome_m2_game.tar`, Ep1 `out/capture_m1/drifthome_ep1_m1_game.tar`.
- Tests: `node tests/playtest_collision.mjs` (sim, ~20 s), `node tests/render_check.mjs [--old DIR]` (one headless Chrome).

- Playtest Lead pass folded in (10:35 AM NOT READY, same rebuild): collision resolver now resolves walls + prop jointly (every
  exit, clamped into the ship, plus a 2nd step from the clamped point; smallest real displacement wins) -> no snap-back in the
  plant/window-wall pocket (was 13-17 cm) or the big-crate corner (3 cm); regression + 1,506-run jitter grid scan in
  playtest_collision. Gamepad: RB / D-pad up = up, LB / D-pad down = down in zero-g (same rate as Space/C); left stick radial
  deadzone 0.15 + proportional speed (30% push = 18% speed, was 96%); LT = analog brake (walk: scales move down; float: stops
  without reversing). `node tests/gamepad_check.mjs` (stubbed pad, live-play input path; reaches all 6 handholds + 3 lamps).
  Door lintel trim mesh restored (it had been commented out) and its collider cut to match (y 2.575-2.725; was up to y 4).
  Follow camera keeps its own room while it can still see Bolt through the doorway, no room cut within 0.5 s of a director
  cut. Event logs byte-identical (M1 + M2 seeds 1-8). Bundles: M2 `497cd0574e806f2c53d13117992fc144a759c1a1bcedd9c0e2ec0042c0b6fa5c`,
  Ep1 `d579422f0f057de56d34474d343ca959a104f9475de33c7fe4fc5879836f6f01` (2,232,320 bytes each; 4650 / 1140 frames).
- v3 pass (11:38 AM Polish NOT YET + 12:35 PM Playtest NOT READY scope, 11:40 AM-1:20 PM):
  - Ring blocker: the follow camera no longer flies through the doorway handhold ring (handhold_5) leaving the cockpit. Handhold
    rings count in camera LOS again and the camera keeps >= 0.45 m from every ring (round, eased keep-out in clampCam). cam_check
    (Ep1/M2, seeds 1-2, 16:9 + 9:16): camera-to-handhold min 0 -> 0.45 m; frames with a prop over 5% of the frame within 1 m of the
    lens 67/42/62/51 -> 17/0/17/15 (what's left is the door frame, no ring); frames at the cap 3/1/4/1 -> 1/1/1/1; pitch, distance,
    glide unchanged. Side effect: the doorway room cut comes ~1.4 s earlier (Ep1 23.6 -> 22.23 s 16:9, 23.7 -> 22.1 s 9:16; M2 s1
    147.6 -> 146.23 s, s2 145.37 -> 144.13 s) because the cabin-side ring now blocks the line of sight. It's still one clean cut, 0 within 0.5 s of a director cut.
    A keep-out-only variant kept the cut times but left the ring in the lens (74 frames) and 9-11 cap frames; not used
    (`tests/cam_check_variant_keepout_only.txt`).
  - Dark wedge on the upper door wall: the extruded door slab no longer casts shadows. Three invisible 2 cm shadow-only sheets at the
    cockpit face (|x| <= 2.95) keep the cabin lamps out of the cockpit (flush / 5 cm-deep proxies brought the wedge back). Stills
    `stills/collision/door_wall_wedge_*`, `cockpit_light_*`.
  - Shimmer (optional): left at SHADOW_EVERY = 2. Every-frame shadows cost +8% per frame (1080p, box SwiftShader: 466 ms without a
    refresh vs 550 ms with one -> 508 ms vs 550 ms avg) but cut the through-door flicker only ~13% (A->B->A px/frame at 960x540,
    18.5-20 s: mean 113 -> 98, median 76 -> 76), so it isn't the main cause.
  - Free-play camera (Playtest; capture frames unchanged, see below): a prop crossing the head->camera line mid-glide no longer
    snaps or pulls the camera in. It eases (quicker spring) to the clear spot nearest the camera for up to 0.8 s, then cuts. Look-down capped
    at 55 deg (pushed out along its bearing, else lowered); fixed fallback spots prefer <= 50 deg. `tests/freeplay_cam_check.mjs`:
    cabin_walk_tour re-frames 5 -> 0, min clearance 0.055 -> 0.184 m, max pitch 78.8 -> 55 deg; float_tour re-frames 12 -> 0
    (ceiling rings 11, cockpit 1.67 m), max pitch 78.2 -> 55; doorway ping-pong unchanged (0).
  - Collision: cockpit box max z -5.0 -> -5.2 (door wall's cockpit face); playtest_collision I (hull stops at -5.30 from the cockpit side).
  - Capture camera: per-frame track identical to the v3 ring build (0 frames differ, all 8 runs); vs v2 it differs from ~9 s
    (ring keep-out near handhold_1/3, <= 0.27 m) and around the earlier doorway cut. Event logs byte-identical (M1 + M2 seeds 1-8).
  - Bundles: M2 `1a6ca093a04eab33b66946ef77c39a9e83750bc2b6ed10c79fb12ef7fb4727e1` (2,242,560 bytes, 4650 frames),
    Ep1 `4e02da9aa09584f348abae5f55120aa36dae124c042ebbae5a45e1c17dd6faa9` (2,232,320 bytes, 1140 frames).
- v4 pass (2:20 PM Playtest NOT READY for free play; Polish passed v3):
  - Free play only (`createRenderer(..., {freePlay: true})`, set only by index.html; capture.html never sets it): at the 55 deg look-down cap
    the camera now swings around Bolt (10 deg steps, toward its target bearing, at most 1.6x the normal step per tick) or holds its
    height. It no longer drops onto him, and it keeps >= 0.8 m from his head (pushed out, else raised). The pitch may briefly pass 55 deg when boxed in.
    `tests/freeplay_cam_check.mjs` routes corner_walk (Playtest repro) and float_wall_corner, plus metrics minHeadDist, minInFrame,
    maxScreenShare and capHold_s. v3 -> v4: corner_walk head 0.346 -> 1.253 m, Bolt's share of the frame 100% -> 55%, in frame 44% -> 78%,
    cap hold 0.93 -> 0.47 s; float_tour (114-116 s) head 0.717 -> 1.429 m, share 100% -> 39%, cap hold 1.6 -> 0.1 s; cabin_walk_tour
    head 0.378 -> 1.721 m, share 100% -> 31%. 0 re-frames and near-plane hits 0 on every route.
  - Hitch: the 221-686 ms stall was the first use of a shader program (blocked on getProgramInfoLog at first draw; the last one is
    the v3 shadow-only door-wall sheets, ~5.5 s in). Fix: at load, one warm-up render with culling off (every program linked
    before play). Long tasks after load, 1280x720: v3 396/275 ms at engage + 332/329 ms at ~5.5 s -> v4 none (the load task itself is 650-738 ms, before play).
  - Capture: camera frame-identical to v3 (`tests/capture_cam_identity.mjs`, 32 runs, 0 frames differ); logs byte-identical. Bundles
    rebuilt (render.mjs changed): M2 `c56de12d75382e8716c059a753ab174201cfbb0a4e4c22db85f2ec2f2da56a58` (2,242,560 bytes, 4650 frames),
    Ep1 `6ce7654dbe355d512e367b46b407bba45959c75ae8c62b17e8aea64cc132b875` (2,242,560 bytes, 1140 frames).
  - Not done (optional, capture-only): Ep1 9:16 21.4-22.07 s, a ring over Bolt's head.
- v5 pass (free play only; Polish 15:46 NOT YET + Playtest 14:52 NOT READY; 3:47-5:50 PM). Capture bundles NOT rebuilt: the v4 tars stay
  the Mac capture bundles (Ep1 6ce7654d...b875, M2 c56de12d...6a58). Every change is under `FREE` (index.html only).
  - Head keep-out (Polish blocker, FL float corner; BL crop): inside 1.6 m of his head the camera swings to the nearest clear,
    in-room spot 1.9 m from his head (higher spots may sit closer horizontally, <= 48 deg look-down; spots on the side he is
    moving toward cost more) and stops once past 1.75 m. The 0.8 m HEAD_MIN floor stays as the last resort (now: nearest clear spot, then up).
  - Swings (Playtest judder / 75 deg whip / 55 deg hold; Polish 0.21-0.24 m/frame): eased (`easeTo`): pitch swing along an arc
    around him, bearing <= 2.5 deg/tick ramping up and easing out; head swing along the chord, <= STEP/tick, never cutting past
    him; a swing frame moves <= 0.2 m. The pitch swing starts at 46 deg (before the 55 deg cap), aims for 38 deg and runs
    down to 41 deg (hysteresis). The swung spot becomes the spring target for 1 s (SW_LOCK, LOS-checked), so the spring no
    longer drags the camera back toward the blocked bearing (the v4 4.5 Hz limit cycle).
  - `tests/freeplay_cam_check.mjs`: + routes float_FL / high_FL / float_BL / high_BL / walk_FR (Polish corner_check.py) and
    plant_turn (Playtest spin_near_walls); + metrics judder (camera-move reversals: most per 1 s, amplitude, count > 5 cm),
    maxPan02_deg (view yaw in 0.2 s), headTopOut_s. v4 -> v5 table: `tests/freeplay_v4_vs_v5_table.txt`.
  - Capture: `capture_cam_identity` vs v4, 32/32 runs, 0 frames differ; logs byte-identical; cam_check 0 frames differ; render sweeps identical.
