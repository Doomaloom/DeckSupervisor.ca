import { describe, expect, it } from 'vitest';
import { HAND_INK, handMarkSvg, type HandMarkKind } from './handMarks';

const KINDS: HandMarkKind[] = ['check', 'P', 'A'];
const SVG_NS = 'http://www.w3.org/2000/svg';

describe('handMarkSvg', () => {
  it('creates an svg element with the expected attributes', () => {
    const svg = handMarkSvg(document, 'check', 'a');
    expect(svg.namespaceURI).toBe(SVG_NS);
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.getAttribute('viewBox')).toBe('0 0 100 100');
    expect(svg.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
    expect(svg.getAttribute('class')).toBe('hand-mark');
    expect(svg.getAttribute('data-mark')).toBe('check');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('overflow')).toBe('visible');
    expect(svg.hasAttribute('width')).toBe(false);
    expect(svg.hasAttribute('height')).toBe(false);
  });

  it.each(KINDS)('%s produces stroked paths only', (kind) => {
    const svg = handMarkSvg(document, kind, 'seed');
    expect(svg.getAttribute('data-mark')).toBe(kind);
    expect(svg.children.length).toBeGreaterThan(0);
    for (const child of Array.from(svg.children)) {
      expect(child.tagName.toLowerCase()).toBe('path');
      expect(child.getAttribute('d')).toMatch(/^M[\d. -]+[QC]/);
      expect(child.getAttribute('d')).not.toMatch(/NaN/);
      expect(child.getAttribute('fill')).toBe('none');
      expect(child.getAttribute('stroke')).toBe(HAND_INK);
      expect(child.getAttribute('stroke-linecap')).toBe('round');
      expect(child.getAttribute('stroke-linejoin')).toBe('round');
      expect(Number(child.getAttribute('stroke-width'))).toBeGreaterThan(5);
    }
  });

  it.each(KINDS)('is deterministic for the same seed (%s)', (kind) => {
    expect(handMarkSvg(document, kind, 'row-3').outerHTML).toBe(
      handMarkSvg(document, kind, 'row-3').outerHTML,
    );
  });

  it.each(KINDS)('differs for different seeds (%s)', (kind) => {
    const seen = new Set(
      ['a', 'b', 'c', 'd', 'e'].map((s) => handMarkSvg(document, kind, s).outerHTML),
    );
    expect(seen.size).toBe(5);
  });

  it('applies a custom color and stroke width', () => {
    const svg = handMarkSvg(document, 'A', 's', { color: '#ff0000', strokeWidth: 9 });
    for (const path of Array.from(svg.querySelectorAll('path'))) {
      expect(path.getAttribute('stroke')).toBe('#ff0000');
      expect(path.getAttribute('stroke-width')).toBe('9');
    }
  });

  it('works with a document from createHTMLDocument', () => {
    const doc = document.implementation.createHTMLDocument('print');
    const svg = handMarkSvg(doc, 'P', 'x');
    expect(svg.ownerDocument).toBe(doc);
    doc.body.appendChild(svg);
    expect(doc.body.querySelectorAll('svg.hand-mark path').length).toBeGreaterThan(0);
  });

  it('keeps coordinates roughly inside the viewBox', () => {
    for (const kind of KINDS) {
      for (let i = 0; i < 200; i++) {
        const svg = handMarkSvg(document, kind, `seed-${i}`);
        for (const path of Array.from(svg.querySelectorAll('path'))) {
          const nums = (path.getAttribute('d') ?? '').match(/-?\d+(\.\d+)?/g)!.map(Number);
          for (const n of nums) {
            expect(n).toBeGreaterThan(-8);
            expect(n).toBeLessThan(108);
          }
        }
      }
    }
  });
});
