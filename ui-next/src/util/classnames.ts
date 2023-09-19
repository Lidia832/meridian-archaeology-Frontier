// src/util/classnames.ts
// M. Osei, 2023-07 — the tiny className joiner, so screens stop writing
// [a, b].join(' ').trim() by hand. Classic "cx" helper, no dependency.

type ClassArg = string | number | false | null | undefined | Record<string, boolean>;

/**
 * Join class names, dropping falsy values. Object args include a key when its
 * value is truthy:
 *   cx('grid', isActive && 'active', { sel: selected })
 */
export function cx(...args: ClassArg[]): string {
  const out: string[] = [];
  for (const a of args) {
    if (!a) continue;
    if (typeof a === 'string' || typeof a === 'number') {
      out.push(String(a));
    } else if (typeof a === 'object') {
      for (const [k, v] of Object.entries(a)) {
        if (v) out.push(k);
      }
    }
  }
  return out.join(' ');
}
