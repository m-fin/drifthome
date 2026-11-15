# DRIFTHOME

A cozy 3D space-exploration game by Matthew "Frog" Finley. Bolt wakes in the cabin of a drifting ship, floats in zero-g, takes the helm, and flies out through a nebula and an asteroid field toward the planet Ember and its sky dock.

Plain JavaScript and [three.js](https://threejs.org/) 0.186.1, vendored in `vendor/` (no build step, no CDN). The simulation in `game.mjs` is deterministic and separate from rendering, so a run can be replayed and checked headlessly. The scripted flight is unchanged: seeds 1–8 still match the committed event logs.

## Play

Keyboard, mouse, Xbox-style gamepad, or touch.

| | |
|---|---|
| WASD | Walk, float, or (at the helm) thrust and strafe |
| Mouse / arrows | Look. Arrows also turn. Click the view to capture the mouse |
| Space / C | Up / down. Shift is down on foot, and boost at the helm |
| F | Float or walk |
| E | Take the helm in the cockpit, unbuckle, or hold to grab a yellow handhold |
| P | Self-Driving tour of the cabin. Move to take over |
| O | Photo mode |

On a phone or tablet, a stick sits on the left and Helm, Grab, Float, Up, Down, and Boost sit on the right. Drag the right side of the screen to look.

Fly with W. The nose follows the mouse or the right stick. Land slowly on Ember's pad, or creep into the sky dock nose-first. The cabin windows show Ember and the stars turning with the ship. Unbuckle during a coast and watch it from inside.

From a local server (ES modules will not load from `file://`):

```sh
python3 -m http.server 8765
# http://127.0.0.1:8765/
```

GitHub Pages is not turned on for this repo yet. `.github/workflows/pages.yml` publishes the game when Pages is set to GitHub Actions; the address will be <https://m-fin.github.io/drifthome/>.

Useful query flags: `?seed=1`, `&m1=1` for the cabin-only sandbox, `&demo=1` to watch the scripted flight, `&hud=0` to hide the HUD.

## Tests

Node 20. Nothing to install; three.js is vendored.

```sh
npm test
```

That runs the collision playtest, the golden event logs for seeds 1–8 (M1 and M2), and the helm checks. Browser checks in `tests/` need headless Chrome.

## Layout

[TECHNICAL.md](TECHNICAL.md) is the file-by-file map. `PLAN.md` and `STORY.md` are the design notes. Rendered stills and capture bundles stay out of git.

## License

[MIT](LICENSE). Copyright (c) 2026 Matthew Finley.
