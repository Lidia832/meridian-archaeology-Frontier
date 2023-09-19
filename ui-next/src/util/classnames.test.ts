// src/util/classnames.test.ts
// M. Osei, 2023-08 — spec for cx(). Vitest not installed; see MIGRATION.md.

import { describe, it, expect } from 'vitest';
import { cx } from './classnames';

describe('cx', () => {
  it('joins string arguments with spaces', () => {
    expect(cx('a', 'b', 'c')).toBe('a b c');
  });

  it('drops falsy values', () => {
    expect(cx('a', false, null, undefined, '', 'b')).toBe('a b');
  });

  it('includes object keys whose value is truthy', () => {
    expect(cx('base', { active: true, disabled: false })).toBe('base active');
  });

  it('mixes strings, conditionals and objects', () => {
    const isActive = true;
    const selected = false;
    expect(cx('grid', isActive && 'active', { sel: selected })).toBe('grid active');
  });

  it('returns an empty string when nothing is truthy', () => {
    expect(cx(false, null, { x: false })).toBe('');
  });
});
