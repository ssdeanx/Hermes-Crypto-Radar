#!/usr/bin/env python3
"""
Hermes Crypto Radar — LightGBM Direction Classifier Training

Usage:
    python3 ml/train.py --data data/ml/dataset_train_*.csv --output ml/models/

Reads a CSV dataset produced by src/ml/dataset.ts, trains a LightGBM
classifier with early stopping and class weighting (F7), and writes
model + metrics + feature importance to the output directory.

Exit codes:
    0 — success (or skipped gracefully)
    1 — fatal error (bad data, missing file, corrupt model)
"""

import argparse
import json
import logging
import sys
from datetime import datetime
from pathlib import Path

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    roc_auc_score,
)

logger = logging.getLogger(__name__)


# ── Logging ──


def setup_logging(verbose: bool = False) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] train: %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stderr,
    )


# ── CLI ──


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train LightGBM direction classifier")
    parser.add_argument("--data", required=True, help="Path to training CSV dataset")
    parser.add_argument("--output", default="ml/models", help="Output directory for model + metrics")
    parser.add_argument("--val-split", type=float, default=0.15, help="Validation split fraction")
    parser.add_argument("--test-split", type=float, default=0.15, help="Test split fraction")
    parser.add_argument(
        "--class-weight",
        type=str,
        default="balanced",
        choices=["balanced", "None", "custom"],
        help="Class weight strategy",
    )
    parser.add_argument("--early-stopping", type=int, default=50, help="Early stopping rounds (0 = disable)")
    parser.add_argument("--learning-rate", type=float, default=0.03)
    parser.add_argument("--num-leaves", type=int, default=31)
    parser.add_argument("--n-estimators", type=int, default=1000)
    parser.add_argument("--gpu", action="store_true", help="Enable GPU training (auto-detects CUDA)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--min-rows", type=int, default=100, help="Minimum rows required (exits gracefully below this)")
    parser.add_argument("--verbose", action="store_true", help="Debug-level logging")
    return parser.parse_args(argv)


# ── Helpers ──


def _check_gpu() -> bool:
    """Return True if LightGBM GPU device is functional on this system."""
    try:
        params = {"device": "gpu", "num_leaves": 2, "n_estimators": 1, "verbose": -1}
        probe = lgb.LGBMClassifier(**params)
        probe.fit(np.random.default_rng(0).random((10, 2)), np.random.default_rng(0).integers(0, 2, 10))
        return True
    except Exception:
        return False


def _resolve_class_weight(cli_value: str) -> str | None:
    """Map the CLI --class-weight string to the LightGBM parameter type."""
    if cli_value == "None":
        return None  # no weighting
    # "balanced" and "custom" both use LightGBM balanced (custom overrides via sample_weight)
    return "balanced"


def _compute_median(arr: np.ndarray) -> float:
    """Compute median of a numpy array."""
    return float(np.median(arr))


def _feature_correlation_filter(
    df: pd.DataFrame,
    feature_cols: list[str],
    threshold: float = 0.98,
) -> list[str]:
    """Identify and log highly-correlated feature pairs; return filtered column list."""
    if threshold <= 0 or len(feature_cols) < 2:
        return feature_cols

    corr = df[feature_cols].corr().abs()
    upper = corr.where(np.triu(np.ones(corr.shape), k=1).astype(bool))
    to_drop = {col for col in upper.columns if any(upper[col] > threshold)}
    if to_drop:
        logger.info("Dropping %d highly-correlated features (>%.2f): %s", len(to_drop), threshold, sorted(to_drop))
    return [c for c in feature_cols if c not in to_drop]


# ── Main ──


def train(args: argparse.Namespace) -> None:
    setup_logging(args.verbose)

    # ── Input validation ──
    data_path = Path(args.data)
    if not data_path.exists():
        logger.error("Dataset file not found: %s", data_path)
        print(json.dumps({"error": f"File not found: {data_path}"}))
        sys.exit(1)

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    # ── Read dataset ──
    try:
        df = pd.read_csv(str(data_path))
    except Exception as e:
        logger.error("Failed to read CSV: %s", e)
        print(json.dumps({"error": f"CSV read error: {e}"}))
        sys.exit(1)

    if df.empty:
        logger.warning("CSV is empty — skipping training")
        print(json.dumps({"status": "skipped", "reason": "Empty dataset"}))
        return

    # ── Validate required columns ──
    required_cols = {"open_time", "label_class_5"}
    missing = required_cols - set(df.columns)
    if missing:
        logger.error("Missing required columns: %s", missing)
        print(json.dumps({"error": f"Missing columns: {list(missing)}"}))
        sys.exit(1)

    logger.info("Loaded %d rows, %d columns", len(df), len(df.columns))

    # ── Sort chronologically (critical for time-series split) ──
    df = df.sort_values("open_time").reset_index(drop=True)

    # ── Identify feature columns ──
    exclude_cols = {"symbol", "interval", "open_time", "label_class_5"}
    feature_cols = [
        c for c in df.columns if c not in exclude_cols and pd.api.types.is_numeric_dtype(df[c])
    ]
    logger.info("Using %d feature columns", len(feature_cols))

    if len(feature_cols) == 0:
        logger.error("No numeric feature columns found after exclusions")
        print(json.dumps({"error": "No numeric feature columns"}))
        sys.exit(1)

    # ── Minimum row guard ──
    n = len(df)
    if n < args.min_rows:
        logger.warning("Insufficient rows (%d < min %d) — skipping", n, args.min_rows)
        print(json.dumps({"status": "skipped", "reason": f"Only {n} rows, need ≥{args.min_rows}"}))
        return

    # ── Feature correlation filter (optional) ──
    feature_cols = _feature_correlation_filter(df, feature_cols, threshold=0.98)

    # ── Chronological split ──
    val_idx = int(n * (1 - args.test_split - args.val_split))
    test_idx = int(n * (1 - args.test_split))

    train_df = df.iloc[:val_idx]
    val_df = df.iloc[val_idx:test_idx]
    test_df = df.iloc[test_idx:]

    if len(train_df) == 0 or len(val_df) == 0 or len(test_df) == 0:
        logger.error("Split produced an empty partition (total rows=%d, val_idx=%d, test_idx=%d)", n, val_idx, test_idx)
        print(json.dumps({"error": "Empty train/val/test partition — too few rows for split fractions"}))
        sys.exit(1)

    X_train = train_df[feature_cols].to_numpy(dtype=np.float64)
    y_train = train_df["label_class_5"].to_numpy(dtype=np.int64)
    X_val = val_df[feature_cols].to_numpy(dtype=np.float64)
    y_val = val_df["label_class_5"].to_numpy(dtype=np.int64)
    X_test = test_df[feature_cols].to_numpy(dtype=np.float64)
    y_test = test_df["label_class_5"].to_numpy(dtype=np.int64)

    logger.info("Train: %d  Val: %d  Test: %d", len(X_train), len(X_val), len(X_test))

    # ── Class distribution ──
    classes, counts = np.unique(y_train, return_counts=True)
    class_dist = dict(zip(classes.astype(str), counts.tolist()))
    logger.info("Class distribution (train): %s", class_dist)

    if len(classes) < 2:
        logger.warning("Only %d class(es) present — training would be degenerate; skipping", len(classes))
        print(json.dumps({"status": "skipped", "reason": f"Only {len(classes)} class(es) in training data"}))
        return

    # ── GPU detection ──
    use_gpu = args.gpu and _check_gpu()
    if args.gpu and not use_gpu:
        logger.warning("GPU training requested but not available — falling back to CPU")
    if use_gpu:
        logger.info("GPU training enabled")

    # ── F7: Custom class weights ──
    if args.class_weight == "custom":
        class_weight_map = {-1: 1.5, 0: 0.6, 1: 1.0}
        sample_weight = np.array([class_weight_map.get(int(y), 1.0) for y in y_train], dtype=np.float64)
    else:
        sample_weight = None

    # ── Build model ──
    model = lgb.LGBMClassifier(
        n_estimators=args.n_estimators,
        learning_rate=args.learning_rate,
        num_leaves=args.num_leaves,
        class_weight=_resolve_class_weight(args.class_weight),
        random_state=args.seed,
        verbose=-1,
        device="gpu" if use_gpu else "cpu",
    )

    eval_set = [(X_val, y_val)]
    fit_kwargs: dict = {
        "eval_set": eval_set,
        "eval_metric": "multi_logloss",
    }

    # ⚠️ FIX: lightgbm >= 4.0 removed `early_stopping_rounds` from the
    # constructor. Must pass as a callback to fit() instead.
    if args.early_stopping > 0:
        fit_kwargs["callbacks"] = [lgb.early_stopping(args.early_stopping, verbose=False)]

    if sample_weight is not None:
        fit_kwargs["sample_weight"] = sample_weight

    # ── Train ──
    try:
        model.fit(X_train, y_train, **fit_kwargs)
    except Exception as e:
        logger.error("Training failed: %s", e)
        print(json.dumps({"error": f"Training failed: {e}"}))
        sys.exit(1)

    # ── Evaluate on test set ──
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)

    n_classes = len(model.classes_)

    # Feature importance (gain-based)
    importance = dict(zip(feature_cols, model.feature_importances_.tolist()))
    top_features = sorted(importance.items(), key=lambda x: -x[1])[:10]
    logger.info("Top 10 features by importance: %s", top_features)

    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred).tolist()
    logger.info("Confusion matrix:\n%s", np.array(cm))

    # Per-class metrics
    class_report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)

    metrics: dict = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "f1_weighted": float(f1_score(y_test, y_pred, average="weighted")),
        "f1_macro": float(f1_score(y_test, y_pred, average="macro")),
        "test_samples": int(len(y_test)),
        "features": len(feature_cols),
        "class_distribution_train": class_dist,
        "n_classes": n_classes,
        "feature_importance": importance,
        "confusion_matrix": cm,
        "classification_report": class_report,
    }

    # AUC — binary and multi-class variants
    if n_classes >= 2:
        try:
            if n_classes == 2:
                # Binary: use positive-class (index 1) probabilities
                metrics["auc"] = float(roc_auc_score(y_test, y_proba[:, 1]))
            else:
                metrics["auc_ovr"] = float(roc_auc_score(y_test, y_proba, multi_class="ovr"))
                metrics["auc_ovo"] = float(roc_auc_score(y_test, y_proba, multi_class="ovo"))
        except Exception as e:
            logger.warning("AUC computation failed (may be expected with few samples): %s", e)

    logger.info("Accuracy=%.4f  F1_weighted=%.4f", metrics["accuracy"], metrics["f1_weighted"])

    # ── Save model ──
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    model_path = output_dir / f"model_{timestamp}.joblib"
    try:
        joblib.dump(model, str(model_path))
    except Exception as e:
        logger.error("Failed to save model: %s", e)
        print(json.dumps({"error": f"Model save failed: {e}"}))
        sys.exit(1)

    metrics["model_path"] = str(model_path)
    logger.info("Model saved: %s", model_path)

    # ── Save metrics ──
    metrics_path = output_dir / f"metrics_{timestamp}.json"
    try:
        with open(metrics_path, "w") as f:
            json.dump(metrics, f, indent=2, default=str)
    except Exception as e:
        logger.warning("Failed to save metrics JSON: %s", e)

    logger.info("Metrics saved: %s", metrics_path)

    # Emit JSON to stdout for programmatic consumers (daemon.ts / CLI)
    print(json.dumps(metrics, indent=2, default=str))


if __name__ == "__main__":
    args = parse_args()
    train(args)
