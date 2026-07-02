// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Crypto News Fetcher
// ═══════════════════════════════════════════════════════════════════════

import type { NewsArticle, NewsMatch, TokenDef } from './types.js';
import { getTokenList } from './tokens.js';

interface FeedDef {
  name: string;
  url: string;
  tier: 1 | 2 | 3 | 4;
}

const NEWS_FEEDS: FeedDef[] = [
  { name: 'CoinTelegraph', url: 'https://cointelegraph.com/rss',          tier: 1 },
  { name: 'CoinDesk',      url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', tier: 1 },
  { name: 'Decrypt',       url: 'https://decrypt.co/feed',                tier: 1 },
  { name: 'The Defiant',   url: 'https://thedefiant.io/feed/',            tier: 1 },
  { name: 'Blockworks',    url: 'https://blockworks.co/feed/',            tier: 2 },
  { name: 'CryptoSlate',   url: 'https://cryptoslate.com/feed/',          tier: 2 },
  { name: 'CoinStats',     url: 'https://coinstats.app/blog/feed/',       tier: 3 },
  { name: 'DeFi Saver',    url: 'https://blog.defisaver.com/rss/',         tier: 3 },
  { name: 'NullTX',        url: 'https://nulltx.com/feed/',               tier: 4 },
];

const SOURCE_TIERS: Record<string, number> = {
  'CoinTelegraph': 1.0,
  'CoinDesk':      1.0,
  'Decrypt':       1.0,
  'The Defiant':   1.0,
  'Blockworks':    0.9,
  'CryptoSlate':   0.8,
  'DeFi Saver':    0.7,
  'CoinStats':     0.6,
  'NullTX':        0.4,
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
    let domain = '';
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
 * Returns matched news items with relevance scores ≥ 0.5.
 */
export async function fetchAndMatchNews(
  runId: string,
  tsUtc: string,
): Promise<NewsMatch[]> {
  const matches: NewsMatch[] = [];
  const seenHeadlines = new Set<string>();
  const tokens = getTokenList();

  for (const feed of NEWS_FEEDS) {
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

      const res = await fetch(feed.url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'Hermes-Crypto-Radar/1.0' },
      });

      if (!res.ok) continue;

      const xml = await res.text();
      const articles = parseRSS(xml, feed.name);

      for (const article of articles) {
        // Skip poison headlines
        if (isPoison(article.headline)) continue;

        // Skip duplicates (cross-feed or same-run)
        const norm = normalizeHeadline(article.headline);
        if (seenHeadlines.has(norm)) continue;
        seenHeadlines.add(norm);

        for (const token of tokens) {
          const relevance = matchToken(article.headline, article.description, token, feed.name);
          if (relevance < 0.5) continue;

          matches.push({
            runId,
            tsUtc,
            symbol: token.sym,
            headline: article.headline,
            description: article.description.slice(0, 500),
            source: article.source,
            domain: article.domain,
            relevance: Math.round(relevance * 100) / 100,
            url: article.url,
          });
        }
      }
    } catch {
      // Silently skip failed feeds
      continue;
    }
  }

  return matches;
}
