#!/usr/bin/env python3
"""Build the M2 capture bundle for HomeRender and dry-run validate it the way rh_submit.py / rh_worker.py do.
No network, no signing, no submit. Usage: python3 runs/make_m2_bundle.py  (from the premiere folder)."""
import hashlib, io, json, os, subprocess, sys, tarfile, tempfile
GAME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RH = "/workspace/crave-lab/render-helper/repo"
FILES = ["capture.html", "game.mjs", "pilot.mjs", "render.mjs", "world.mjs", "space.mjs", "director.mjs",
         "vendor/three.module.js", "vendor/three.core.js", "runs/events_seed1.json", "runs/events_seed2.json"]
OUT = os.path.join(GAME, "out", "capture_m2", "drifthome_m2_game.tar")
def build():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with tarfile.open(OUT, "w", format=tarfile.USTAR_FORMAT) as t:   # deterministic: fixed order, mtime, owner
        for f in FILES:
            data = open(os.path.join(GAME, f), "rb").read(); ti = tarfile.TarInfo(f); ti.size = len(data); ti.mtime = 0; ti.mode = 0o644
            t.addfile(ti, io.BytesIO(data))
def validate():
    sys.path.insert(0, RH)
    from rh_submit import build_job; from rh_common import validate_job, safe_extract, check_name
    sha = hashlib.sha256(open(OUT, "rb").read()).hexdigest(); name = os.path.basename(OUT); check_name(name)
    jobs = []
    for size, outn, limit in (("1920x1080", "drifthome_m2_seed1_test_1920x1080.mp4", 300), ("1920x1080", "drifthome_m2_seed1_1920x1080.mp4", 0), ("1080x1920", "drifthome_m2_seed1_1080x1920.mp4", 0)):
        w, h = (int(x) for x in size.split("x"))
        cap = {"bundle": name, "seed": 1, "w": w, "h": h, "limit": limit, "out": outn, "bundle_sha256": sha}
        j = build_job("crave-builder", ["capture"], [OUT], [outn], capture=cap); validate_job(j); check_name(outn); jobs.append((size, outn, limit))
    with tempfile.TemporaryDirectory() as d:
        safe_extract(OUT, d)                                   # same extractor the worker uses
        missing = [f for f in FILES if not os.path.isfile(os.path.join(d, f))]
        assert not missing, missing
        run = json.load(open(os.path.join(d, "runs/events_seed1.json"))); end = next(e for e in run["events"] if e["type"] == "run_end")["tick"]
        # self-contained check: re-simulate seed 1 from the extracted files only and compare the log
        js = ("const g=await import('%s/game.mjs'), p=await import('%s/pilot.mjs');g.reset(1);const a=p.makePilot(g.state());let o=g.observe();"
              "while(!(o.flags.window&&o.tick>=o.log.find(e=>e.type==='window_look').tick+240)&&o.t_s<240)o=g.step(a(o)).obs;console.log(JSON.stringify(o.log.map(e=>[e.type,e.tick])))") % (d, d)
        sim = json.loads(subprocess.run(["node", "--input-type=module", "-e", js], capture_output=True, text=True, check=True).stdout)
        assert sim == [[e["type"], e["tick"]] for e in run["events"] if e["type"] != "run_end"], "bundle sim != event log"
    print(json.dumps({"bundle": OUT, "bytes": os.path.getsize(OUT), "sha256": sha, "files": len(FILES), "run_end_tick": end,
                      "frames_full": round(end / 2), "jobs_validated": jobs, "self_sim_matches_log": True}, indent=1))
if __name__ == "__main__":
    build(); validate()
