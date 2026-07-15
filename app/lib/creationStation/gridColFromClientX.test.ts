import { describe, expect, it } from 'vitest';
import {
  gridColFromClientX,
  gridColFromClientXWithGutter,
} from '@/app/lib/creationStation/gridColFromClientX';

function fakeEl(left: number, width: number): HTMLElement {
  return {
    getBoundingClientRect: () =>
      ({
        left,
        width,
        right: left + width,
        top: 0,
        bottom: 20,
        height: 20,
        x: left,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect,
  } as HTMLElement;
}

describe('gridColFromClientX', () => {
  it('maps clicks to the column under the pointer', () => {
    const el = fakeEl(100, 160); // 10 cols × 16px
    expect(gridColFromClientX(100, el, 10)).toBe(0);
    expect(gridColFromClientX(115, el, 10)).toBe(0);
    expect(gridColFromClientX(116, el, 10)).toBe(1);
    expect(gridColFromClientX(179, el, 10)).toBe(4);
    expect(gridColFromClientX(259, el, 10)).toBe(9);
  });

  it('clamps past the ends', () => {
    const el = fakeEl(0, 100);
    expect(gridColFromClientX(-20, el, 5)).toBe(0);
    expect(gridColFromClientX(999, el, 5)).toBe(4);
  });
});

describe('gridColFromClientXWithGutter', () => {
  it('ignores the label gutter and hits the step under the pointer', () => {
    const el = fakeEl(0, 44 + 160); // 44 gutter + 10×16
    expect(gridColFromClientXWithGutter(20, el, 10, 44, 160)).toBe(0);
    expect(gridColFromClientXWithGutter(44, el, 10, 44, 160)).toBe(0);
    expect(gridColFromClientXWithGutter(44 + 16, el, 10, 44, 160)).toBe(1);
    expect(gridColFromClientXWithGutter(44 + 40, el, 10, 44, 160)).toBe(2);
  });
});
