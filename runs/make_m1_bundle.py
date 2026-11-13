#!/usr/bin/env python3
"""Build the Ep1 "First Light" (M1, cabin-only) re-capture bundle from the CURRENT (fixed) build and dry-run validate it the
way rh_submit.py / rh_worker.py do. No network, no signing, no submit. Usage: python3 runs/make_m1_bundle.py (from premiere/).
Same code files as the M2 bundle; the event logs are the M1 ones (runs/m1/events_seed<N>.json, regenerate with
`node run.mjs <N> --m1`), packed as runs/events_seed<N>.json because that is the path rh_capture.mjs reads. capture.html
treats a log without a `launch` event as M1 and replays the cabin-only sim, so this bundle captures Ep1."""
import hashlib, io, json, os, subprocess, sys, tarfile, tempfile
GAME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RH = "/workspace/crave-lab/render-helper/repo"
CODE = ["capture.html", "game.mjs", "pilot.mjs", "render.mjs", "world.mjs", "space.mjs", "director.mjs", "vendor/three.module.js", "vendor/three.core.js"]
LOGS = {"runs/events_seed1.json": "runs/m1/events_seed1.json", "runs/events_seed2.json": "runs/m1/events_seed2.json"}  # arcname -> source
FILES = CODE + list(LOGS)
OUT = os.path.join(GAME, "out", "capture_m1", "drifthome_ep1_m1_game.tar")
def build():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with tarfile.open(OUT, "w", format=tarfile.USTAR_FORMAT) as t:   # deterministic: fixed order, mtime 0, owner 0
        for f in FILES:
            data = open(os.path.join(GAME, LOGS.get(f, f)), "rb").read(); ti = tarfile.TarInfo(f); ti.size = len(data); ti.mtime = 0; ti.mode = 0o644
            t.addfile(ti, io.BytesIO(data))
def validate():
    sys.path.insert(0, RH)
    from rh_submit import build_job; from rh_common import validate_job, safe_extract, check_name
    sha = hashlib.sha256(open(OUT, "rb").read()).hexdigest(); name = os.path.basename(OUT); check_name(name)
    jobs = []
    for size, outn, limit in (("1920x1080", "drifthome_ep1_seed1_test_1920x1080.mp4", 300), ("1920x1080", "drifthome_ep1_seed1_1920x1080.mp4", 0), ("1080x1920", "drifthome_ep1_seed1_1080x1920.mp4", 0)):
        w, h = (int(x) for x in size.split("x"))
        cap = {"bundle": name, "seed": 1, "w": w, "h": h, "limit": limit, "out": outn, "bundle_sha256": sha}
        j = build_job("crave-builder", ["capture"], [OUT], [outn], capture=cap); validate_job(j); check_name(outn); jobs.append((size, outn, limit))
    with tempfile.TemporaryDirectory() as d:
        safe_extract(OUT, d)
        missing = [f for f in FILES if not os.path.isfile(os.path.join(d, f))]; assert not missing, missing
        for seed in (1, 2):
            run = json.load(open(os.path.join(d, f"runs/events_seed{seed}.json")))
            assert run.get("milestone") == "M1" and not any(e["type"] == "launch" for e in run["events"]), "not an M1 log"
            js = ("const g=await import('%s/game.mjs'), p=await import('%s/pilot.mjs');g.reset(%d,{m1:true});const a=p.makePilot(g.state());let o=g.observe();"
                  "while(!(o.flags.window&&o.tick>=o.log.find(e=>e.type==='window_look').tick+660)&&o.t_s<240)o=g.step(a(o)).obs;console.log(JSON.stringify(o.log.map(e=>[e.type,e.tick])))") % (d, d, seed)
            sim = json.loads(subprocess.run(["node", "--input-type=module", "-e", js], capture_output=True, text=True, check=True).stdout)
            assert sim == [[e["type"], e["tick"]] for e in run["events"] if e["type"] != "run_end"], f"seed {seed}: bundle sim != event log"
        run = json.load(open(os.path.join(d, "runs/events_seed1.json"))); end = next(e for e in run["events"] if e["type"] == "run_end")["tick"]
    print(json.dumps({"bundle": OUT, "bytes": os.path.getsize(OUT), "sha256": sha, "files": len(FILES), "run_end_tick": end,
                      "frames_full": round(end / 2), "jobs_validated": jobs, "self_sim_matches_log": True}, indent=1))
if __name__ == "__main__":
    build(); validate()
