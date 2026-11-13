// node capture.mjs <seed> <W> <H> <out.mp4>  -- frame-locked: 60 Hz sim, 2 ticks per frame, 30 fps, frames piped to ffmpeg.
// Frame k shows the sim after 2k ticks (k = 0..N-1, N = run_end.tick/2), so video duration == run_end t_s.
import fs from 'fs'; import http from 'http'; import path from 'path'; import { spawn } from 'child_process';
import puppeteer from '/workspace/crave-lab/tools/cdp/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const [seed = 1, W = 1280, H = 720, out = 'videos/out.mp4', LIMIT = 0] = process.argv.slice(2).map((x, i) => i === 3 ? x : +x);
const run = JSON.parse(fs.readFileSync(`runs/events_seed${seed}.json`)); const endTick = run.events.find(e => e.type === 'run_end').tick;
const N = LIMIT || Math.round(endTick / 2);
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript' };
const srv = http.createServer((q, s) => { const f = path.join(process.cwd(), decodeURI(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); }); }); await new Promise(r => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, protocolTimeout: 0,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', `--window-size=${W},${H}`] });
const page = await browser.newPage(); page.on('console', m => console.error('[page]', m.text())); page.on('pageerror', e => console.error('[pageerr]', e.message)); browser.on('disconnected', () => console.error('[browser disconnected]')); await page.setViewport({ width: W, height: H });
await page.goto(`http://127.0.0.1:${port}/capture.html`); await page.waitForFunction(() => window.cap);
console.error('init...'); const first = await page.evaluate((s, w, h, e, m) => window.cap.init(s, w, h, e, m), seed, W, H, run.events, run.milestone);
fs.mkdirSync(path.dirname(out), { recursive: true });
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
const write = (b) => new Promise(r => ff.stdin.write(b) ? r() : ff.stdin.once('drain', r));
const t0 = Date.now(); const frames = [];
for (let k = 0; k < N; k++) {
  const info = k === 0 ? first : await page.evaluate(() => window.cap.frame(2));
  if (info.tick !== 2 * k) throw new Error(`tick drift at frame ${k}: ${info.tick}`);
  await write(Buffer.from(info.jpg, 'base64'));
  if (k % (LIMIT ? 1 : 150) === 0) console.error(`frame ${k}/${N} t=${info.t_s} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
ff.stdin.end(); await new Promise(r => ff.on('close', r)); await browser.close(); srv.close();
console.log(JSON.stringify({ out, seed, W, H, frames: N, expected_s: N / 30, run_end_s: run.duration_s }));
