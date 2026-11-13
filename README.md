# DRIFTHOME

A cozy 3D space-exploration game by Matthew "Frog" Finley. Bolt wakes alone in the cozy cabin of a drifting ship, floats through zero-g, takes the controls, and flies out past a nebula and an asteroid field to the planet Ember and its sky dock.

Built with plain JavaScript ES modules and [three.js](https://threejs.org/) 0.186.1 (vendored in `vendor/`, no CDN). The simulation (`game.mjs`) is deterministic and separate from rendering, so runs can be replayed and tested headlessly.

## Run it
ES modules need to be served over http:

```sh
python3 -m http.server 8765
# then open http://127.0.0.1:8765/index.html?seed=1&view=follow
```

Keyboard + mouse or an Xbox/standard gamepad. Add `&manual=1` for free play, `&hud=0` to hide the HUD.

## Headless tools (Node 20)
- `node run.mjs <seed>`: run the sim headless and write `runs/events_seed<seed>.json`
- `npm test`: the collision playtest plus the golden-run check (`tests/golden_runs.mjs`: seeds 1-8 must reproduce the committed `runs/` event logs exactly). Runs in GitHub Actions on pull requests and pushes to `main`.
- `node tests/playtest_collision.mjs`: collision playtest only (exit 0 = pass)
- Other checks in `tests/` use headless Chrome (puppeteer-core)

See [TECHNICAL.md](TECHNICAL.md) for the full file-by-file breakdown, and `PLAN.md` / `STORY.md` for design notes.

## Not in this repo
Rendered stills, captured videos, and capture bundles (`*.tar`) are kept out of git because of size.

---
By Matthew "Frog" Finley. All rights reserved.
