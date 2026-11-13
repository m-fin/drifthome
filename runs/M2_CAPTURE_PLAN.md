# DRIFTHOME M2: capture plan (NOT run, nothing submitted)

Updated 2026-10-20 ~2:51 PM ET (v4: free-play-only camera fix at the 55 deg cap + shader warm-up at load; bundle sha changed because render.mjs changed, capture camera frame-identical to v3 for Ep1 M1 + M2 seeds 1-8, event logs byte-identical). Before that ~1:20 PM ET (v3: ring keep-out, door-wall wedge, free-play camera, cockpit wall collider; bundle changed, event times unchanged; the doorway room cut is ~1.4 s earlier). Before that ~10:55 AM ET (follow-camera pass after Polish's NOT YET + Playtest Lead's NOT READY fixes: bundle changed, event times unchanged). Earlier 2026-10-20: collision + wall-flicker pass, then BOLT.down 0.53 (seed 1 -1 tick from cockpit_reach on). Previously updated 2026-10-17 5:50 PM ET. The bundle is built and dry-run validated; nothing has been captured on the Mac, nothing is
queued, and no submit has been run. Every job below waits for Frog's OK. Mac work goes through HomeRender
(`m-fin/render-helper`, the repo's fixed `rh_capture.mjs`): no Python job type, no outside code.

## Run being captured (event log re-locked after the 3.5 s pad hold)
| | seed 1 (main) | seed 2 (alt, optional) |
|---|---|---|
| event log | `runs/events_seed1.json` | `runs/events_seed2.json` |
| run_end tick | 9299 | 9175 |
| duration | **154.983 s** (0-154.983 s) | 152.917 s |
| frames at 30 fps (`round(run_end.tick / 2)`) | **4650** | 4588 |
Earlier plan (before the pad hold): seed 1 = 153.000 s / 4590 frames. That plan is kept as `M2_CAPTURE_PLAN.md.bak-padhold`.

- Frame-locked: 60 Hz sim, 2 ticks per frame, 30 fps; frame k = sim after 2k ticks, so video time == log time (no intro offset).
- Camera cuts: `director.mjs` (`m2View`), pure function of log + sim state: wide -> follow -> cockpit -> launch (to +7 s) -> chase ->
  nebula -> nearmiss (+-3 s) -> chase -> approach (to land - 9 s) -> landed (to liftoff + 2 s, now ~5.5 s on the pad) -> chase ->
  docked (dock - 7 s to dock + 1.5 s) -> follow -> window.
- Sizes: 1920x1080 (episode) and 1080x1920 (Shorts), seed 1. Silent; music and narration are mixed later by Video Creator.

## Bundle (built and validated)
- `out/capture_m2/drifthome_m2_game.tar`: 2,242,560 bytes, 11 files,
  sha256 `c56de12d75382e8716c059a753ab174201cfbb0a4e4c22db85f2ec2f2da56a58` (rebuilt 2026-10-20 ~2:50 PM ET for v4; v3
  `1a6ca093a04eab33b66946ef77c39a9e83750bc2b6ed10c79fb12ef7fb4727e1` kept as `backups/drifthome_m2_game-pre-v4.tar`; v2
  `497cd0574e806f2c53d13117992fc144a759c1a1bcedd9c0e2ec0042c0b6fa5c` kept as `backups/drifthome_m2_game-pre-v3.tar`, built ~10:55 AM ET after the follow-camera
  pass for Polish's NOT YET gate (no overhead/too-close camera in the cockpit and doorway, eased moves, door wall as one mesh) and
  Playtest Lead's NOT READY (pocket jitter resolver, lintel trim restored, gamepad); event times unchanged. Previous: `04f47597...` kept as `backups/drifthome_m2_game-pre-cam1002.tar`;
  the Oct 17 tar, sha `99519802...`, is kept as `/workspace/crave-lab/backups/drifthome_m2_game.pre-collision-0817.tar`).
  BOLT.down 0.45 -> 0.53 (hull bottom matches his feet; Polish report) moves every event from cockpit_reach on 1 tick (-0.0167 s)
  earlier for seed 1: run_end 155.000 -> 154.983 s, still 4650 frames; wake/float_start unchanged. Seed 2 is unchanged. Also: no z-fighting at the
  door wall, shadow bias, smooth follow camera, Bolt mesh fitted to his collision hull, shadows refreshed every 2nd frame.
- Files: capture.html, game.mjs, pilot.mjs, render.mjs, world.mjs, space.mjs, director.mjs, vendor/three.module.js,
  vendor/three.core.js, runs/events_seed1.json, runs/events_seed2.json.
- Rebuild + validate: `python3 runs/make_m2_bundle.py` (deterministic tar: fixed order, mtime 0, owner 0, so the sha256 only
  changes if a file changes). The validation runs, with no network:
  1. `rh_submit.build_job` + `rh_common.validate_job` for all 3 capture jobs (bundle name, sha256, sizes, limit, single .mp4 output) -> pass
  2. `rh_common.safe_extract` (the worker's extractor) into a temp dir -> all 11 files present, no unsafe members
  3. re-simulates seed 1 from the extracted files only; the log matches `runs/events_seed1.json` tick for tick (run_end 9299 -> 4650 frames)
- Contract check: `capture.html` was driven exactly the way `rh_capture.mjs` drives it (`cap.init(seed, W, H, events)` then
  `cap.frame(2)`): ticks 0, 2, 4, no errors. It treats any log with a `launch` event as M2.

## Encoder and bitrate: 20 Mb/s is NOT possible with the helper as it is today
`rh_capture.mjs` is fixed in the helper repo, and a capture job can only set seed, size, limit and the output name:
- On the Mac (darwin): `h264_videotoolbox -b:v 12M` for anything over 1 MP (both 1920x1080 and 1080x1920), else 6M.
- Elsewhere: `libx264 -crf 20`.
- `--exact-encoder` is accepted by `validate_job`, but the worker only applies it to plain ffmpeg jobs. `capture_args()` ignores it,
  and the VideoToolbox->libx264 retry doesn't touch capture args. So `--exact-encoder` has no effect on capture jobs.
- The lossless route (`-o x.mkv` = FFV1, then a separate `--exact-encoder` libx264 20M job) won't work for the full run: 4650
  1080p FFV1 frames are far over the 1.9 GB per-file output/input cap, and `--limit` can't start mid-run, so it can't be split.
Options (Frog / Grok Bot decide; I didn't change the helper and pushed nothing):
- **A (recommended): one-line helper change**, drafted in `runs/rh_capture_20M.patch` (NOT applied): libx264 `-preset medium
  -b:v 20M -maxrate 20M -bufsize 40M` on every platform. This needs a commit to `m-fin/render-helper` and the Mac worker
  updated (re-run install.command) before submitting, and both need Frog's OK. Tested locally on 3 frames: same pixel format/range as below.
- **B:** capture at today's 12 Mb/s VideoToolbox and accept it.

## Pixel format and colour range (verified on a 3-frame local encode, ffmpeg 7.1.5)
The capture's frames are canvas JPEGs (q 0.92, JFIF = full-range BT.601). With the script's `-c:v mjpeg -i - ... -pix_fmt yuv420p`,
ffmpeg keeps them full range. Measured output: **`yuvj420p`, color_range `pc` (full), colorspace `bt470bg` (BT.601), primaries and
transfer untagged**, Y spans 0-255 (source JPEG 0-248). The same happens with the proposed 20M libx264 args.
-> **The Ep1 full-to-limited + BT.601->BT.709 conversion applies to M2 as well**
(`scale=in_range=full:out_range=limited:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p` + `-color_range tv -colorspace bt709 ...`).
Ep1's Mac captures came out yuvj420p/smpte170m (VideoToolbox tags BT.601 as smpte170m). Same matrix, same conclusion.
The Mac's ffmpeg build may tag slightly differently, so ffprobe the smoke-test output before the edit.

## Exact submit commands (only after Frog says yes; one job at a time)
Run from the helper repo, with `RH_GITHUB_TOKEN` and `RH_HMAC_KEY` set (rh_submit refuses without them). Default transport (github).
If option A is chosen, apply/commit the patch and update the Mac worker first; the commands stay the same.
```
cd /workspace/crave-lab/render-helper/repo
B=/workspace/crave-lab/games/premiere/out/capture_m2/drifthome_m2_game.tar
O=/workspace/videos/drifthome/ep2/capture
# 0. smoke test: 300 frames (10 s), measures Mac capture speed and lets us ffprobe range/bitrate
python3 rh_submit.py --bot crave-builder --capture $B --seed 1 --size 1920x1080 --limit 300 -o drifthome_m2_seed1_test_1920x1080.mp4 --outdir $O
# 1. 16:9, full 0-155 s (4650 frames)
python3 rh_submit.py --bot crave-builder --capture $B --seed 1 --size 1920x1080 -o drifthome_m2_seed1_1920x1080.mp4 --outdir $O
# 2. 9:16, full 0-155 s (4650 frames)
python3 rh_submit.py --bot crave-builder --capture $B --seed 1 --size 1080x1920 -o drifthome_m2_seed1_1080x1920.mp4 --outdir $O
```
(`--exact-encoder` is left off because it does nothing for capture jobs; see above.)

## Ep1 re-capture bundle (same pass, NOT submitted)
- `out/capture_m1/drifthome_ep1_m1_game.tar` (`python3 runs/make_m1_bundle.py`): same 9 code files + the M1 logs packed as
  `runs/events_seed1/2.json`; capture.html sees no `launch` event and replays the cabin-only Ep1 run. Seed 1 = 37.983 s / 1140 frames
  (sha256 `6ce7654dbe355d512e367b46b407bba45959c75ae8c62b17e8aea64cc132b875`, 2,242,560 bytes, rebuilt ~2:50 PM ET for v4; v3
  `4e02da9aa09584f348abae5f55120aa36dae124c042ebbae5a45e1c17dd6faa9` (2,232,320 bytes) kept as `backups/drifthome_ep1_m1_game-pre-v4.tar`; v2 `d579422f0f057de56d34474d343ca959a104f9475de33c7fe4fc5879836f6f01`
  kept as `backups/drifthome_ep1_m1_game-pre-v3.tar`; before that `dd2d366f...` kept as
  `backups/drifthome_ep1_m1_game-pre-cam1002.tar`). vs the Oct 17 Ep1 log: wake 1.283 and
  float_start 3.683 unchanged; cockpit_reach 15.933 -> 15.917, window_look 27.000 -> 26.983, run_end 38.000 -> 37.983 (BOLT.down 0.53). Validated offline the same way (jobs, safe_extract, self-sim, capture.html contract).
  Submit commands are the M2 ones with `B=.../out/capture_m1/drifthome_ep1_m1_game.tar` and `drifthome_ep1_seed1_*.mp4` names.

## Checks and risks
- v5 (free play only, ~5:50 PM ET): the bundles were NOT rebuilt; the v4 tars above remain the capture bundles. render.mjs in the game folder now differs from the bundled copy only in free-play code; capture camera identical to v4 (32/32 runs, 0 frames) and logs byte-identical.
- v4 capture camera: unchanged vs v3. `tests/capture_cam_identity.mjs --ref <v3 tree>`: Ep1 M1 + M2, seeds 1-8, 16:9 + 9:16 (32 runs), camera position + rotation every frame, 0 frames differ. The only capture-path change is one warm-up render at load (before frame 0; the camera isn't touched). Event logs byte-identical (M1 + M2 seeds 1-8).
- Known, not fixed (capture-only, optional): Ep1 9:16 21.4-22.07 s, a handhold ring is over Bolt's head.
- v3 capture camera: the doorway room cut moves ~1.4 s earlier (Ep1 22.23 s at 16:9 / 22.1 s at 9:16; M2 s1 146.23 / 142.9 s). Spot-check the doorway shots.
- Worker timeout is 2 h per job, so 4650 frames need >= 0.65 fps. Job 0 shows the real speed; if it's too slow, use 1280x720.
- After download: ffprobe (duration 154.983 s, 4650 frames, pix_fmt, range, bitrate) and spot-check each event time against `stills/m2/`.
- Note: shadows now refresh every 2nd frame (was every 6th), so cabin frames cost a bit more on the Mac; job 0 shows the speed.
- Watch for: nebula sprites popping as the camera passes through clouds, asteroid tumble, the dock cut.
