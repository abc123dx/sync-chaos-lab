export type PrefixReduction<T> = {
  originalLength: number;
  reducedLength: number;
  prefix: T[];
};

/**
 * Find the shortest prefix that still satisfies a monotonic failure predicate.
 *
 * This is intentionally smaller in scope than full delta debugging: it cannot
 * remove events from the middle of a trace, and callers must provide a
 * predicate where a reproducing prefix remains reproducing when it grows.
 */
export function reduceToReproducingPrefix<T>(
  items: readonly T[],
  reproduces: (prefix: readonly T[]) => boolean,
): PrefixReduction<T> {
  if (!reproduces(items)) {
    throw new Error("The complete trace does not reproduce the target failure");
  }

  let low = 1;
  let high = items.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (reproduces(items.slice(0, middle))) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }

  return {
    originalLength: items.length,
    reducedLength: low,
    prefix: items.slice(0, low),
  };
}
