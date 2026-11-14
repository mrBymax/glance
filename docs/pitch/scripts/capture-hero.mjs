// Renders still frames of the project animation (assets/animation, the GLB of the team) with a clear background.
// The scene repeats apps/site/src/hero/animation.ts: the same camera, lights, environment, and tone mapping.
// It needs Chrome and the package three: THREE_DIR names its folder (the one with build/ and examples/).
//   node docs/pitch/scripts/capture-hero.mjs [seconds ...]
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(process.env.PUPPETEER_FROM ?? 'C:/Users/marco/Desktop/glance/scripts/integration/package.json');
const puppeteer = require('puppeteer-core');
const chrome = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const threeDir = process.env.THREE_DIR ?? 'C:/Users/marco/Desktop/glance-wt/site/apps/site/node_modules/three';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const outDir = fileURLToPath(new URL('../assets/screens/', import.meta.url));
const times = process.argv.slice(2).map(Number);
const seconds = times.length > 0 ? times : [0.6, 1.4, 2.2, 3.0, 3.8, 6.0];

const cameraZ = Number(process.env.CAMERA_Z ?? 4.6);
const suffix = process.env.CAMERA_Z ? `-z${process.env.CAMERA_Z}` : "";
const page = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:transparent}canvas{display:block;width:1000px;height:1000px}</style>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
</head><body><canvas id="c"></canvas>
<script type="module">
import * as T from 'three';
const CAMERA_Z = ${cameraZ};
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadMetaGlanceAnimation } from '/assets/animation/metaGlancePlayer.js';
const canvas = document.getElementById('c');
const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(2);
renderer.setSize(1000, 1000, false);
renderer.toneMapping = T.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);
const scene = new T.Scene();
const pmrem = new T.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new T.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 0, CAMERA_Z);
scene.add(new T.AmbientLight(0xffffff, 0.45));
const key = new T.DirectionalLight(0xffffff, 1.6); key.position.set(4, 6, 8); scene.add(key);
const rim = new T.DirectionalLight(0x9cc3ff, 0.9); rim.position.set(-6, -3, 4); scene.add(rim);
const player = await loadMetaGlanceAnimation({ variant: 'placeholder', glbUrl: '/assets/animation/meta-glances-placeholder.glb', qrSource: '/apps/site/src/assets/generated/kiosk-code.png', loop: false });
scene.add(player.root);
await new Promise((r) => setTimeout(r, 1200));
window.renderAt = (t) => { player.seek(t); renderer.render(scene, camera); return canvas.toDataURL('image/png'); };
window.duration = player.duration;
document.documentElement.dataset.ready = 'true';
</script></body></html>`;

const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.glb': 'model/gltf-binary', '.png': 'image/png', '.html': 'text/html' };
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (path === '/') return response.end(page);
  const file = path.startsWith('/three/') ? join(threeDir, normalize(path.slice(7))) : join(root, normalize(path.slice(1)));
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(18434, resolve));

await mkdir(outDir, { recursive: true });
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const tab = await browser.newPage();
await tab.setViewport({ width: 1000, height: 1000, deviceScaleFactor: 1 });
await tab.goto('http://localhost:18434/', { waitUntil: 'networkidle0' });
await tab.waitForFunction(() => document.documentElement.dataset.ready === 'true', { timeout: 60000 });
const duration = await tab.evaluate(() => window.duration);
for (const t of seconds) {
  const dataUrl = await tab.evaluate((time) => window.renderAt(time), Math.min(t, duration));
  const name = `hero-${String(t).replace(".", "_")}s${suffix}.png`;
  await writeFile(join(outDir, name), Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
  console.log(`wrote ${name}`);
}
await browser.close();
server.close();
