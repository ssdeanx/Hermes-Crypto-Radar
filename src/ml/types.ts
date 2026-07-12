// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — ML Type Definitions
// ═══════════════════════════════════════════════════════════════════════

import type { KlineInterval } from '../types.js';

/** A single feature row — one row per (symbol, interval, open_time) */
export interface FeatureRow {
  symbol: string;
  interval: string;
  open_time: number;
  [featureName: string]: unknown;
}

/** Forward-return label row */
export interface LabelRow {
  symbol: string;
  interval: string;
  open_time: number;
  label_return_1: number | null;
  label_return_5: number | null;
  label_return_20: number | null;
  label_return_60: number | null;
  label_direction_1: -1 | 0 | 1 | null;
  label_direction_5: -1 | 0 | 1 | null;
  label_direction_20: -1 | 0 | 1 | null;
  label_direction_60: -1 | 0 | 1 | null;
/** Tri-class label at the configured horizon */
  label_class: -1 | 0 | 1 | null;
}

/** ML pipeline configuration */
export interface MLConfig {
  enabled: boolean;
  training: {
    symbols?: string[];
    intervals?: KlineInterval[];
    lookbackDays: number;
    labelHorizon: 1 | 5 | 20 | 60;
    retrainIntervalHours: number;
  };
  prediction: {
    inferenceMode: 'subprocess' | 'onnx';
    minConfidence: number;
    modelPath?: string;
  };
}

/** Model prediction result for a single symbol/interval */
export interface PredictionResult {
  symbol: string;
  open_time: number;
  direction: -1 | 0 | 1;
  confidence: number;
  probs?: number[];
  horizon: number;
  modelId: string;
}

/** Normalization statistics computed during dataset assembly */
export interface NormalizationStats {
  means: Record<string, number>;
  stds: Record<string, number>;
  medians: Record<string, number>;
  featureNames: string[];
  rowCount: number;
}

/** Dataset assembly result */
export interface DatasetResult {
  trainPath: string;
  valPath: string;
  testPath: string;
  featureCount: number;
  rowCount: number;
  /** Number of rows dropped due to NaN/Infinity features during assembly */
  droppedCount: number;
  normalizationStats: NormalizationStats;
}

/** Options for dataset assembly */
export interface DatasetOpts {
  symbols?: string[];
  intervals?: KlineInterval[];
  fromTime?: number;
  toTime?: number;
  labelHorizon: 1 | 5 | 20 | 60;
  testSplit?: number;
  valSplit?: number;
  normalize?: boolean;
  excludeFeatures?: string[];
  outputPathPrefix?: string;
}

/** Options for building features */
export interface FeatureOpts {
  includeReturns?: boolean;
  includeIndicators?: boolean;
  includeCrossAsset?: boolean;
  includeFutures?: boolean;
  includeTemporal?: boolean;
}
