// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Token-Bucket Rate Limiter
// ═══════════════════════════════════════════════════════════════════════

export class RateLimiter {
  private readonly maxTokens: number;
  private readonly refillIntervalMs: number;
  private tokens: number;
  private lastRefill: number;
  private readonly tokensPerInterval: number;

  /**
   * Create a token-bucket rate limiter with gradual refill.
   * @param maxTokens Maximum tokens in the bucket
   * @param refillIntervalMs Time in ms to fully refill the bucket
   */
  constructor(maxTokens: number, refillIntervalMs: number) {
    this.maxTokens = maxTokens;
    this.refillIntervalMs = refillIntervalMs;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
    // Calculate tokens per refill interval (at least 1 token per interval)
    this.tokensPerInterval = Math.max(1, Math.floor(this.maxTokens));
  }

  /** Attempt to consume a token. Returns true if allowed, false if rate-limited. */
  tryConsume(): boolean {
    this.refill();
    if (this.tokens <= 0) return false;
    this.tokens--;
    return true;
  }

  /** Consume a token, returning wait time in ms if rate-limited. Returns 0 if allowed. */
  consumeOrWait(): number {
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return 0;
    }
    // Time until next token (approximate)
    return Math.max(1, Math.round(this.refillIntervalMs / this.tokensPerInterval));
  }

  /** How many tokens available */
  available(): number {
    this.refill();
    return this.tokens;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;

    // Gradual refill: add tokens proportionally based on elapsed time
    if (elapsed > 0) {
      const tokensToAdd = (elapsed / this.refillIntervalMs) * this.tokensPerInterval;
      if (tokensToAdd >= 1) {
        this.tokens = Math.min(this.maxTokens, this.tokens + Math.floor(tokensToAdd));
        this.lastRefill = now;
      }
    }
  }
}
