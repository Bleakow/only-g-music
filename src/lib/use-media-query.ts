import { useEffect, useState } from "react";

/**
 * Hook SSR-safe para media queries: arranca en `false` (evita mismatch de
 * hidratación) y se sincroniza con `window.matchMedia` tras montar.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
