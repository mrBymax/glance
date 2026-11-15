import * as m from 'motion/react-m';
import { useInView } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { DIAGRAM } from '../content/site';
import { EASE_OUT } from '../motion/Reveal';

/*
 * The Glance protocol: a place, the glasses, the phone, the Glance server, and the model and data for products
 * without a code. After docs/architecture.md of the app branch.
 * Two drawings of one content: a wide one for a container of 70 rem or more, a tall one below it. The text of both is
 * 18.5 units or more, and each one is shown only at widths where a unit is 0.76 px or more, so no text is under 14 px.
 * The grammar follows the diagram-design skill: orthogonal connectors with r=8 corners, labels on a mask with a gap,
 * one focal path (the Glance code that the camera sees), a legend strip at the bottom.
 */

type Direction = 'right' | 'left' | 'up' | 'down';
type Arrow = {
  d: string;
  end: [number, number];
  direction: Direction;
  /** A second head at the start, for a flow both ways. */
  start?: [number, number];
  startDirection?: Direction;
  label: string;
  labelAt: [number, number];
  anchor: 'start' | 'middle' | 'end';
  isFocal?: boolean;
};
type Box = { x: number; y: number; w: number; h: number; title: string; lines: readonly string[]; isGroup?: boolean };

const NAME = 24;
const TEXT = 18.5;
const LINE = 27;
const CHAR = 0.53 * TEXT;

const { parts, flows, legend } = DIAGRAM;

const WIDE = {
  width: 1480,
  height: 680,
  boxes: [
    { x: 40, y: 40, w: 220, h: 300, ...parts.glasses },
    { x: 430, y: 40, w: 240, h: 300, ...parts.phone },
    { x: 840, y: 40, w: 240, h: 300, ...parts.server },
    { x: 1210, y: 40, w: 230, h: 180, ...parts.model },
    { x: 40, y: 440, w: 260, h: 140, ...parts.place },
  ] satisfies Box[],
  // Each label sits 16 units above its line: its mask ends 8 units above the stroke.
  arrows: [
    { d: 'M260,130 H430', end: [430, 130], direction: 'right', label: flows.glassesToPhone, labelAt: [345, 114], anchor: 'middle' },
    { d: 'M430,250 H260', end: [260, 250], direction: 'left', label: flows.phoneToGlasses, labelAt: [345, 234], anchor: 'middle' },
    { d: 'M670,130 H840', end: [840, 130], direction: 'right', label: flows.phoneToServer, labelAt: [755, 114], anchor: 'middle' },
    { d: 'M840,250 H670', end: [670, 250], direction: 'left', label: flows.serverToPhone, labelAt: [755, 234], anchor: 'middle' },
    { d: 'M1080,130 H1210', end: [1210, 130], direction: 'right', label: flows.toModel, labelAt: [1145, 114], anchor: 'middle' },
    {
      d: 'M960,340 V502 Q960,510 952,510 H300',
      end: [300, 510],
      direction: 'left',
      start: [960, 340],
      startDirection: 'up',
      label: flows.serverAndPlace,
      labelAt: [630, 494],
      anchor: 'middle',
    },
    { d: 'M150,440 V340', end: [150, 340], direction: 'up', label: flows.code, labelAt: [164, 396], anchor: 'start', isFocal: true },
  ] satisfies Arrow[],
  legendY: 644,
};

const TALL = {
  width: 348,
  height: 1500,
  boxes: [
    { x: 36, y: 20, w: 264, h: 187, ...parts.glasses },
    { x: 36, y: 317, w: 264, h: 187, ...parts.phone },
    { x: 36, y: 654, w: 264, h: 187, ...parts.server },
    { x: 36, y: 951, w: 264, h: 160, ...parts.model },
    { x: 36, y: 1251, w: 264, h: 135, ...parts.place },
  ] satisfies Box[],
  // A label beside a vertical line keeps 12 units from it, in the gap between two boxes.
  arrows: [
    { d: 'M90,207 V317', end: [90, 317], direction: 'down', label: flows.glassesToPhone, labelAt: [102, 245], anchor: 'start' },
    { d: 'M250,317 V207', end: [250, 207], direction: 'up', label: flows.phoneToGlasses, labelAt: [238, 295], anchor: 'end' },
    { d: 'M90,504 V654', end: [90, 654], direction: 'down', label: flows.phoneToServer, labelAt: [102, 545], anchor: 'start' },
    { d: 'M250,654 V504', end: [250, 504], direction: 'up', label: flows.serverToPhone, labelAt: [238, 625], anchor: 'end' },
    { d: 'M90,841 V951', end: [90, 951], direction: 'down', label: flows.toModel, labelAt: [102, 900], anchor: 'start' },
    {
      d: 'M300,760 H308 Q316,760 316,768 V1308 Q316,1316 308,1316 H300',
      end: [300, 1316],
      direction: 'left',
      start: [300, 760],
      startDirection: 'left',
      label: flows.serverAndPlace,
      labelAt: [304, 1170],
      anchor: 'end',
    },
    { d: 'M36,1316 H26 Q18,1316 18,1308 V121 Q18,113 26,113 H36', end: [36, 113], direction: 'right', label: flows.code, labelAt: [30, 1214], anchor: 'start', isFocal: true },
  ] satisfies Arrow[],
  legendY: 1432,
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
          {arrow.start && arrow.startDirection ? (
            <m.polygon points={arrowHead(arrow.start, arrow.startDirection)} variants={fadeVariants} custom={0.85 + index * 0.08} />
          ) : null}
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
