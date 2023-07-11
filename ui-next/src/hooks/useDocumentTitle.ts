// src/hooks/useDocumentTitle.ts
// M. Osei, 2023-07 — set the browser tab title per screen.
//
// The legacy console left the tab title as a static string for every screen,
// which made multiple operator tabs indistinguishable. Cheap win; every
// migrated screen sets its own. Restores the previous title on unmount so it
// composes cleanly with routing.

import { useEffect } from 'react';

const SUFFIX = 'Meridian · ui-next';

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} — ${SUFFIX}` : SUFFIX;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
