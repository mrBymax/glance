// Writes each diagram of the deck as a standalone page in docs/pitch/diagrams. build.mjs inlines the SVG of each page.
// The grammar is that of the diagram-design skill, in the skin of the site: Neutral tokens, Optimistic, orthogonal
// connectors with r=8 corners, labels on an opaque mask with a gap, one focal element, a legend strip when two kinds
// of connector exist. Each unit is one pixel of the 1920 x 1080 slide, so no text is under 24 px.
//   node docs/pitch/scripts/diagrams.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { TOKENS as T, arrow, box, diagramPage, iconAt, label, svgOpen, text } from './lib.mjs';

const outDir = fileURLToPath(new URL('../diagrams/', import.meta.url));
await mkdir(outDir, { recursive: true });
const diagrams = [];

/* 1. The four steps of the protocol in a row, the nod as the focal step (page 10 of the script). */
{
  const slug = 'steps';
  const width = 1728;
  const height = 312;
  const xs = [216, 648, 1080, 1512];
  const cy = 96;
  const r = 88;
  const steps = [
    { n: '1', title: 'Look.', icon: 'scan-eye' },
    { n: '2', title: 'Hear.', icon: 'audio-lines' },
    { n: '3', title: 'Nod.', icon: 'check', focal: true },
    { n: '4', title: 'Done.', icon: 'circle-check' },
  ];
  let svg = svgOpen({ slug, width, height, title: 'The four steps of the Glance protocol', desc: 'Four steps in a row: look at a Glance code, hear what a nod will do, nod to confirm, and the place gets the answer.' });
  for (let i = 0; i < 3; i += 1) {
    const from = xs[i] + r + 18;
    const to = xs[i + 1] - r - 18;
    svg += arrow(`M${from},${cy} H${to}`, { end: [to, cy], direction: 'right', width: 3 });
  }
  steps.forEach((step, i) => {
    const x = xs[i];
    const fill = step.focal ? T.accent : T.card;
    const ink = step.focal ? T.onAccent : T.ink;
    svg += `<circle cx="${x}" cy="${cy}" r="${r}" fill="${fill}" stroke="${step.focal ? T.accent : 'rgba(0,0,0,0.16)'}" stroke-width="2"/>`;
    svg += text(x, cy + 30, step.n, { size: 84, weight: 700, fill: ink, anchor: 'middle' });
    svg += text(x, 290, step.title, { size: 72, weight: 650, anchor: 'middle' });
  });
  diagrams.push({ slug, title: 'The four steps of the Glance protocol', svg: `${svg}</svg>` });
}

/* 2. The parts of the protocol: glasses, phone, Glance server, recognition, and a place. */
{
  const slug = 'parts';
  const width = 1728;
  const height = 664;
  const tall = { h: 260, titleSize: 30, lineSize: 25, lineGap: 34 };
  const node = ({ x, title, icon, lines, focal }) => {
    const y = 0;
    const w = 280;
    let out = `<g class="dg-box"><rect x="${x}" y="${y}" width="${w}" height="${tall.h}" rx="14" fill="${T.canvas}"/>`;
    out += `<rect x="${x}" y="${y}" width="${w}" height="${tall.h}" rx="14" fill="${focal ? T.accent : T.card}" stroke="${focal ? T.accent : 'rgba(0,0,0,0.16)'}" stroke-width="2"/>`;
    out += iconAt(icon, x + 28, 28, 36, focal ? T.onAccent : T.ink);
    out += text(x + 28, 112, title, { size: tall.titleSize, weight: 650, fill: focal ? T.onAccent : T.ink });
    lines.forEach((line, i) => { out += text(x + 28, 156 + i * tall.lineGap, line, { size: tall.lineSize, fill: focal ? '#d4d4d4' : T.secondary }); });
    return `${out}</g>`;
  };
  let svg = svgOpen({ slug, width, height, title: 'How the Glance protocol works', desc: 'A place shows a Glance code that the glasses camera sees; the glasses send video and motion to the phone and play the voice; the phone sends the code and the nod to the Glance server, which writes the spoken lines and sends the result to the place.' });
  svg += arrow('M280,96 H490', { end: [490, 96], direction: 'right' });
  svg += arrow('M490,196 H280', { end: [280, 196], direction: 'left' });
  svg += arrow('M770,96 H980', { end: [980, 96], direction: 'right' });
  svg += arrow('M980,196 H770', { end: [770, 196], direction: 'left' });
  svg += arrow('M1260,130 H1448', { end: [1448, 130], direction: 'right' });
  svg += arrow('M1120,260 V497 Q1120,505 1112,505 H380', { end: [380, 505], direction: 'left', start: [1120, 260], startDirection: 'up' });
  svg += arrow('M140,430 V260', { end: [140, 260], direction: 'up', color: T.ink, dashed: true, width: 3 });
  svg += label(385, 78, 'Video, motion');
  svg += label(385, 178, 'Voice');
  svg += label(875, 78, 'Code, nod');
  svg += label(875, 178, 'Spoken lines');
  svg += label(1354, 112, 'Products');
  svg += label(750, 487, 'Register, result');
  svg += label(162, 356, 'Glance code', { anchor: 'start', fill: T.ink, weight: 650 });
  svg += node({ x: 0, title: 'Glasses', icon: 'glasses', lines: ['Ray-Ban Meta', 'Camera, speakers,', 'motion sensor'] });
  svg += node({ x: 490, title: 'Phone', icon: 'smartphone', lines: ['Reads each code', 'Pixelates faces', 'Works screen off'] });
  svg += node({ x: 980, title: 'Glance server', icon: 'server', lines: ['Sessions, places', 'Spoken lines', 'Confirms a nod'], focal: true });
  svg += node({ x: 1448, title: 'Recognition', icon: 'scan-barcode', lines: ['Gemini model', 'Store list', 'Open Food Facts'] });
  svg += box({ x: 0, y: 430, w: 380, h: 150, title: 'Place', icon: 'store', lines: ['Shows a Glance code', 'Acts on the result'], lineSize: 25, lineGap: 34, titleSize: 30 });
  // Legend strip.
  svg += `<line x1="0" x2="${width}" y1="612" y2="612" stroke="rgba(0,0,0,0.12)" stroke-width="1.5"/>`;
  svg += `<line x1="0" x2="48" y1="644" y2="644" stroke="${T.icon2}" stroke-width="2.5"/>`;
  svg += text(64, 652, 'Data over the network', { size: 24, fill: T.secondary });
  svg += `<line x1="400" x2="448" y1="644" y2="644" stroke="${T.ink}" stroke-width="3" stroke-dasharray="10 8"/>`;
  svg += text(464, 652, 'Seen by the camera of the glasses', { size: 24, fill: T.secondary });
  diagrams.push({ slug, title: 'How the Glance protocol works', svg: `${svg}</svg>` });
}

/* 4. The head window as built: it opens 300 ms after the line of each prompt starts, and a nod stops the line. */
{
  const slug = 'head-window';
  const width = 1728;
  const height = 248;
  const x0 = 340;
  const s = 112;
  const at = (seconds) => x0 + seconds * s;
  let svg = svgOpen({ slug, width, height, title: 'When a nod counts', desc: 'For a product and for a payment, the head window opens 300 milliseconds after the voice line starts, so a nod during the line counts and stops the voice at once; the window closes 8 seconds after the line ends by default.' });
  svg += text(0, 58, 'Voice line', { size: 26, weight: 600 });
  svg += text(0, 146, 'Head window', { size: 26, weight: 600 });
  // The line plays until the nod at 1.5 s; the rest of it is cut.
  svg += `<rect x="${at(0)}" y="24" width="${1.5 * s}" height="48" rx="8" fill="${T.accent}"/>`;
  svg += `<rect x="${at(1.5)}" y="25" width="${1.5 * s}" height="46" rx="8" fill="none" stroke="${T.accent}" stroke-width="2" stroke-dasharray="8 6"/>`;
  svg += iconAt('audio-lines', at(0) + 16, 34, 28, '#ffffff');
  svg += text(at(3) + 24, 58, 'A nod at 1.5 s stops the voice at once.', { size: 26, weight: 600 });
  svg += `<rect x="${at(0.3)}" y="112" width="${(11 - 0.3) * s}" height="48" rx="8" fill="${T.card}" stroke="${T.ink}" stroke-width="2"/>`;
  svg += text(at(1.5) + 26, 145, 'Opens 0.3 s after the line starts, for every prompt', { size: 24 });
  svg += text(at(11) - 18, 145, 'Closes 8 s after the line', { size: 24, anchor: 'end' });
  svg += `<line x1="${at(1.5)}" x2="${at(1.5)}" y1="16" y2="172" stroke="${T.ink}" stroke-width="2.5"/>`;
  svg += `<circle cx="${at(1.5)}" cy="136" r="11" fill="${T.ink}"/>`;
  svg += `<line x1="${x0}" x2="${at(12)}" y1="200" y2="200" stroke="rgba(0,0,0,0.3)" stroke-width="2"/>`;
  for (let t = 0; t <= 12; t += 1) {
    svg += `<line x1="${at(t)}" x2="${at(t)}" y1="194" y2="${t % 2 === 0 ? 210 : 204}" stroke="rgba(0,0,0,0.3)" stroke-width="2"/>`;
    if (t % 2 === 0) svg += text(at(t), 242, String(t), { size: 24, fill: T.secondary, anchor: 'middle' });
  }
  svg += text(0, 242, 'Seconds', { size: 24, fill: T.secondary });
  diagrams.push({ slug, title: 'When a nod counts', svg: `${svg}</svg>` });
}

/* 5. What sits where: the glasses of Meta, the loop, and the places on top. */
{
  const slug = 'layers';
  const width = 800;
  const height = 490;
  const layers = [
    { y: 0, title: 'Places', line: 'Show a code, act on the result', owner: 'Any business', icon: 'store' },
    { y: 170, title: 'The Glance loop', line: 'Code, spoken offer, nod, result', owner: 'Built today', icon: 'scan-eye', focal: true },
    { y: 340, title: 'Ray-Ban Meta and the toolkit', line: 'Camera, speakers, motion, touchpad', owner: 'Meta', icon: 'glasses' },
  ];
  let svg = svgOpen({ slug, width, height, title: 'Where Glance sits', desc: 'Three layers: the Ray-Ban Meta glasses and the Wearables Device Access Toolkit at the base, the Glance loop in the middle, and the places that show a code on top.' });
  layers.forEach((layer) => {
    const fill = layer.focal ? T.accent : T.card;
    const ink = layer.focal ? T.onAccent : T.ink;
    const sub = layer.focal ? '#d4d4d4' : T.secondary;
    svg += `<rect x="0" y="${layer.y}" width="${width}" height="150" rx="14" fill="${fill}" stroke="${layer.focal ? T.accent : 'rgba(0,0,0,0.16)'}" stroke-width="2"/>`;
    svg += iconAt(layer.icon, 32, layer.y + 28, 40, ink);
    svg += text(92, layer.y + 62, layer.title, { size: 36, weight: 650, fill: ink });
    svg += text(32, layer.y + 118, layer.line, { size: 28, fill: sub });
    const tagWidth = layer.owner.length * 24 * 0.55 + 32;
    svg += `<rect x="${width - 28 - tagWidth}" y="${layer.y + 26}" width="${tagWidth}" height="44" rx="22" fill="${layer.focal ? '#333333' : T.canvas}"/>`;
    svg += text(width - 28 - tagWidth / 2, layer.y + 56, layer.owner, { size: 24, weight: 600, fill: ink, anchor: 'middle' });
  });
  diagrams.push({ slug, title: 'Where Glance sits', svg: `${svg}</svg>` });
}

/* 6. The path to adoption in three phases. */
{
  const slug = 'gtm';
  const width = 1728;
  const height = 520;
  const cols = [0, 600, 1200];
  const phases = [
    { n: '1', title: 'Store pilot', lines: ['One store, one checkout,', 'a staffed lane beside it.', 'Count the nods that pay,', 'any yes by mistake, the time.'], needs: ['A payment provider', 'The list of the store'], focal: true },
    { n: '2', title: 'More places', lines: ['Places with a fixed offer:', 'a bus fare, a gate, a machine.', 'Each one shows a code and', 'acts on the result.'], needs: ['A place states its own offer', '(the next part to build)'] },
    { n: '3', title: 'In the glasses', lines: ['The loop as a feature of', 'the glasses: no phone app,', 'one code format,', 'any place can register.'], needs: ['Work with Meta on', 'the glasses side'] },
  ];
  let svg = svgOpen({ slug, width, height, title: 'Path to adoption', desc: 'Three phases: a pilot at one store checkout, then more places with a fixed offer such as a bus fare or a gate, then the loop as a feature inside the glasses.' });
  for (let i = 0; i < 2; i += 1) {
    const from = cols[i] + 112 + 16;
    const to = cols[i + 1] - 16;
    svg += arrow(`M${from},56 H${to}`, { end: [to, 56], direction: 'right' });
  }
  phases.forEach((phase, i) => {
    const x = cols[i];
    svg += `<circle cx="${x + 56}" cy="56" r="52" fill="${phase.focal ? T.accent : T.card}" stroke="${phase.focal ? T.accent : 'rgba(0,0,0,0.16)'}" stroke-width="2"/>`;
    svg += text(x + 56, 72, phase.n, { size: 44, weight: 700, fill: phase.focal ? T.onAccent : T.ink, anchor: 'middle' });
    svg += text(x, 176, phase.title, { size: 42, weight: 650 });
    phase.lines.forEach((line, j) => { svg += text(x, 228 + j * 40, line, { size: 28, fill: T.ink }); });
    svg += `<line x1="${x}" x2="${x + 500}" y1="412" y2="412" stroke="rgba(0,0,0,0.16)" stroke-width="2"/>`;
    svg += text(x, 452, 'Needs', { size: 24, weight: 650, fill: T.secondary });
    phase.needs.forEach((line, j) => { svg += text(x + 96, 452 + j * 34, line, { size: 24, fill: T.secondary }); });
  });
  diagrams.push({ slug, title: 'Path to adoption', svg: `${svg}</svg>` });
}

/* 7. The places that the protocol enables, around the loop. Only the checkout exists. */
{
  const slug = 'places';
  const width = 1728;
  const height = 500;
  const cardW = 520;
  const cardH = 150;
  const ys = [0, 175, 350];
  const left = [
    { title: 'Checkout', icon: 'shopping-basket', lines: ['“… Two items, four euros', 'forty-nine. Nod to pay.”'], built: true },
    { title: 'Bus ticket', icon: 'bus', lines: ['“Line 4 to the harbor.', 'Single ticket. Nod to buy.”'] },
    { title: 'Ticket gate', icon: 'door-open', lines: ['“Platform gate 2.', 'Nod to open.”'] },
  ];
  const right = [
    { title: 'Vending machine', icon: 'cup-soda', lines: ['“Sparkling water, one fifty.', 'Nod to buy.”'] },
    { title: 'Table order', icon: 'utensils', lines: ['“Margherita, nine euros.', 'Nod to order.”'] },
    { title: 'Parking meter', icon: 'circle-parking', lines: ['“One hour of parking, two euros.', 'Nod to start.”'] },
  ];
  const hub = { x: 664, y: 120, w: 400, h: 260 };
  let svg = svgOpen({ slug, width, height, title: 'Places the protocol enables', desc: 'The Glance loop in the middle, connected to six places: a checkout, which is built, and a bus ticket, a ticket gate, a vending machine, a table order, and a parking meter, which are examples that nobody built.' });
  const fan = [180, 250, 320];
  fan.forEach((fy, i) => {
    const cy = ys[i] + cardH / 2;
    if (i === 1) {
      svg += arrow(`M${hub.x},250 H${cardW}`, {});
      svg += arrow(`M${hub.x + hub.w},250 H${width - cardW}`, {});
    } else {
      const v = i === 0 ? -1 : 1;
      svg += arrow(`M${hub.x},${fy} H600 Q592,${fy} 592,${fy + 8 * v} V${cy - 8 * v} Q592,${cy} 584,${cy} H${cardW}`, {});
      svg += arrow(`M${hub.x + hub.w},${fy} H1128 Q1136,${fy} 1136,${fy + 8 * v} V${cy - 8 * v} Q1136,${cy} 1144,${cy} H${width - cardW}`, {});
    }
  });
  const card = (x, y, item) => {
    let out = `<rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="14" fill="${T.card}" stroke="${item.built ? T.ink : 'rgba(0,0,0,0.16)'}" stroke-width="${item.built ? 3 : 2}"${item.built ? '' : ' stroke-dasharray="10 7"'}/>`;
    out += iconAt(item.icon, x + 28, y + 24, 34, T.ink);
    out += text(x + 76, y + 52, item.title, { size: 30, weight: 650 });
    if (item.built) {
      out += `<rect x="${x + cardW - 136}" y="${y + 20}" width="112" height="42" rx="21" fill="${T.successFill}"/>`;
      out += iconAt('check', x + cardW - 124, y + 29, 24, '#ffffff', 2.5);
      out += text(x + cardW - 66, y + 49, 'Built', { size: 24, weight: 650, fill: '#ffffff', anchor: 'middle' });
    }
    item.lines.forEach((line, j) => { out += text(x + 28, y + 96 + j * 34, line, { size: 25, fill: T.secondary }); });
    return out;
  };
  left.forEach((item, i) => { svg += card(0, ys[i], item); });
  right.forEach((item, i) => { svg += card(width - cardW, ys[i], item); });
  svg += `<rect x="${hub.x}" y="${hub.y}" width="${hub.w}" height="${hub.h}" rx="14" fill="${T.accent}"/>`;
  svg += iconAt('scan-eye', hub.x + 32, hub.y + 32, 44, '#ffffff');
  svg += text(hub.x + 32, hub.y + 128, 'The Glance loop', { size: 38, weight: 650, fill: '#ffffff' });
  svg += text(hub.x + 32, hub.y + 176, 'Look. Hear. Nod. Done.', { size: 28, fill: '#d4d4d4' });
  svg += text(hub.x + 32, hub.y + 218, 'One code format, one rule set', { size: 24, fill: '#d4d4d4' });
  diagrams.push({ slug, title: 'Places the protocol enables', svg: `${svg}</svg>` });
}

for (const diagram of diagrams) {
  await writeFile(`${outDir}${diagram.slug}.html`, diagramPage(diagram));
}
console.log(`wrote ${diagrams.length} diagrams into ${outDir}`);
