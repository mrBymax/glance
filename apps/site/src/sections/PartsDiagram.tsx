import * as m from 'motion/react-m';
import { useInView } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { DIAGRAM } from '../content/site';
import { EASE_OUT } from '../motion/Reveal';

/*
 * The parts of Meta Glance and what flows between them, after docs/architecture.md of the app branch.
 * Two drawings of one content: a wide one for a container of 70 rem or more, a tall one below it. The text of both is
 * 18.5 units or more, and each one is shown only at widths where a unit is 0.76 px or more, so no text is under 14 px.
 * The grammar follows the diagram-design skill: orthogonal connectors with r=8 corners, labels on a mask with a gap,
 * one focal path (the QR code that the camera sees), a legend strip at the bottom.
 */

type Direction = 'right' | 'left' | 'up' | 'down';
type Arrow = { d: string; end: [number, number]; direction: Direction; label: string; labelAt: [number, number]; anchor: 'start' | 'middle' | 'end'; isFocal?: boolean };
type Box = { x: number; y: number; w: number; h: number; title: string; lines: readonly string[]; isGroup?: boolean };

const NAME = 24;
const TEXT = 18.5;
const LINE = 27;
const CHAR = 0.53 * TEXT;

const { parts, flows, legend } = DIAGRAM;

const WIDE = {
  width: 1480,
  height: 700,
  boxes: [
    { x: 40, y: 40, w: 220, h: 360, ...parts.glasses },
    { x: 430, y: 40, w: 240, h: 360, ...parts.phone },
    { x: 840, y: 40, w: 240, h: 360, ...parts.server },
    { x: 1210, y: 40, w: 230, h: 100, ...parts.model },
    { x: 1210, y: 170, w: 230, h: 100, ...parts.storeList },
    { x: 1210, y: 300, w: 230, h: 100, ...parts.openFoodFacts },
    { x: 40, y: 500, w: 220, h: 100, ...parts.kiosk },
    { x: 1210, y: 500, w: 230, h: 100, ...parts.mirror },
  ] satisfies Box[],
  // Each label sits 16 units above its line: its mask ends 8 units above the stroke.
  arrows: [
    { d: 'M260,150 H430', end: [430, 150], direction: 'right', label: flows.glassesToPhone, labelAt: [345, 134], anchor: 'middle' },
    { d: 'M430,300 H260', end: [260, 300], direction: 'left', label: flows.phoneToGlasses, labelAt: [345, 284], anchor: 'middle' },
    { d: 'M670,130 H840', end: [840, 130], direction: 'right', label: flows.frames, labelAt: [755, 114], anchor: 'middle' },
    { d: 'M670,230 H840', end: [840, 230], direction: 'right', label: flows.answers, labelAt: [755, 214], anchor: 'middle' },
    { d: 'M840,330 H670', end: [670, 330], direction: 'left', label: flows.serverToPhone, labelAt: [755, 314], anchor: 'middle' },
    { d: 'M1080,90 H1210', end: [1210, 90], direction: 'right', label: flows.toModel, labelAt: [1145, 74], anchor: 'middle' },
    { d: 'M1080,220 H1210', end: [1210, 220], direction: 'right', label: flows.toStoreList, labelAt: [1145, 204], anchor: 'middle' },
    { d: 'M1080,350 H1210', end: [1210, 350], direction: 'right', label: flows.toOpenFoodFacts, labelAt: [1145, 334], anchor: 'middle' },
    { d: 'M900,400 V542 Q900,550 892,550 H260', end: [260, 550], direction: 'left', label: flows.toKiosk, labelAt: [580, 534], anchor: 'middle' },
    { d: 'M1020,400 V542 Q1020,550 1028,550 H1210', end: [1210, 550], direction: 'right', label: flows.toMirror, labelAt: [1119, 534], anchor: 'middle' },
    { d: 'M150,500 V400', end: [150, 400], direction: 'up', label: flows.qr, labelAt: [164, 456], anchor: 'start', isFocal: true },
  ] satisfies Arrow[],
  legendY: 664,
};

const TALL = {
  width: 348,
  height: 1740,
  boxes: [
    { x: 36, y: 20, w: 264, h: 187, ...parts.glasses },
    { x: 36, y: 317, w: 264, h: 214, ...parts.phone },
    { x: 36, y: 681, w: 264, h: 214, ...parts.server },
    { x: 36, y: 1005, w: 264, h: 187, ...parts.sources },
    { x: 36, y: 1302, w: 264, h: 100, ...parts.kiosk },
    { x: 36, y: 1512, w: 264, h: 100, ...parts.mirror },
  ] satisfies Box[],
  // A label beside a vertical line keeps 12 units from it, in the gap between two boxes.
  arrows: [
    { d: 'M90,207 V317', end: [90, 317], direction: 'down', label: flows.glassesToPhone, labelAt: [102, 245], anchor: 'start' },
    { d: 'M250,317 V207', end: [250, 207], direction: 'up', label: flows.phoneToGlasses, labelAt: [238, 295], anchor: 'end' },
    { d: 'M70,531 V681', end: [70, 681], direction: 'down', label: flows.frames, labelAt: [82, 565], anchor: 'start' },
    { d: 'M110,531 V681', end: [110, 681], direction: 'down', label: flows.answers, labelAt: [122, 612], anchor: 'start' },
    { d: 'M250,681 V531', end: [250, 531], direction: 'up', label: flows.serverToPhone, labelAt: [238, 660], anchor: 'end' },
    { d: 'M90,895 V1005', end: [90, 1005], direction: 'down', label: flows.toSources, labelAt: [102, 955], anchor: 'start' },
    { d: 'M300,830 H308 Q316,830 316,838 V1344 Q316,1352 308,1352 H300', end: [300, 1352], direction: 'left', label: flows.toKiosk, labelAt: [304, 1252], anchor: 'end' },
    { d: 'M300,780 H324 Q332,780 332,788 V1554 Q332,1562 324,1562 H300', end: [300, 1562], direction: 'left', label: flows.toMirror, labelAt: [320, 1462], anchor: 'end' },
    { d: 'M36,1352 H26 Q18,1352 18,1344 V121 Q18,113 26,113 H36', end: [36, 113], direction: 'right', label: flows.qr, labelAt: [30, 1252], anchor: 'start', isFocal: true },
  ] satisfies Arrow[],
  legendY: 1672,
};

function arrowHead([x, y]: [number, number], direction: Direction): string {
  const shapes: Record<Direction, string> = {
    right: `${x},${y} ${x - 10},${y - 5} ${x - 10},${y + 5}`,
    left: `${x},${y} ${x + 10},${y - 5} ${x + 10},${y + 5}`,
    up: `${x},${y} ${x - 5},${y + 10} ${x + 5},${y + 10}`,
    down: `${x},${y} ${x - 5},${y - 10} ${x + 5},${y - 10}`,
  };
  return shapes[direction];
}

const lineVariants = {
  hidden: { pathLength: 0, opacity: 0, transition: { duration: 0 } },
  shown: (index: number) => ({ pathLength: 1, opacity: 1, transition: { duration: 0.7, ease: EASE_OUT, delay: 0.25 + index * 0.08 } }),
};
const fadeVariants = {
  hidden: { opacity: 0, transition: { duration: 0 } },
  shown: (delay: number) => ({ opacity: 1, transition: { duration: 0.4, ease: EASE_OUT, delay } }),
};
const boxVariants = {
  hidden: { opacity: 0, y: 8, transition: { duration: 0 } },
  shown: (index: number) => ({ opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT, delay: index * 0.05 } }),
};

function Drawing(props: { layout: typeof WIDE | typeof TALL; slug: string; state: 'shown' | 'hidden' }) {
  const { layout, slug, state } = props;
  const legendItems: readonly (readonly [number, number])[] = layout === WIDE ? [[40, 0], [420, 0]] : [[18, 0], [18, 34]];
  return (
    <m.svg
      className={`diagram__svg diagram__svg--${slug}`}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="img"
      aria-labelledby={`parts-${slug}-title parts-${slug}-desc`}
      initial={false}
      animate={state}
    >
      <title id={`parts-${slug}-title`}>{DIAGRAM.title}</title>
      <desc id={`parts-${slug}-desc`}>{DIAGRAM.description}</desc>
      {layout.arrows.map((arrow, index) => (
        <g key={arrow.d} className={arrow.isFocal ? 'dg-arrow dg-arrow--focal' : 'dg-arrow'}>
          {arrow.isFocal ? (
            <m.path d={arrow.d} variants={fadeVariants} custom={0.25 + index * 0.08} />
          ) : (
            <m.path d={arrow.d} variants={lineVariants} custom={index} />
          )}
          <m.polygon points={arrowHead(arrow.end, arrow.direction)} variants={fadeVariants} custom={0.85 + index * 0.08} />
        </g>
      ))}
      {layout.arrows.map((arrow, index) => {
        const width = arrow.label.length * CHAR + 12;
        const left = arrow.anchor === 'middle' ? arrow.labelAt[0] - width / 2 : arrow.anchor === 'start' ? arrow.labelAt[0] - 6 : arrow.labelAt[0] - width + 6;
        return (
          <m.g key={`label-${arrow.d}`} className="dg-label" variants={fadeVariants} custom={0.7 + index * 0.08}>
            <rect x={left} y={arrow.labelAt[1] - TEXT} width={width} height={TEXT + 8} rx={3} />
            <text x={arrow.labelAt[0]} y={arrow.labelAt[1]} textAnchor={arrow.anchor}>
              {arrow.label}
            </text>
          </m.g>
        );
      })}
      {layout.boxes.map((box, index) => (
        <m.g key={box.title} className="dg-box" variants={boxVariants} custom={index}>
          <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={10} />
          <text className="dg-box__title" x={box.x + 20} y={box.y + 40} fontSize={NAME}>
            {box.title}
          </text>
          {box.lines.map((line, lineIndex) => (
            <text key={line} className={lineIndex === 0 ? 'dg-box__kind' : 'dg-box__line'} x={box.x + 20} y={box.y + 72 + lineIndex * LINE + (lineIndex > 0 ? 8 : 0)}>
              {line}
            </text>
          ))}
        </m.g>
      ))}
      <g className="dg-legend">
        <line className="dg-legend__rule" x1={layout === WIDE ? 40 : 18} x2={layout.width - (layout === WIDE ? 40 : 18)} y1={layout.legendY - 26} y2={layout.legendY - 26} />
        {legend.map((item, index) => {
          const [x, dy] = legendItems[index] ?? [0, 0];
          const y = layout.legendY + dy;
          return (
            <g key={item.label}>
              <line className={item.isFocal ? 'dg-legend__sample dg-legend__sample--focal' : 'dg-legend__sample'} x1={x} x2={x + 40} y1={y - 6} y2={y - 6} />
              <text x={x + 52} y={y}>
                {item.label}
              </text>
            </g>
          );
        })}
      </g>
    </m.svg>
  );
}

/** The diagram of the technology section. It draws itself in once, when it scrolls into view. */
export function PartsDiagram() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });
  const [state, setState] = useState<'shown' | 'hidden'>('shown');
  useEffect(() => {
    const element = ref.current;
    if (element && element.getBoundingClientRect().top > window.innerHeight) setState('hidden');
  }, []);
  useEffect(() => {
    if (isInView) setState('shown');
  }, [isInView]);

  return (
    <figure ref={ref} className="diagram">
      <Drawing layout={WIDE} slug="wide" state={state} />
      <Drawing layout={TALL} slug="tall" state={state} />
      <figcaption className="visually-hidden">
        <p>{DIAGRAM.description}</p>
        <ul>
          {DIAGRAM.textAlternative.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
