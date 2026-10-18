"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFinance } from "@/components/providers";
import { historyKey, type HistoryCursor, type HistoryFilters } from "@/lib/domain/history";
import { getHistoryPage, getHistorySummary } from "@/lib/firebase/history";
import { useResource } from "@/features/finance/use-resource";

export function useTransactionHistory(filters: HistoryFilters) {
  const { user, revision } = useFinance();
  const uid = user!.uid;
  const draftKey = historyKey(filters);
  const [filterKey, setFilterKey] = useState(draftKey);
  useEffect(() => {
    const timer = setTimeout(() => setFilterKey(draftKey), 400);
    return () => clearTimeout(timer);
  }, [draftKey]);
  const stableFilters = useMemo(() => JSON.parse(filterKey) as HistoryFilters, [filterKey]);
  const key = `${uid}:${filterKey}:${revision}`;
  const [navigation, setNavigation] = useState<{ key: string; cursors: (HistoryCursor | null)[] }>({ key: "", cursors: [null] });
  const cursors = navigation.key === key ? navigation.cursors : [null];
  const pageNumber = cursors.length;
  const cursor = cursors.at(-1)!;
  const loadPage = useCallback((signal: AbortSignal) => getHistoryPage(uid, stableFilters, cursor, 25, signal), [uid, stableFilters, cursor]);
  const loadSummary = useCallback((signal: AbortSignal) => getHistorySummary(uid, stableFilters, signal), [uid, stableFilters]);
  const page = useResource(`${key}:page:${pageNumber}`, loadPage);
  const summary = useResource(`${uid}:${filterKey}:summary`, loadSummary);
  const pending = draftKey !== filterKey;
  return {
    page: pending ? undefined : page.value, summary: pending ? undefined : summary.value,
    error: pending ? undefined : page.error || summary.error, pending, pageNumber,
    next: () => { if (page.value?.next && !pending) setNavigation({ key, cursors: [...cursors, page.value.next] }); },
    previous: () => { if (pageNumber > 1 && !pending) setNavigation({ key, cursors: cursors.slice(0, -1) }); },
  };
}
