// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Token Registry
// ═══════════════════════════════════════════════════════════════════════

import type { TokenDef, Chain } from './types.js';
import { loadConfig } from './core/config.js';

/**
 * Master token registry.
 *
 * Keyed by CoinGecko ID (canonical). `sym` is the Binance trading symbol
 * (without USDT suffix). `chain` is the primary trading chain; `multi`
 * tokens have a `chains` array for actual chains.
 */
const TOKENS: Record<string, TokenDef> = {
  // ── Polygon / DeFi ──
  'polygon-ecosystem-token':   { id: 'polygon-ecosystem-token',   sym: 'POL',   name: 'Polygon (ex-MATIC)',  chain: 'polygon', coingeckoId: 'polygon-ecosystem-token' },
  'sushi':                     { id: 'sushi',                     sym: 'SUSHI', name: 'SushiSwap',            chain: 'polygon', coingeckoId: 'sushi' },
  'uniswap':                   { id: 'uniswap',                   sym: 'UNI',   name: 'Uniswap',              chain: 'polygon', coingeckoId: 'uniswap' },
  'aave':                      { id: 'aave',                      sym: 'AAVE',  name: 'Aave',                 chain: 'polygon', coingeckoId: 'aave' },
  'curve-dao-token':           { id: 'curve-dao-token',           sym: 'CRV',   name: 'Curve DAO',            chain: 'polygon', coingeckoId: 'curve-dao-token' },
  'chainlink':                 { id: 'chainlink',                 sym: 'LINK',  name: 'Chainlink',            chain: 'polygon', coingeckoId: 'chainlink' },
  'quick':                     { id: 'quick',                     sym: 'QUICK', name: 'Quickswap',            chain: 'polygon', coingeckoId: 'quick' },
  'balancer':                  { id: 'balancer',                  sym: 'BAL',   name: 'Balancer',             chain: 'polygon', coingeckoId: 'balancer' },
  'lido-dao':                  { id: 'lido-dao',                  sym: 'LDO',   name: 'Lido DAO',             chain: 'polygon', coingeckoId: 'lido-dao' },
  'basic-attention-token':     { id: 'basic-attention-token',     sym: 'BAT',   name: 'Basic Attention Token', chain: 'polygon', coingeckoId: 'basic-attention-token' },
  'compound-governance-token': { id: 'compound-governance-token', sym: 'COMP',  name: 'Compound',             chain: 'polygon', coingeckoId: 'compound-governance-token' },
  'layerzero':                 { id: 'layerzero',                 sym: 'ZRO',   name: 'LayerZero',            chain: 'polygon', coingeckoId: 'layerzero' },
  'the-graph':                 { id: 'the-graph',                 sym: 'GRT',   name: 'The Graph',            chain: 'polygon', coingeckoId: 'the-graph' },

  // ── Solana Ecosystem ──
  'solana':     { id: 'solana',     sym: 'SOL',    name: 'Solana',       chain: 'solana', coingeckoId: 'solana' },
  'jupiter':    { id: 'jupiter',    sym: 'JUP',    name: 'Jupiter',      chain: 'solana', coingeckoId: 'jupiter' },
  'jito':       { id: 'jito',       sym: 'JTO',    name: 'Jito',         chain: 'solana', coingeckoId: 'jito' },
  'raydium':    { id: 'raydium',    sym: 'RAY',    name: 'Raydium',      chain: 'solana', coingeckoId: 'raydium' },
  'pyth-network': { id: 'pyth-network', sym: 'PYTH', name: 'Pyth Network', chain: 'solana', coingeckoId: 'pyth-network' },
  'bonk':       { id: 'bonk',       sym: 'BONK',   name: 'Bonk',         chain: 'solana', coingeckoId: 'bonk' },
  'kamino':     { id: 'kamino',     sym: 'KMNO',   name: 'Kamino',       chain: 'solana', coingeckoId: 'kamino' },
  'pump-fun':   { id: 'pump-fun',   sym: 'PUMP',   name: 'Pump.fun',     chain: 'solana', coingeckoId: 'pump-fun' },
  'render-token': { id: 'render-token', sym: 'RENDER', name: 'Render',   chain: 'solana', coingeckoId: 'render-token' },
  'orca':       { id: 'orca',       sym: 'ORCA',   name: 'Orca',         chain: 'solana', coingeckoId: 'orca' },
  'bonfida':    { id: 'bonfida',    sym: 'FIDA',   name: 'Bonfida',      chain: 'solana', coingeckoId: 'bonfida' },
  'dogwifcoin': { id: 'dogwifcoin', sym: 'WIF',    name: 'dogwifcoin',   chain: 'solana', coingeckoId: 'dogwifcoin' },
  'book-of-meme': { id: 'book-of-meme', sym: 'BOME', name: 'Book of Meme', chain: 'solana', coingeckoId: 'book-of-meme' },
  'audius':     { id: 'audius',     sym: 'AUDIO',  name: 'Audius',       chain: 'solana', coingeckoId: 'audius' },

  // ── Multi-chain (broad market) ──
  'binancecoin': { id: 'binancecoin', sym: 'BNB',  name: 'Binance Coin', chain: 'multi', chains: ['bnb'],      coingeckoId: 'binancecoin' },
  'bitcoin':     { id: 'bitcoin',     sym: 'BTC',  name: 'Bitcoin',      chain: 'multi', chains: ['bitcoin'],  coingeckoId: 'bitcoin' },
  'ethereum':    { id: 'ethereum',    sym: 'ETH',  name: 'Ethereum',     chain: 'multi', chains: ['ethereum'], coingeckoId: 'ethereum' },
  'dogecoin':    { id: 'dogecoin',    sym: 'DOGE', name: 'Dogecoin',     chain: 'multi', chains: ['dogecoin'], coingeckoId: 'dogecoin' },
  'xrp':         { id: 'xrp',         sym: 'XRP',  name: 'XRP',          chain: 'multi', chains: ['xrp'],      coingeckoId: 'ripple' },
  'cardano':     { id: 'cardano',     sym: 'ADA',  name: 'Cardano',      chain: 'multi', chains: ['cardano'],  coingeckoId: 'cardano' },

  // ── Layer-1 & Cross-chain (Phase C) ──
  'sui':                 { id: 'sui',                 sym: 'SUI',  name: 'Sui',            chain: 'multi', chains: ['sui'],        coingeckoId: 'sui' },
  'aptos':               { id: 'aptos',               sym: 'APT',  name: 'Aptos',          chain: 'multi', chains: ['aptos'],      coingeckoId: 'aptos' },
  'sei-network':         { id: 'sei-network',         sym: 'SEI',  name: 'Sei',            chain: 'multi', chains: ['sei'],        coingeckoId: 'sei-network' },
  'celestia':            { id: 'celestia',            sym: 'TIA',  name: 'Celestia',       chain: 'multi', chains: ['celestia'],   coingeckoId: 'celestia' },
  'injective-protocol':  { id: 'injective-protocol',  sym: 'INJ',  name: 'Injective',      chain: 'multi', chains: ['injective'],  coingeckoId: 'injective-protocol' },
  'thorchain':           { id: 'thorchain',           sym: 'RUNE', name: 'THORChain',      chain: 'multi', chains: ['thorchain'],  coingeckoId: 'thorchain' },
  'cosmos':              { id: 'cosmos',              sym: 'ATOM', name: 'Cosmos',         chain: 'multi', chains: ['cosmos'],     coingeckoId: 'cosmos' },
};

/** All token IDs */
export function getTokenIds(): string[] {
  return Object.keys(TOKENS);
}

/** All tokens as an array, optionally filtered by config token whitelist */
export function getTokenList(): TokenDef[] {
  const all = Object.values(TOKENS);
  try {
    const config = loadConfig();
    if (config.tokens && config.tokens.length > 0) {
      return all.filter(t => config.tokens!.includes(t.id));
    }
  } catch {
    // If config hasn't been loaded yet, return unfiltered
  }
  return all;
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
