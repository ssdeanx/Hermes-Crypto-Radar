// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Cross-Token Correlation Engine
// ═══════════════════════════════════════════════════════════════════════
//
// Computes Pearson correlation coefficients between token price movements.
// Uses daily returns from kline close prices.
//
// This helps users:
//   - Diversify portfolios (avoid correlated assets)
//   - Identify sector rotations (SOL up, BTC down = capital rotation)
//   - Find hedge pairs (BTC vs ETH correlation spikes)

export interface CorrelationMatrix {
  symbols: string[];
  /** N×N matrix of Pearson R values (-1 to 1) */
  matrix: number[][];
  /** Number of periods used for computation */
  periods: number;
  timestamp: string;
}

export interface CorrelationPair {
  symbolA: string;
  symbolB: string;
  correlation: number; // -1 to 1
}

/**
 * Compute the Pearson correlation coefficient between two arrays.
 *
 * Formula: r = (n*Σxy - Σx*Σy) / sqrt((n*Σx² - (Σx)²)*(n*Σy² - (Σy)²))
 *
 * Returns 0 if:
 *   - Fewer than 10 data points
 *   - Either array has zero variance (constant values)
 *   - Any NaN/Infinity result from edge cases
 *
 * @param x  First price series (returns)
 * @param y  Second price series (returns)
 * @returns Pearson R between -1 and 1, or 0 on edge cases
 */
function pearsonR(x: number[], y: number[]): number {
  if (x.length < 10 || y.length < 10 || x.length !== y.length) return 0;

  const n = x.length;

  // Compute sums
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const xi = x[i]!;
    const yi = y[i]!;
    sumX += xi;
    sumY += yi;
    sumXY += xi * yi;
    sumX2 += xi * xi;
    sumY2 += yi * yi;
  }

  // Numerator: n*Σxy - Σx*Σy
  const numerator = n * sumXY - sumX * sumY;

  // Denominator: sqrt((n*Σx² - (Σx)²)*(n*Σy² - (Σy)²))
  const denomX = n * sumX2 - sumX * sumX;
  const denomY = n * sumY2 - sumY * sumY;

  // Zero variance check — if either series is constant, correlation is 0
  if (denomX <= 0 || denomY <= 0) return 0;

  const denominator = Math.sqrt(denomX * denomY);

  // Guard against division by near-zero
  if (denominator < 1e-10) return 0;

  const r = numerator / denominator;

  // Clamp to [-1, 1] to handle floating-point edge cases
  if (!isFinite(r)) return 0;
  return Math.max(-1, Math.min(1, r));
}

/**
 * Convert price levels to period-over-period returns.
 *
 * Returns are computed as: r_i = (price_i - price_{i-1}) / price_{i-1}
 * This makes series comparable regardless of absolute price levels.
 *
 * @param prices  Array of close prices
 * @returns Array of returns (one less than input length)
 */
function toReturns(prices: number[]): number[] {
  if (prices.length < 2) return [];
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1]!;
    if (prev === 0) {
      returns.push(0);
    } else {
      returns.push((prices[i]! - prev) / prev);
    }
  }
  return returns;
}

/**
 * Compute Pearson correlation matrix from multiple price series.
 *
 * Takes a map of symbol → array of close prices (all arrays must have
 * the same length). Returns a symmetrical N×N matrix where
 * matrix[i][j] = correlation between symbol[i] and symbol[j].
 *
 * The diagonal (self-correlation) is always 1.0.
 *
 * @param priceMap  Map of symbol → array of close prices (same length)
 * @returns CorrelationMatrix with symbols and N×N matrix
 */
export function computeCorrelationMatrix(
  priceMap: Map<string, number[]>,
): CorrelationMatrix {
  const symbols = Array.from(priceMap.keys());
  const n = symbols.length;

  // Pre-compute returns for each symbol
  const returnsMap = new Map<string, number[]>();
  let periods = 0;

  for (const [symbol, prices] of priceMap) {
    const returns = toReturns(prices);
    returnsMap.set(symbol, returns);
    if (returns.length > periods) {
      periods = returns.length;
    }
  }

  // Build the N×N correlation matrix
  const matrix: number[][] = [];

  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    const symI = symbols[i]!;
    const returnsI = returnsMap.get(symI) ?? [];

    for (let j = 0; j < n; j++) {
      if (i === j) {
        // Self-correlation is always 1.0
        row.push(1.0);
      } else if (j < i) {
        // Mirror from already-computed (matrix is symmetric)
        row.push(matrix[j]![i]!);
      } else {
        const symJ = symbols[j]!;
        const returnsJ = returnsMap.get(symJ) ?? [];

        // Align to shortest series length
        const minLen = Math.min(returnsI.length, returnsJ.length);
        if (minLen < 10) {
          row.push(0);
        } else {
          const alignedI = returnsI.slice(-minLen);
          const alignedJ = returnsJ.slice(-minLen);
          row.push(pearsonR(alignedI, alignedJ));
        }
      }
    }
    matrix.push(row);
  }

  // Round all values to 4 decimal places for readability
  const roundedMatrix = matrix.map(row =>
    row.map(v => Math.round(v * 10000) / 10000),
  );

  return {
    symbols,
    matrix: roundedMatrix,
    periods,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Find top N strongest correlations for a given symbol.
 *
 * Returns pairs sorted by absolute correlation strength (descending),
 * excluding the symbol's self-correlation. Both positive and negative
 * correlations are ranked by their absolute value.
 *
 * @param symbol  The symbol to find correlations for
 * @param matrix  Correlation matrix from computeCorrelationMatrix()
 * @param n       Number of results (default: 5)
 * @returns Array of correlation pairs, sorted by absolute strength
 */
export function findTopCorrelations(
  symbol: string,
  matrix: CorrelationMatrix,
  n: number = 5,
): CorrelationPair[] {
  const idx = matrix.symbols.indexOf(symbol);
  if (idx === -1) return [];

  const pairs: CorrelationPair[] = [];

  for (let j = 0; j < matrix.symbols.length; j++) {
    if (j === idx) continue;
    pairs.push({
      symbolA: symbol,
      symbolB: matrix.symbols[j]!,
      correlation: matrix.matrix[idx]![j]!,
    });
  }

  // Sort by absolute correlation strength descending
  pairs.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

  return pairs.slice(0, n);
}

/**
 * Helper: compute daily returns from close prices (convenience wrapper
 * around toReturns).
 *
 * @param prices  Array of close prices
 * @returns Array of daily returns
 */
export function priceReturns(prices: number[]): number[] {
  return toReturns(prices);
}

/**
 * Format correlation matrix as a terminal table.
 *
 * Shows a grid of symbols vs symbols with correlation values.
 * Strong positive correlations (≥0.7) are marked with a '+'
 * Strong negative correlations (≤-0.7) are marked with a '-'
 *
 * @param matrix  CorrelationMatrix from computeCorrelationMatrix()
 * @returns Formatted table string ready for terminal display
 */
export function formatCorrelationTable(matrix: CorrelationMatrix): string {
  if (matrix.symbols.length === 0) return 'No correlation data.';

  const header = matrix.symbols;
  const colWidth = 8; // Fixed-width columns for readability
  const labelWidth = 6;

  // Build header row
  const lines: string[] = [];

  // Top header line with padded symbols
  const headerParts: string[] = [''.padEnd(labelWidth)];
  for (const sym of header) {
    headerParts.push(sym.padStart(colWidth));
  }
  lines.push(headerParts.join(' '));

  // Separator
  const sepParts: string[] = [''.padEnd(labelWidth, '─')];
  for (let i = 0; i < header.length; i++) {
    sepParts.push(''.padEnd(colWidth, '─'));
  }
  lines.push(sepParts.join('─'));

  // Data rows
  for (let i = 0; i < matrix.symbols.length; i++) {
    const rowParts: string[] = [matrix.symbols[i]!.padEnd(labelWidth)];
    const row = matrix.matrix[i]!;
    for (let j = 0; j < row.length; j++) {
      const val = row[j]!;
      let formatted: string;
      if (i === j) {
        formatted = '  1.00'; // diagonal highlight
      } else if (val >= 0.7) {
        formatted = `+${val.toFixed(2)}`; // strong positive
      } else if (val <= -0.7) {
        formatted = `${val.toFixed(2)}`;  // strong negative (sign already there)
      } else if (val >= 0) {
        formatted = ` ${val.toFixed(2)}`;
      } else {
        formatted = `${val.toFixed(2)}`;
      }
      rowParts.push(formatted.padStart(colWidth));
    }
    lines.push(rowParts.join(' '));
  }

  // Legend
  lines.push('');
  lines.push(`Periods: ${matrix.periods} returns  |  +0.70 = strong positive  |  -0.70 = strong negative`);
  lines.push(`Timestamp: ${matrix.timestamp}`);

  return lines.join('\n');
}
