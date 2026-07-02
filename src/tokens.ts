// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Token Registry
// ═══════════════════════════════════════════════════════════════════════

import type { TokenDef, Chain } from './types.js';

/**
 * Master token registry.
 *
 * Keyed by CoinGecko ID (canonical). `sym` is the Binance trading symbol
 * (without USDT suffix). `chain` is the primary trading chain; `multi`
 * tokens have a `chains` array for actual chains.
 */
const TOKENS: Record<string, TokenDef> = {
  // ── Polygon / DeFi ──
  'polygon-ecosystem-token':   { id: 'polygon-ecosystem-token',   sym: 'POL',   name: 'Polygon (ex-MATIC)',  chain: 'polygon' },
  'sushi':                     { id: 'sushi',                     sym: 'SUSHI', name: 'SushiSwap',            chain: 'polygon' },
  'uniswap':                   { id: 'uniswap',                   sym: 'UNI',   name: 'Uniswap',              chain: 'polygon' },
  'aave':                      { id: 'aave',                      sym: 'AAVE',  name: 'Aave',                 chain: 'polygon' },
  'curve-dao-token':           { id: 'curve-dao-token',           sym: 'CRV',   name: 'Curve DAO',            chain: 'polygon' },
  'chainlink':                 { id: 'chainlink',                 sym: 'LINK',  name: 'Chainlink',            chain: 'polygon' },
  'quick':                     { id: 'quick',                     sym: 'QUICK', name: 'Quickswap',            chain: 'polygon' },
  'balancer':                  { id: 'balancer',                  sym: 'BAL',   name: 'Balancer',             chain: 'polygon' },
  'lido-dao':                  { id: 'lido-dao',                  sym: 'LDO',   name: 'Lido DAO',             chain: 'polygon' },
  'basic-attention-token':     { id: 'basic-attention-token',     sym: 'BAT',   name: 'Basic Attention Token', chain: 'polygon' },
  'compound-governance-token': { id: 'compound-governance-token', sym: 'COMP',  name: 'Compound',             chain: 'polygon' },
  'layerzero':                 { id: 'layerzero',                 sym: 'ZRO',   name: 'LayerZero',            chain: 'polygon' },
  'the-graph':                 { id: 'the-graph',                 sym: 'GRT',   name: 'The Graph',            chain: 'polygon' },

  // ── Solana Ecosystem ──
  'solana':     { id: 'solana',     sym: 'SOL',    name: 'Solana',       chain: 'solana' },
  'jupiter':    { id: 'jupiter',    sym: 'JUP',    name: 'Jupiter',      chain: 'solana' },
  'jito':       { id: 'jito',       sym: 'JTO',    name: 'Jito',         chain: 'solana' },
  'raydium':    { id: 'raydium',    sym: 'RAY',    name: 'Raydium',      chain: 'solana' },
  'pyth-network': { id: 'pyth-network', sym: 'PYTH', name: 'Pyth Network', chain: 'solana' },
  'bonk':       { id: 'bonk',       sym: 'BONK',   name: 'Bonk',         chain: 'solana' },
  'kamino':     { id: 'kamino',     sym: 'KMNO',   name: 'Kamino',       chain: 'solana' },
  'pump-fun':   { id: 'pump-fun',   sym: 'PUMP',   name: 'Pump.fun',     chain: 'solana' },
  'render-token': { id: 'render-token', sym: 'RENDER', name: 'Render',   chain: 'solana' },
  'orca':       { id: 'orca',       sym: 'ORCA',   name: 'Orca',         chain: 'solana' },
  'bonfida':    { id: 'bonfida',    sym: 'FIDA',   name: 'Bonfida',      chain: 'solana' },
  'dogwifcoin': { id: 'dogwifcoin', sym: 'WIF',    name: 'dogwifcoin',   chain: 'solana' },
  'book-of-meme': { id: 'book-of-meme', sym: 'BOME', name: 'Book of Meme', chain: 'solana' },
  'audius':     { id: 'audius',     sym: 'AUDIO',  name: 'Audius',       chain: 'solana' },

  // ── Multi-chain (broad market) ──
  'binancecoin': { id: 'binancecoin', sym: 'BNB',  name: 'Binance Coin', chain: 'multi', chains: ['bnb'] },
  'bitcoin':     { id: 'bitcoin',     sym: 'BTC',  name: 'Bitcoin',      chain: 'multi', chains: ['bitcoin'] },
  'ethereum':    { id: 'ethereum',    sym: 'ETH',  name: 'Ethereum',     chain: 'multi', chains: ['ethereum'] },
  'dogecoin':    { id: 'dogecoin',    sym: 'DOGE', name: 'Dogecoin',     chain: 'multi', chains: ['dogecoin'] },
  'xrp':         { id: 'xrp',         sym: 'XRP',  name: 'XRP',          chain: 'multi', chains: ['xrp'] },
  'cardano':     { id: 'cardano',     sym: 'ADA',  name: 'Cardano',      chain: 'multi', chains: ['cardano'] },
};

/** All token IDs */
export function getTokenIds(): string[] {
  return Object.keys(TOKENS);
}

/** All tokens as an array */
export function getTokenList(): TokenDef[] {
  return Object.values(TOKENS);
}

/** Lookup a token by ID */
export function getTokenById(id: string): TokenDef | undefined {
  return TOKENS[id];
}

/** Lookup a token by Binance trading symbol */
export function getTokenBySymbol(sym: string): TokenDef | undefined {
  const key = sym.toUpperCase();
  return Object.values(TOKENS).find(t => t.sym === key);
}

/** Filter tokens by chain */
export function getTokensByChain(chain: Chain | undefined): TokenDef[] {
  if (!chain || chain === 'multi') return getTokenList();
  return Object.values(TOKENS).filter(t => {
    if (t.chain === chain) return true;
    if (t.chain === 'multi' && t.chains?.includes(chain)) return true;
    return false;
  });
}

/** Get Binance USDT pair for a token */
export function getBinancePair(token: TokenDef): string {
  return `${token.sym}USDT`;
}

export type { TokenDef } from './types.js';
