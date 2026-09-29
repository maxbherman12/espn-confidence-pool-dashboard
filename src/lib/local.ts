"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Minimal external store over `localStorage`.
 *
 * Values are read through `useSyncExternalStore` rather than a `useState` +
 * `useEffect` pair, which keeps them out of the server render (so no hydration
 * mismatch) and avoids a set-state-in-effect pass. Writes notify subscribers in
 * this tab; the `storage` event notifies other tabs.
 */

const listeners = new Map<string, Set<() => void>>();

function subscribers(key: string): Set<() => void> {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  return set;
}

function readItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeItem(key: string, value: string | null): void {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    /* storage unavailable (private mode, blocked) - state stays in memory */
  }
  for (const listener of subscribers(key)) listener();
}

function subscribe(key: string, onChange: () => void): () => void {
  const set = subscribers(key);
  set.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    set.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Returns `[value, setValue]`; `setValue(null)` removes the key. */
export function useLocalValue(
  key: string,
  fallback: string | null = null,
): readonly [string | null, (next: string | null) => void] {
  const value = useSyncExternalStore(
    (onChange) => subscribe(key, onChange),
    () => readItem(key) ?? fallback,
    () => fallback,
  );
  const setValue = useCallback(
    (next: string | null) => writeItem(key, next),
    [key],
  );
  return [value, setValue] as const;
}
