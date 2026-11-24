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

// ---------------------------------------------------------------------------
// Short handwritten words (class codes such as "LS3", "S2A", "PT1", "SF").
// ---------------------------------------------------------------------------

type Glyph = { w: number; strokes: string[] };

/**
 * Glyph outlines in a local box 0..w by 0..100 (cap height ~10..90), written as
 * M/Q/C path strings. P and A reuse the shapes of the standalone marks.
 */
const GLYPHS: Record<string, Glyph> = {
  A: {
    w: 76,
    strokes: ['M40 10 Q24 46 9 90', 'M41 11 Q56 50 71 90', 'M21 63 Q40 58 62 62'],
  },
  B: {
    w: 60,
    strokes: ['M16 10 Q14 50 16 90', 'M17 11 C50 4 58 38 20 47', 'M20 47 C62 42 62 96 17 89'],
  },
  C: { w: 62, strokes: ['M54 22 C42 6 12 12 11 50 C10 86 42 96 56 76'] },
  F: { w: 52, strokes: ['M14 10 Q13 50 14 90', 'M14 11 Q30 7 46 12', 'M14 50 Q28 46 38 49'] },
  I: { w: 36, strokes: ['M18 12 Q17 50 18 89', 'M8 12 Q18 8 28 11', 'M8 89 Q18 92 28 89'] },
  L: { w: 54, strokes: ['M14 10 Q12 50 15 89 Q32 92 48 86'] },
  P: {
    w: 58,
    strokes: ['M15 10 Q13 52 12 90', 'M16 12 C51 4 65 30 45 46 C37 52 25 52 15 49'],
  },
  S: {
    w: 56,
    strokes: ['M46 22 C38 6 12 10 14 32 C16 50 44 48 44 68 C44 94 14 96 8 74'],
  },
  T: { w: 56, strokes: ['M6 14 Q28 8 50 12', 'M28 12 Q27 50 28 90'] },
  '0': { w: 44, strokes: ['M23 8 C3 8 3 92 22 92 C41 92 41 8 25 10'] },
  '1': { w: 36, strokes: ['M8 30 Q20 24 27 10 Q28 50 27 90'] },
  '2': { w: 44, strokes: ['M7 28 C7 4 38 4 36 30 C34 50 14 70 7 90 Q24 87 40 90'] },
  '3': {
    w: 44,
    strokes: ['M7 16 C20 3 38 12 32 32 C30 42 22 46 16 46 C42 44 42 70 36 82 C28 96 10 94 6 80'],
  },
  '4': { w: 46, strokes: ['M30 10 Q20 50 5 64 Q24 67 43 64', 'M31 12 Q31 50 30 90'] },
  '5': { w: 44, strokes: ['M38 12 Q24 10 13 12 Q12 28 10 46 C28 38 44 52 38 72 C34 90 14 96 6 80'] },
  '6': { w: 44, strokes: ['M35 10 C18 22 8 50 8 66 C8 96 38 94 38 68 C38 46 12 46 9 68'] },
  '7': { w: 44, strokes: ['M5 12 Q24 8 40 11 Q28 50 18 90'] },
  '8': {
    w: 44,
    strokes: ['M22 48 C4 40 8 8 22 8 C36 8 40 38 22 48 C2 58 6 94 22 92 C40 90 42 60 22 48'],
  },
  '9': { w: 44, strokes: ['M36 32 C36 4 6 4 6 30 C6 52 34 52 36 32 C36 56 28 78 14 90'] },
};

export function handTextSvg(
  doc: Document,
  text: string,
  seed: string,
  options: { color?: string; strokeWidth?: number } = {},
): SVGSVGElement {
  if (text.length === 0) throw new Error('handTextSvg: empty text');
  for (const ch of text) {
    if (!Object.prototype.hasOwnProperty.call(GLYPHS, ch)) {
      throw new Error(`handTextSvg: unsupported character "${ch}"`);
    }
  }
  const color = options.color ?? HAND_INK;
  const rng = mulberry32(hashString(`text:${text}:${seed}`));
  const width = options.strokeWidth ?? 6.6 + rng() * 0.8;
  const j = (amt: number): number => (rng() * 2 - 1) * amt;

  const paths: string[] = [];
  let cursor = 0;
  for (const ch of text) {
    const glyph = GLYPHS[ch];
    const rot = j(6) * (Math.PI / 180);
    const scale = 0.93 + rng() * 0.12;
    const dx = j(1.5);
    const dy = j(3);
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const cx = glyph.w / 2;
    const x0 = cursor;
    for (const stroke of glyph.strokes) {
      const tokens = stroke.match(/[MQC]|-?\d+(?:\.\d+)?/g) ?? [];
      let d = '';
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (/[MQC]/.test(t)) {
          d += t;
          continue;
        }
        const x = Number(t) + j(2);
        const y = Number(tokens[++i]) + j(2);
        const ux = (x - cx) * scale;
        const uy = (y - 50) * scale;
        d += `${fmt(x0 + cx + ux * cos - uy * sin + dx)} ${fmt(50 + ux * sin + uy * cos + dy)} `;
      }
      paths.push(d.replace(/ ([MQC])/g, '$1').trim());
    }
    cursor += glyph.w + 4 + j(3);
  }

  const svg = doc.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  svg.setAttribute('viewBox', `0 0 ${fmt(cursor)} 100`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('class', 'hand-mark hand-text');
  svg.setAttribute('data-mark', 'text');
  svg.setAttribute('data-text', text);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('overflow', 'visible');
  for (const d of paths) {
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
