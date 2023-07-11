// src/hooks/useLocalStorage.ts
// K. Duval, 2023-08 — the persistence layer the Settings screen needed.
//
// This is as far as the Settings persistence story got: a typed localStorage
// hook. Settings itself was never wired to it (the form is disabled), so this
// too has no real caller yet. It is finished and tested-by-hand, though, so
// whoever resumes the migration can point the Settings form straight at it.
//
// Deliberately defensive: localStorage throws in private-mode Safari and when a
// site's storage is blocked, so every access is wrapped. On any failure the
// hook behaves like plain useState — the setting works for the session and is
// simply not persisted.

import { useCallback, useState } from 'react';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable/full. Session-only; nothing else to do.
  }
}

/**
 * useState that mirrors into localStorage under `key`. Same call shape as
 * useState so it is a drop-in for the Settings form when it is wired up.
 */
export function useLocalStorage<T>(
  key: string,
  initial: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => read(key, initial));

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        write(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  return [value, set];
}
