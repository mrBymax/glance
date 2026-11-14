// Writes the HTML of the page into dist/index.html, so the text shows before the script loads.
// npm run build runs it after the client build and the server build of src/entry-server.tsx.
import { readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dist = (path) => fileURLToPath(new URL(`../dist/${path}`, import.meta.url));
const serverDir = fileURLToPath(new URL('../dist-ssr/', import.meta.url));

const { render } = await import(pathToFileURL(`${serverDir}entry-server.js`).href);
let html = render();
// The server build uses the base "/". With the relative base of the client build, each asset path starts with "./".
if ((process.env.SITE_BASE ?? './') === './') html = html.replace(/(["\s,])\/assets\//g, '$1./assets/');

const page = await readFile(dist('index.html'), 'utf8');
const marker = '<div id="root"></div>';
if (!page.includes(marker)) throw new Error(`dist/index.html has no ${marker}`);
// A social preview needs an absolute image URL. SITE_URL is the address of the deployed site, with a trailing slash.
const siteUrl = process.env.SITE_URL ?? './';
await writeFile(dist('index.html'), page.replace(marker, `<div id="root">${html}</div>`).replaceAll('__SITE_URL__', siteUrl));
await rm(serverDir, { recursive: true, force: true });
console.log(`prerendered ${Math.round(html.length / 1024)} KB of HTML into dist/index.html`);
