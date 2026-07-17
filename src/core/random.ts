export type RandomSource = {
  bool(probability: number): boolean;
  int(min: number, max: number): number;
  next(): number;
  pick<T>(values: readonly T[]): T;
};

function seedWords(seed: string): () => number {
  let hash = 1779033703 ^ seed.length;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    hash ^= hash >>> 16;
    return hash >>> 0;
  };
}

export function createRandom(seed: string): RandomSource {
  const words = seedWords(seed);
  let state = words();

  const next = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    bool(probability) {
      return next() < probability;
    },
    int(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new Error(`无效的整数范围：${min}..${max}`);
      }
      return min + Math.floor(next() * (max - min + 1));
    },
    pick<T>(values: readonly T[]): T {
      if (values.length === 0) {
        throw new Error("无法从空集合中选取元素");
      }
      return values[Math.floor(next() * values.length)] as T;
    },
  };
}

export function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) {
      return input.map(normalize);
    }
    if (input && typeof input === "object") {
      if (seen.has(input)) {
        throw new TypeError("无法序列化循环引用值");
      }
      seen.add(input);
      const entries = Object.entries(input as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)]);
      seen.delete(input);
      return Object.fromEntries(entries);
    }
    return input;
  };

  return JSON.stringify(normalize(value));
}

export function fingerprint(value: unknown): string {
  const text = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `sc-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function deterministicActorId(value: string): string {
  return [0, 1, 2, 3]
    .map((part) => fingerprint(`${value}:${part}`).slice(3))
    .join("");
}

export function deterministicClientId(value: string): number {
  const parsed = Number.parseInt(fingerprint(value).slice(3), 16);
  return (parsed % 0x7ffffffe) + 1;
}
