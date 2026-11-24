/**
 * Hand-written-looking pen marks (tick, P, A) as SVG, for printed attendance
 * sheets that should look filled in by hand. Deterministic per seed: the same
 * seed always yields identical markup, different seeds yield visibly different
 * marks. No Math.random / Date, no fonts, no dependencies.
 */

export type HandMarkKind = 'check' | 'P' | 'A';

/** Ballpoint blue. */
export const HAND_INK = '#1d3a9e';

const SVG_NS = 'http://www.w3.org/2000/svg';

type Pt = [number, number];
type Rng = () => number;

function hashString(str: string): number {
  // FNV-1a
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fmt = (n: number): string => String(Math.round(n * 10) / 10);

/** Build the path `d` strings for a mark; each path is a list of segments. */
function buildPaths(kind: HandMarkKind, rng: Rng): string[] {
  const j = (amt: number): number => (rng() * 2 - 1) * amt;
  const rot = j(8) * (Math.PI / 180);
  const scale = 0.9 + rng() * 0.15;
  const dx = j(2);
  const dy = j(2);
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);

  // Jittered point, then rotate/scale about the box centre and nudge.
  const p = (x: number, y: number, amt = 2.5): Pt => {
    const ux = (x + j(amt) - 50) * scale;
    const uy = (y + j(amt) - 50) * scale;
    return [50 + ux * cos - uy * sin + dx, 50 + ux * sin + uy * cos + dy];
  };
  const s = (pt: Pt): string => `${fmt(pt[0])} ${fmt(pt[1])}`;
  const M = (pt: Pt) => `M${s(pt)}`;
  const Q = (c: Pt, e: Pt) => `Q${s(c)} ${s(e)}`;
  const C = (c1: Pt, c2: Pt, e: Pt) => `C${s(c1)} ${s(c2)} ${s(e)}`;

  if (kind === 'check') {
    const overshoot = rng() < 0.4 ? 3 + rng() * 5 : 0;
    const start = p(16, 54);
    const bend = p(26, 70);
    const bottom = p(38, 86, 2);
    const c1 = p(50, 66, 4);
    const c2 = p(70, 36, 4);
    const tip = p(88 + overshoot, 14 - overshoot * 0.6, 2);
    return [`${M(start)}${Q(bend, bottom)}${C(c1, c2, tip)}`];
  }

  if (kind === 'P') {
    const stemTop = p(32, 10, 2);
    const stemMid = p(30, 52, 2);
    const stemBot = p(29, 90, 2);
    const stem = `${M(stemTop)}${Q(stemMid, stemBot)}`;
    const bowlStart = p(33, 12, 2);
    const bowl = `${M(bowlStart)}${C(p(68, 4, 4), p(82, 30, 4), p(62, 46, 3))}${C(
      p(54, 52, 3),
      p(42, 52, 3),
      p(32, 49, 2.5),
    )}`;
    return [stem, bowl];
  }

  // 'A'
  const apex = p(50, 10, 2.5);
  const left = `${M(apex)}${Q(p(34, 46, 3), p(19, 90, 2.5))}`;
  const right = `${M(p(51, 11, 2))}${Q(p(66, 50, 3), p(81, 90, 2.5))}`;
  const bar = `${M(p(31, 63, 2.5))}${Q(p(50, 58, 3), p(72, 62, 2.5))}`;
  return [left, right, bar];
}

export function handMarkSvg(
  doc: Document,
  kind: HandMarkKind,
  seed: string,
  options: { color?: string; strokeWidth?: number } = {},
): SVGSVGElement {
  const color = options.color ?? HAND_INK;
  const rng = mulberry32(hashString(`${kind}:${seed}`));
  const svg = doc.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('class', 'hand-mark');
  svg.setAttribute('data-mark', kind);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('overflow', 'visible');

  // Slight pressure variation per mark.
  const width = options.strokeWidth ?? 6.6 + rng() * 0.8;
  for (const d of buildPaths(kind, rng)) {
    const path = doc.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', fmt(width));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
  }
  return svg;
}
