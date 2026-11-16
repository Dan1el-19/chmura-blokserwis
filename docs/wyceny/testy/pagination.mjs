/** Plan measured, indivisible content units. Intervals use exclusive end indices. */
export function planPages({ count, capacity, measure, canBreak = () => true, breakPenalty = () => 0 }) {
  if (!Number.isFinite(capacity) || capacity <= 0) throw new Error('Invalid page capacity');
  const best = Array(count + 1).fill(null);
  best[count] = { pages: [], score: 0 };
  for (let start = count - 1; start >= 0; start--) {
    for (let end = start + 1; end <= count; end++) {
      if (end < count && !canBreak(end)) continue;
      const height = measure(start, end);
      if (height > capacity + 0.1 || !best[end]) continue;
      const fill = height / capacity;
      const isLast = end === count && start > 0;
      // A sparse last page matters more than small differences in spacing.
      const sparsePenalty = isLast ? Math.max(0, .4 - fill) ** 2 * 6000 : 0;
      const score = best[end].score + (1 - fill) ** 2 * 8 + sparsePenalty + (end < count ? breakPenalty(end) : 0);
      const candidate = { pages: [{ start, end, height }, ...best[end].pages], score };
      if (!best[start] || candidate.pages.length < best[start].pages.length ||
        (candidate.pages.length === best[start].pages.length && score < best[start].score)) best[start] = candidate;
    }
  }
  if (!best[0]) throw new Error('Content cannot fit a page; split oversized units first');
  return best[0];
}

export function chooseLayout(candidates) {
  if (!candidates.length) throw new Error('No viable layout candidates');
  return candidates.reduce((best, candidate) => {
    if (candidate.pages.length !== best.pages.length) return candidate.pages.length < best.pages.length ? candidate : best;
    return candidate.score + candidate.designPenalty < best.score + best.designPenalty ? candidate : best;
  });
}
