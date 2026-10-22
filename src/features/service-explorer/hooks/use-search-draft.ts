"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { HistoryMode } from "./use-url-filters";

const URL_WRITE_DELAY_MS = 300;
const BURST_END_MS = 2000;

/**
 * The search box keeps its own state so typing is never blocked by anything:
 * results read a deferred copy of it, and the URL is written after a pause.
 *
 * - The first URL write of a typing burst pushes a history entry and later
 *   ones replace it, so Back undoes a whole search, not one letter at a time.
 * - When the URL changes from outside (back/forward, a removed chip), the box
 *   follows it. Our own writes echoing back are recognised and ignored, so a
 *   slow echo can never overwrite letters typed since.
 */
export function useSearchDraft(
  urlQuery: string,
  commit: (query: string, mode: HistoryMode) => void,
) {
  const [draft, setDraft] = useState(urlQuery);
  const [committed, setCommitted] = useState(urlQuery);
  const [seenUrlQuery, setSeenUrlQuery] = useState(urlQuery);
  const burstActive = useRef(false);

  if (urlQuery !== seenUrlQuery) {
    setSeenUrlQuery(urlQuery);
    if (urlQuery !== committed.trim()) {
      setDraft(urlQuery);
      setCommitted(urlQuery);
    }
  }

  const write = useEffectEvent((value: string) => {
    setCommitted(value);
    commit(value.trim(), burstActive.current ? "replace" : "push");
    burstActive.current = true;
  });

  useEffect(() => {
    if (draft.trim() === committed.trim()) return;
    const timer = window.setTimeout(() => write(draft), URL_WRITE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft, committed]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      burstActive.current = false;
    }, BURST_END_MS);
    return () => window.clearTimeout(timer);
  }, [draft]);

  return [draft, setDraft] as const;
}
