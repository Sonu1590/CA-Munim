import type { DigestItem } from "@/hooks/useDashboard";

// Same "fixed object + overrides" convention Tasks.test.tsx's mockTasksState
// and Clients.test.tsx's mockClientsState already use, generalized to
// generate a *count* — nothing in the test suite previously exercised a
// dataset large enough to expose the TodayDigest/MobileHomeScreen unbounded
// "digest" list rendering all 50 items unbounded (see ISSUES.md). Any test
// covering a variable-length list should pair its small happy-path mock
// with a large/pathological-size case built from a factory like this one,
// not a hand-typed array.
export function buildDigestItem(overrides: Partial<DigestItem> = {}): DigestItem {
  return {
    id: "digest-item",
    taskType: "GSTR-3B",
    clientId: "client",
    clientName: "Mock Client",
    dueDate: "2026-05-01",
    daysOverdue: 1,
    ...overrides,
  };
}

/**
 * Builds `n` digest items. `overrides(i)` lets a caller vary fields per
 * index (e.g. mixing overdue and due-today items) without hand-typing each
 * one out.
 */
export function buildDigestItems(
  n: number,
  overrides?: (index: number) => Partial<DigestItem>,
): DigestItem[] {
  return Array.from({ length: n }, (_, i) =>
    buildDigestItem({
      id: `digest-item-${i}`,
      clientId: `client-${i}`,
      clientName: `Mock Client ${i}`,
      ...overrides?.(i),
    }),
  );
}
