// Shared helpers of the deck build: the tokens, the Lucide icons, and the SVG primitives of the diagrams.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The stock Neutral tokens of Astryx, light and dark, as the site uses them (apps/site/docs/design.md). */
export const TOKENS = {
  canvas: '#f1f1f1',
  card: '#ffffff',
  ink: '#000000',
  secondary: '#474747',
  icon2: '#6a6a6a',
  accent: '#1b1b1b',
  onAccent: '#ffffff',
  hairline: 'rgba(0,0,0,0.12)',
  emphasized: '#d4d4d4',
  success: '#2f7d33',
  successFill: '#198100',
  warning: '#836700',
  warningMuted: '#fae19e',
  darkBody: '#1b1b1b',
  darkSurface: '#262626',
  darkSecondary: '#9e9e9e',
};

export const FONT = "'Optimistic VF', 'Segoe UI', Arial, sans-serif";

const lucideDir = process.env.LUCIDE_DIR ?? 'C:/Users/marco/Desktop/glance/node_modules/lucide-react/dist/esm/icons';

/** The child elements of one Lucide icon (24 x 24 units), read from the icon module of lucide-react. */
export function iconElements(name) {
  const source = readFileSync(join(lucideDir, `${name}.mjs`), 'utf8');
  // An alias file only re-exports the icon of another name.
  const alias = source.match(/export \{ default \} from '\.\/([a-z0-9-]+)\.mjs'/);
  if (alias) return iconElements(alias[1]);
  // The icon data is a plain object literal of the trusted lucide-react package.
  const literal = source.slice(source.indexOf('{', source.indexOf('const __iconData')), source.indexOf('\n};') + 2);
  const data = Function(`return (${literal});`)();
  const elements = data.node.map(([tag, attributes]) => {
    const pairs = Object.entries(attributes).filter(([key]) => key !== 'key');
    return `<${tag} ${pairs.map(([key, value]) => `${key}="${value}"`).join(' ')}/>`;
  });
  if (elements.length === 0) throw new Error(`no Lucide icon named ${name}`);
  return elements.join('');
}

/** A Lucide icon as an inline SVG element for HTML. */
export function iconSvg(name, { size = 32, stroke = 'currentColor', width = 2, className = 'icon' } = {}) {
  return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconElements(name)}</svg>`;
}

/** A Lucide icon placed inside an SVG drawing, its top left corner at (x, y). */
export function iconAt(name, x, y, size, stroke, width = 2) {
  const scale = size / 24;
  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconElements(name)}</g>`;
}

export const escapeXml = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A text line. The width of a character is about 0.55 em in Optimistic. */
export function text(x, y, value, { size = 24, weight = 400, fill = TOKENS.ink, anchor = 'start', extra = '' } = {}) {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${extra}>${escapeXml(value)}</text>`;
}

export const textWidth = (value, size) => value.length * size * 0.55;

/**
 * An arrow label on an opaque mask. The mask ends `gap` units before the stroke: above a horizontal stroke at
 * strokeY, or beside a vertical stroke.
 */
export function label(x, y, value, { size = 24, anchor = 'middle', paper = TOKENS.canvas, fill = TOKENS.secondary, weight = 500 } = {}) {
  const width = textWidth(value, size) + 16;
  const left = anchor === 'middle' ? x - width / 2 : anchor === 'start' ? x - 8 : x - width + 8;
  return `<g class="dg-label"><rect x="${left.toFixed(1)}" y="${y - size}" width="${width.toFixed(1)}" height="${size + 10}" rx="4" fill="${paper}"/>${text(x, y, value, { size, anchor, fill, weight })}</g>`;
}

/** An arrow head at (x, y), pointing in a direction. */
export function head([x, y], direction, fill) {
  const shapes = {
    right: `${x},${y} ${x - 14},${y - 7} ${x - 14},${y + 7}`,
    left: `${x},${y} ${x + 14},${y - 7} ${x + 14},${y + 7}`,
    up: `${x},${y} ${x - 7},${y + 14} ${x + 7},${y + 14}`,
    down: `${x},${y} ${x - 7},${y - 14} ${x + 7},${y - 14}`,
  };
  return `<polygon points="${shapes[direction]}" fill="${fill}"/>`;
}

/** An orthogonal connector with its heads. `d` uses r=8 corners. */
export function arrow(d, { end, direction, start, startDirection, color = TOKENS.icon2, dashed = false, width = 2.5 }) {
  const dash = dashed ? ' stroke-dasharray="10 8"' : '';
  return `<g class="dg-arrow"><path d="${d}" fill="none" stroke="${color}" stroke-width="${width}"${dash}/>${end ? head(end, direction, color) : ''}${start ? head(start, startDirection, color) : ''}</g>`;
}

/** A node: an opaque mask, then the card. A focal node is black with white text. */
export function box({ x, y, w, h, title, lines = [], focal = false, icon, paper = TOKENS.canvas, titleSize = 32, lineSize = 26, lineGap = 36 }) {
  const fill = focal ? TOKENS.accent : TOKENS.card;
  const titleFill = focal ? TOKENS.onAccent : TOKENS.ink;
  const lineFill = focal ? '#d4d4d4' : TOKENS.secondary;
  const stroke = focal ? TOKENS.accent : 'rgba(0,0,0,0.16)';
  const pad = 28;
  const iconSize = 36;
  const titleX = icon ? x + pad + iconSize + 14 : x + pad;
  let out = `<g class="dg-box"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${paper}"/>`;
  out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  if (icon) out += iconAt(icon, x + pad, y + pad + 4, iconSize, titleFill);
  out += text(titleX, y + pad + 32, title, { size: titleSize, weight: 650, fill: titleFill });
  lines.forEach((line, index) => {
    out += text(x + pad, y + pad + 32 + 22 + lineSize + index * lineGap, line, { size: lineSize, fill: lineFill });
  });
  return `${out}</g>`;
}

/** A standalone diagram page: the font, the canvas, one SVG. The deck inlines the SVG. */
export function diagramPage({ slug, title, svg, background = TOKENS.canvas, dark = false }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeXml(title)}</title>
<style>
@font-face { font-family: 'Optimistic VF'; src: url('../../../apps/site/public/fonts/OptimisticVF.woff2') format('woff2'); font-weight: 300 800; font-stretch: 80% 100%; }
html, body { margin: 0; background: ${background}; }
body { padding: 40px; font-family: ${FONT}; ${dark ? "font-variation-settings: 'DRKM' 1;" : ''} }
.diagram-wrap { overflow-x: auto; }
.diagram-wrap svg { display: block; font-family: ${FONT}; }
</style>
</head>
<body>
<main>
<div class="diagram-wrap" data-slug="${slug}">
${svg}
</div>
</main>
</body>
</html>
`;
}

/** The opening tag of a diagram SVG, with the accessible name and description. */
export function svgOpen({ slug, width, height, title, desc }) {
  return `<svg class="dg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="min-width:${width}px" role="img" aria-labelledby="${slug}-title ${slug}-desc" xmlns="http://www.w3.org/2000/svg"><title id="${slug}-title">${escapeXml(title)}</title><desc id="${slug}-desc">${escapeXml(desc)}</desc>`;
}
