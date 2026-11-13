# Fair encoder benchmark (DRIFTHOME frames, all on Frog's Mac) — NOT submitted yet
Requires the updated worker + node/playwright on the Mac (re-run install.command).
1. Capture once, lossless: `rh_submit.py --bot bench --capture game.tar --seed 1 --size 1920x1080 -o drift_1080p_ffv1.mkv`
   (fixed rh_capture.mjs; FFV1 level 3, yuv420p, 30 fps, 38.0 s / 1140 frames). Intermediate is a JPEG-q0.92 frame stream stored losslessly, identical input for all encoders.
2. Encode the same .mkv three ways (separate jobs, one at a time, outputs downloaded then release deleted):
   a. `--exact-encoder -- ffmpeg -i {in:drift_1080p_ffv1.mkv} -c:v libx264 -preset veryfast -crf 20 -threads 2 -pix_fmt yuv420p -movflags +faststart {out:b_x264_t2.mp4}`  (mirrors the shared computer's record.js settings)
   b. `--exact-encoder -- ffmpeg -i {in:drift_1080p_ffv1.mkv} -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -movflags +faststart {out:b_x264_all.mp4}`
   c. `-- ffmpeg -i {in:drift_1080p_ffv1.mkv} -c:v h264_videotoolbox -b:v <R> -pix_fmt yuv420p -movflags +faststart {out:b_vt.mp4}`
      with R = size(a) * 8 / 38.0 s (bits/s), computed from job a's measured output so sizes match.
3. Report from stats/jobs.jsonl: wall_s, cpu_s, output_bytes per job. No shared-computer number (none was logged).
Caveat: the ffv1 input must stay under the 1.9 GB per-file cap; if it doesn't, use --size 1280x720 or split.
