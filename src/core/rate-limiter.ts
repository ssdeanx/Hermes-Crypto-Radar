// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Token-Bucket Rate Limiter
// ═══════════════════════════════════════════════════════════════════════

export class RateLimiter {
  private readonly maxTokens: number;
  private readonly refillIntervalMs: number;
  private tokens: number;
  private lastRefill: number;

  constructor(maxTokens: number, refillIntervalMs: number) {
    this.maxTokens = maxTokens;
    this.refillIntervalMs = refillIntervalMs;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
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
    // Time until next token
    return this.refillIntervalMs - (Date.now() - this.lastRefill);
  }

  /** How many tokens available */
  available(): number {
    this.refill();
    return this.tokens;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed >= this.refillIntervalMs) {
      this.tokens = this.maxTokens;
      this.lastRefill = now;
    }
  }
}
