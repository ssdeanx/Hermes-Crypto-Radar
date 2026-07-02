// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — In-Memory Cache with TTL
// ═══════════════════════════════════════════════════════════════════════

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

type CacheKey = string;

export class Cache {
  private store = new Map<CacheKey, CacheEntry<unknown>>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs: number = 300_000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  /** Get a value. Returns undefined if missing or expired. */
  get<T>(key: CacheKey): T | undefined {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /** Set a value with optional TTL override. */
  set<T>(key: CacheKey, value: T, ttlMs?: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  /** Delete a key. */
  delete(key: CacheKey): void {
    this.store.delete(key);
  }

  /** Check if key exists and is fresh. */
  has(key: CacheKey): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  /** Clear all entries. */
  clear(): void {
    this.store.clear();
  }

  /** Get cache stats. */
  stats(): { size: number; keys: string[] } {
    // Purge expired first
    for (const key of Array.from(this.store.keys())) {
      const entry = this.store.get(key);
      if (entry && Date.now() > entry.expiresAt) this.store.delete(key);
    }
    return { size: this.store.size, keys: Array.from(this.store.keys()) };
  }

  /** Memoize an async function with cache key based on args. */
  memoize<T>(
    fn: (...args: unknown[]) => Promise<T>,
    keyFn?: (...args: unknown[]) => string,
    ttlMs?: number,
  ): (...args: unknown[]) => Promise<T> {
    return async (...args: unknown[]): Promise<T> => {
      const key = keyFn ? keyFn(...args) : JSON.stringify(args);
      const cached = this.get<T>(key);
      if (cached !== undefined) return cached;
      const result = await fn(...args);
      this.set(key, result, ttlMs);
      return result;
    };
  }
}
