// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Crypto News Fetcher
// ═══════════════════════════════════════════════════════════════════════

import type { NewsArticle, NewsMatch, TokenDef } from './types.js';
import { getTokenList } from './tokens.js';
import { recordFeedResult, getDeadFeeds } from './core/feed-monitor.js';

interface FeedDef {
  name: string;
  url: string;
  tier: 1 | 2 | 3 | 4;
  lang?: string;
}

const NEWS_FEEDS: FeedDef[] = [
  { name: 'CoinTelegraph', url: 'https://cointelegraph.com/rss',          tier: 1 },
  { name: 'CoinDesk',      url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', tier: 1 },
  { name: 'Decrypt',       url: 'https://decrypt.co/feed',                tier: 1 },
  { name: 'The Defiant',   url: 'https://thedefiant.io/feed/',            tier: 1 },
  { name: 'The Block',     url: 'https://www.theblock.co/rss.xml',        tier: 1 },
  { name: 'Blockworks',    url: 'https://blockworks.co/feed/',            tier: 1 },
  { name: 'CryptoSlate',   url: 'https://cryptoslate.com/feed/',          tier: 2 },
  { name: 'CoinStats',     url: 'https://coinstats.app/blog/feed/',       tier: 3 },
  { name: 'DeFi Saver',    url: 'https://blog.defisaver.com/rss/',         tier: 3 },
  { name: 'NullTX',        url: 'https://nulltx.com/feed/',               tier: 4 },
  // Google News RSS feeds (free, no API key needed)
  { name: 'Google News Crypto',  url: 'https://news.google.com/rss/search?q=cryptocurrency&hl=en-US&gl=US&ceid=US:en', tier: 2, lang: 'en' },
  { name: 'Google News Bitcoin', url: 'https://news.google.com/rss/search?q=bitcoin&hl=en-US&gl=US&ceid=US:en', tier: 2, lang: 'en' },
  // X/Twitter via Nitter (no API key, free RSS proxy)
  { name: 'X Crypto (Nitter)',   url: 'https://nitter.net/search/rss?q=cryptocurrency',  tier: 2, lang: 'en' },
];

const SOURCE_TIERS: Record<string, number> = {
  'CoinTelegraph': 1.0,
  'CoinDesk':      1.0,
  'Decrypt':       1.0,
  'The Defiant':   1.0,
  'The Block':     1.0,
  'Blockworks':    1.0,
  'CryptoSlate':   0.8,
  'CoinStats':     0.6,
  'DeFi Saver':    0.7,
  'NullTX':        0.4,
  'Google News Crypto': 0.7,
  'Google News Bitcoin': 0.7,
  'X Crypto (Nitter)':  0.6,
};

// Poison headlines to filter out (SEO spam, roundups, etc.)
const POISON_PATTERNS = [
  /price|prediction|worth|buy|sell|trading|market cap/i,
  /roundup|recap|weekly|daily|top.*crypto/i,
  /how to|guide|explain|what is/i,
  /etf|spot.*etf/i,
  /meme|shitcoin/i,
];

const FETCH_TIMEOUT_MS = 15_000;

/** Parse RSS feed XML to articles */
function parseRSS(xml: string, source: string): NewsArticle[] {
  const articles: NewsArticle[] = [];

  // Extract <item>...</item> blocks
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1]!;
    const getField = (tag: string): string => {
      const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(item);
      return m ? stripHTML(m[1]!.trim()) : '';
    };

    const headline = getField('title');
    const description = getField('description');
    const pubDate = getField('pubDate');

    // Extract domain from link
    const link = getField('link');
    let domain;
    try {
      domain = new URL(link).hostname.replace('www.', '');
    } catch {
      // Fallback: some RSS feeds return relative URLs or empty links
      domain = source.toLowerCase().replace(/\s+/g, '') + '.com';
    }

    if (headline && description) {
      articles.push({ headline, description, source, domain, pubDate, url: link });
    }
  }

  return articles;
}

/** Strip HTML tags */
function stripHTML(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .trim();
}

/** Check if headline is poison (SEO spam, etc.) */
function isPoison(headline: string): boolean {
  return POISON_PATTERNS.some(p => p.test(headline));
}

// ── Sentiment Analysis ──────────────────────────────────────────────────

const BULLISH_KEYWORDS = [
  'surge', 'rally', 'breakthrough', 'bullish', 'adoption',
  'partnership', 'upgrade', 'ath', 'all-time high', 'soar',
  'moon', 'pump', 'explode', 'outperform', 'institutional',
];

const BEARISH_KEYWORDS = [
  'crash', 'dump', 'bearish', 'ban', 'scam', 'hack',
  'regulation', 'crackdown', 'plummet', 'plunge', 'collapse',
  'sell-off', 'liquidation', 'fud', 'fear',
];

type Sentiment = 'bullish' | 'bearish' | 'neutral';

/** Analyze headline + description for bullish/bearish sentiment keywords */
function analyzeSentiment(text: string): Sentiment {
  const lower = text.toLowerCase();
  let bullishScore = 0;
  let bearishScore = 0;

  for (const kw of BULLISH_KEYWORDS) {
    if (lower.includes(kw)) bullishScore++;
  }
  for (const kw of BEARISH_KEYWORDS) {
    if (lower.includes(kw)) bearishScore++;
  }

  if (bullishScore > bearishScore) return 'bullish';
  if (bearishScore > bullishScore) return 'bearish';
  return 'neutral';
}

/** Calculate recency bonus: +0.2 if article is within 6 hours */
function getRecencyBonus(pubDate: string): number {
  if (!pubDate) return 0;
  const published = new Date(pubDate).getTime();
  if (isNaN(published)) return 0;
  const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
  return published >= sixHoursAgo ? 0.2 : 0;
}

/** Calculate length penalty: -0.2 for very short (< 100 chars total) articles */
function getLengthPenalty(headline: string, description: string): number {
  return (headline.length + description.length) < 100 ? -0.2 : 0;
}

/** Compute a hash for a domain + headline pair for enhanced dedup */
function domainHeadlineHash(domain: string, headline: string): string {
  return `${domain}:${normalizeHeadline(headline)}`;
}

/** Match a headline + description against a token */
function matchToken(
  headline: string,
  description: string,
  token: TokenDef,
  sourceName?: string,
): number {
  const hl = headline.toLowerCase();
  const desc = description.toLowerCase();
  const name = token.name.toLowerCase();
  const sym = token.sym.toLowerCase();

  let relevance = 0;

  // Token name in headline (strongest signal)
  if (hl.includes(name)) {
    relevance = Math.max(relevance, 1.0);
  }

  // Ticker symbol in headline with crypto context
  if (hl.includes(sym) && (hl.includes('crypto') || hl.includes('token') || hl.includes('defi') || hl.includes('blockchain'))) {
    relevance = Math.max(relevance, 0.7);
  }

  // Token name in description
  if (desc.includes(name)) {
    relevance = Math.max(relevance, 0.7);
  }

  // Ticker symbol in headline (bare)
  if (hl.includes(sym)) {
    relevance = Math.max(relevance, 0.5);
  }

  // Ticker symbol in description
  if (desc.includes(` $${sym}`) || desc.includes(`$${sym}`)) {
    relevance = Math.max(relevance, 0.5);
  }

  // Boost by source tier
  const tierWeight = sourceName ? (SOURCE_TIERS[sourceName] ?? 0.8) : 0.8;
  relevance *= tierWeight;

  return relevance;
}

/** Normalize headline for dedup */
function normalizeHeadline(headline: string): string {
  return headline
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 80);
}

/**
 * Fetch, parse, match, and score news from all RSS feeds.
 *
 * Feeds are fetched concurrently (concurrency-4 batching). Returns matched news
 * items with relevance scores >= 0.5.
 *
 * @param runId Unique radar run identifier
 * @param tsUtc ISO UTC timestamp string
 * @returns Array of matched news items
 */
export async function fetchAndMatchNews(
  runId: string,
  tsUtc: string,
): Promise<NewsMatch[]> {
  const matches: NewsMatch[] = [];
  const seenHeadlines = new Set<string>();
  const seenDomainHashes = new Set<string>();
  const tokens = getTokenList();
  const CONCURRENCY = 4;

  // Pre-compute dead feeds to skip (avoid wasting HTTP calls)
  const deadFeeds = new Set(getDeadFeeds().map(f => f.name));

  /** Process a single feed's articles */
  async function processFeed(feed: FeedDef): Promise<NewsArticle[]> {
    // Skip dead feeds entirely — don't waste HTTP calls
    if (deadFeeds.has(feed.name)) {
      recordFeedResult(feed.name, feed.url, false, 'skipped — feed is dead');
      return [];
    }

    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

      const res = await fetch(feed.url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'Hermes-Crypto-Radar/1.0' },
      });

      if (!res.ok) {
        recordFeedResult(feed.name, feed.url, false, `HTTP ${res.status}`);
        return [];
      }

      const xml = await res.text();
      const parsed = parseRSS(xml, feed.name);

      recordFeedResult(feed.name, feed.url, true);
      return parsed;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      recordFeedResult(feed.name, feed.url, false, errMsg);
      return [];
    }
  }

  // Process feeds in batches with limited concurrency
  // Promise.allSettled ensures one failing feed doesn't block the batch
  for (let i = 0; i < NEWS_FEEDS.length; i += CONCURRENCY) {
    const batch = NEWS_FEEDS.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(feed => processFeed(feed)),
    );

    for (const s of settled) {
      if (s.status === 'fulfilled') {
        for (const article of s.value) {
          // Skip poison headlines
          if (isPoison(article.headline)) continue;

          // Enhanced dedup: headline normalization + domain+headline hash
          const norm = normalizeHeadline(article.headline);
          if (seenHeadlines.has(norm)) continue;
          seenHeadlines.add(norm);

          const domainKey = domainHeadlineHash(article.domain, article.headline);
          if (seenDomainHashes.has(domainKey)) continue;
          seenDomainHashes.add(domainKey);

          for (const token of tokens) {
            let relevance = matchToken(article.headline, article.description, token, article.source);
            if (relevance < 0.5) continue;

            // Sentiment boost: +0.1 if bullish keywords dominate
            const sentiment = analyzeSentiment(article.headline + ' ' + article.description);
            if (sentiment === 'bullish') relevance += 0.1;

            // Recency bonus: +0.2 if published within last 6 hours
            relevance += getRecencyBonus(article.pubDate);

            // Length penalty: -0.2 for very short articles (< 100 chars)
            relevance += getLengthPenalty(article.headline, article.description);

            matches.push({
              runId,
              tsUtc,
              symbol: token.sym,
              headline: article.headline,
              description: article.description.slice(0, 500),
              source: article.source,
              domain: article.domain,
              relevance: Math.round(Math.max(0, relevance) * 100) / 100,
              url: article.url,
            });
          }
        }
      }
      // Rejected branches are already handled inside processFeed — Promise.allSettled
      // catches only unexpected errors (shouldn't happen), so we just skip them
    }
  }

  return matches;
}
