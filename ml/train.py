#!/usr/bin/env python3
"""
Hermes Crypto Radar — Direction Classifier Training (CatBoost only)

Usage:
    python3 ml/train.py --data data/ml/dataset_train_*.csv --output ml/models/

Reads a CSV dataset produced by src/ml/dataset.ts, trains a CatBoost
classifier with early stopping and class weighting, and writes the model
(`.cbm` + `.joblib`) plus metrics + feature importance to the output directory.

Optional capabilities (off by default to preserve existing behavior):
    --optimize                          run Optuna hyperparameter search
    --optuna-trials N                   number of Optuna trials (default 25)
    --cv-folds N                        purgedcv walk-forward CV (0 = off)
    --balance                           BorderlineSMOTE on training data only
    --shap                              SHAP feature-importance analysis
    --add-ta                            append pandas-ta indicators to features

The JSON written to stdout is consumed by src/ml/predict.ts (model_path),
src/cli.ts and src/daemon.ts (model_path, accuracy). The contract fields
(model_path, accuracy, and the full metrics dict) must remain stable.

Exit codes:
    0 — success (or skipped gracefully)
    1 — fatal error (bad data, missing file, corrupt model)
"""

import argparse
import json
import logging
import math
import sys
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from catboost import CatBoostClassifier, Pool
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    roc_auc_score,
)

logger = logging.getLogger(__name__)


# ── Logging ────────────────────────────────────────────────────────────────


def setup_logging(verbose: bool = False) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] train: %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stderr,
    )


# ── CLI ────────────────────────────────────────────────────────────────────


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train direction classifier (CatBoost only)"
    )
    parser.add_argument("--data", required=True, help="Path to training CSV dataset")
    parser.add_argument(
        "--output", default="ml/models", help="Output directory for model + metrics"
    )
    parser.add_argument(
        "--val-split", type=float, default=0.15, help="Validation split fraction"
    )
    parser.add_argument(
        "--test-split", type=float, default=0.15, help="Test split fraction"
    )
    parser.add_argument(
        "--class-weight",
        type=str,
        default="balanced",
        choices=["balanced", "None", "custom"],
        help="Class weight strategy",
    )
    parser.add_argument(
        "--early-stopping",
        type=int,
        default=50,
        help="Early stopping rounds (0 = disable)",
    )
    parser.add_argument("--learning-rate", type=float, default=0.03)
    # Leaf-count CLI alias kept for compatibility; mapped to CatBoost depth.
    parser.add_argument("--num-leaves", type=int, default=31)
    parser.add_argument("--num-leaves", type=int, default=31)
    parser.add_argument("--num-leaves", type=int, default=31)
    parser.add_argument("--n-estimators", type=int, default=1000)
    parser.add_argument(
        "--gpu", action="store_true", help="Enable GPU training (auto-detects CUDA)"
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument(
        "--min-rows",
        type=int,
        default=100,
        help="Minimum rows required (exits gracefully below this)",
    )
    parser.add_argument("--verbose", action="store_true", help="Debug-level logging")

    # ── Optional model / training options ──
    parser.add_argument(
        "--optimize", action="store_true", help="Run Optuna hyperparameter search"
    )
    parser.add_argument(
        "--optuna-trials", type=int, default=25, help="Number of Optuna trials"
    )
    parser.add_argument(
        "--cv-folds",
        type=int,
        default=0,
        help="purgedcv walk-forward CV folds (0 = no CV)",
    )
    parser.add_argument(
        "--balance",
        action="store_true",
        help="Apply BorderlineSMOTE to training data only",
    )
    parser.add_argument(
        "--shap", action="store_true", help="Compute SHAP values on test set"
    )
    parser.add_argument(
        "--add-ta",
        action="store_true",
        help="Append pandas-ta indicators to feature set",
    )

    return parser.parse_args(argv)


# ── Helpers ────────────────────────────────────────────────────────────────


def _check_gpu() -> bool:
    """Return True if CatBoost GPU device is functional on this system."""
    try:
        probe = CatBoostClassifier(
            iterations=1,
            depth=2,
            learning_rate=0.1,
            task_type="GPU",
            verbose=False,
            random_seed=0,
        )
        rng = np.random.default_rng(0)
        probe.fit(
            rng.random((10, 2)),
            rng.integers(0, 2, 10),
        )
        return True
    except Exception:
        return False


def _resolve_class_weight(cli_value: str) -> str | None:
    """Map the CLI --class-weight string to the CatBoost auto_class_weights value.

    "balanced" -> "Balanced" (CatBoost built-in balanced weighting)
    "None"     -> None (no weighting)
    "custom"   -> None here; per-sample weights are applied via fit(sample_weight)
    """
    if cli_value == "None":
        return None
    if cli_value == "balanced":
        return "Balanced"
    # "custom" — handled through sample_weight in train(), not auto_class_weights
    return None


def _num_leaves_to_depth(num_leaves: int) -> int:
    """Map a leaf count to a CatBoost tree depth."""
    if num_leaves <= 1:
        return 6
    return max(2, int(round(math.log2(num_leaves))))


def _feature_correlation_filter(
    df: pd.DataFrame,
    feature_cols: list[str],
    threshold: float = 0.98,
) -> list[str]:
    """Drop highly-correlated features (> threshold) to reduce redundancy."""
    if threshold <= 0 or len(feature_cols) < 2:
        return feature_cols

    sub = pd.DataFrame(df[feature_cols])

    # Drop constant (zero-variance) features to avoid NaN correlations
    variances = sub.var()
    constant_cols = variances[variances == 0].index.tolist()
    if constant_cols:
        logger.info(
            "Removing %d constant features: %s", len(constant_cols), constant_cols
        )
        feature_cols = [c for c in feature_cols if c not in constant_cols]
        if len(feature_cols) < 2:
            return feature_cols
        sub = pd.DataFrame(df[feature_cols])

    corr: pd.DataFrame = sub.corr()
    upper = corr.where(np.triu(np.ones(corr.shape), k=1).astype(bool))
    to_drop = {col for col in upper.columns if (upper[col] > threshold).any()}
    if to_drop:
        logger.info(
            "Dropping %d highly-correlated features (>%.2f): %s",
            len(to_drop),
            threshold,
            sorted(to_drop),
        )
    return [c for c in feature_cols if c not in to_drop]


def _derive_cadence(open_time: pd.Series) -> pd.Timedelta:
    """Derive the data cadence (median spacing) from open_time values (ms epoch)."""
    ts = pd.to_datetime(open_time, unit="ms")
    diffs = ts.diff().dropna()
    if len(diffs) == 0:
        return pd.Timedelta(days=1)
    median = diffs.median()
    if median is None or pd.isna(median) or median == pd.Timedelta(0):
        return pd.Timedelta(days=1)
    return median


def _add_ta_features(df: pd.DataFrame, feature_cols: list[str]) -> list[str]:
    """Append pandas-ta indicators for OHLC-like columns; return extended feature_cols."""
    try:
        import pandas_ta_classic as ta  # type: ignore
    except Exception as e:
        logger.error("pandas-ta requested (--add-ta) but not installed: %s", e)
        print(json.dumps({"error": f"pandas-ta not available: {e}"}))
        sys.exit(1)

    # Identify OHLC-like columns by name (case-insensitive substring match)
    ohlc_keys = ("open", "high", "low", "close", "volume")
    ta_cols: list[str] = []
    for base in feature_cols:
        low = base.lower()
        if not any(k in low for k in ohlc_keys):
            continue
        series = df[base]
        # RSI
        try:
            rsi = ta.rsi(series, length=14)
            name = f"{base}_rsi_14"
            df[name] = rsi
            ta_cols.append(name)
        except Exception as e:  # pragma: no cover - defensive per-indicator
            logger.warning("TA RSI failed for %s: %s", base, e)
        # MACD (returns a DataFrame of MACD, MACD_H, MACD_S, or None)
        try:
            macd = ta.macd(series, fast=12, slow=26, signal=9)
            if macd is not None:
                for col in macd.columns:
                    name = f"{base}_{col}"
                    df[name] = macd[col]
                    ta_cols.append(name)
        except Exception as e:  # pragma: no cover
            logger.warning("TA MACD failed for %s: %s", base, e)
        # Bollinger Bands
        try:
            bb = ta.bbands(series, length=20, std=2)
            if bb is not None:
                for col in bb.columns:
                    name = f"{base}_{col}"
                    df[name] = bb[col]
                    ta_cols.append(name)
        except Exception as e:  # pragma: no cover
            logger.warning("TA BBANDS failed for %s: %s", base, e)
    logger.info("Added %d pandas-ta indicator columns", len(ta_cols))
    return feature_cols + [c for c in ta_cols if c not in feature_cols]


def _build_catboost(args: argparse.Namespace, params: dict | None = None):
    """Build and return a configured CatBoost classifier.

    `params` (optional) overrides learning_rate / depth / l2_leaf_reg — used by
    the Optuna objective to inject trial-suggested values.

    CLI mapping:
      --learning-rate -> learning_rate (CatBoost native)
      --num-leaves    -> depth via int(round(log2(num_leaves)))
      --n-estimators  -> iterations
    """
    lr = args.learning_rate
    depth = _num_leaves_to_depth(args.num_leaves)
    l2 = 3

    if params:
        lr = params.get("learning_rate", lr)
        depth = params.get("depth", depth)
        l2 = params.get("l2_leaf_reg", l2)

    auto_class_weights = _resolve_class_weight(args.class_weight)

    task_type = "CPU"
    if args.gpu:
        if _check_gpu():
            task_type = "GPU"
            logger.info("GPU training enabled")
        else:
            logger.warning(
                "GPU training requested but not available — falling back to CPU"
            )

    return CatBoostClassifier(
        iterations=args.n_estimators,
        learning_rate=lr,
        depth=depth,
        l2_leaf_reg=l2,
        nan_mode="Min",  # CatBoost handles NaN natively
        auto_class_weights=auto_class_weights,
        random_seed=args.seed,
        early_stopping_rounds=args.early_stopping if args.early_stopping > 0 else None,
        task_type=task_type,
        verbose=args.verbose,
    )


def _feature_importance(model, feature_cols: list[str]) -> dict:
    """Return {feature: importance} dict for the trained CatBoost model."""
    try:
        imp = model.get_feature_importance(prettified=True)
        # prettified=True returns a DataFrame with 'Feature Id'/'Feature Name'/'Importances'
        if hasattr(imp, "columns"):
            val_col = "Importances" if "Importances" in imp.columns else imp.columns[-1]
            if "Feature Name" in imp.columns:
                return {
                    str(r["Feature Name"]): float(r[val_col]) for _, r in imp.iterrows()
                }
            # 'Feature Id' is a 0-based positional index into feature_cols
            return {
                str(feature_cols[int(r["Feature Id"])]): float(r[val_col])
                for _, r in imp.iterrows()
            }
        return dict(zip(feature_cols, [float(v) for v in imp]))
    except Exception as e:
        logger.warning("CatBoost feature importance failed: %s", e)
        return {}


# ── Main ───────────────────────────────────────────────────────────────────


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
    required_cols = {"open_time", "label_class"}
    missing = required_cols - set(df.columns)
    if missing:
        logger.error("Missing required columns: %s", missing)
        print(json.dumps({"error": f"Missing columns: {list(missing)}"}))
        sys.exit(1)

    logger.info("Loaded %d rows, %d columns", len(df), len(df.columns))

    # ── Sort chronologically (critical for time-series split) ──
    df = df.sort_values("open_time").reset_index(drop=True)

    # ── Identify feature columns ──
    exclude_cols = {"symbol", "interval", "open_time", "label_class"}
    feature_cols = [
        c
        for c in df.columns
        if c not in exclude_cols and pd.api.types.is_numeric_dtype(df[c])
    ]
    logger.info("Using %d base feature columns", len(feature_cols))

    if len(feature_cols) == 0:
        logger.error("No numeric feature columns found after exclusions")
        print(json.dumps({"error": "No numeric feature columns"}))
        sys.exit(1)

    # ── Optional: pandas-ta feature engineering ──
    if args.add_ta:
        feature_cols = _add_ta_features(df, feature_cols)

    # ── Minimum row guard ──
    n = len(df)
    if n < args.min_rows:
        logger.warning("Insufficient rows (%d < min %d) — skipping", n, args.min_rows)
        print(
            json.dumps(
                {"status": "skipped", "reason": f"Only {n} rows, need ≥{args.min_rows}"}
            )
        )
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
        logger.error(
            "Split produced an empty partition (total rows=%d, val_idx=%d, test_idx=%d)",
            n,
            val_idx,
            test_idx,
        )
        print(
            json.dumps(
                {
                    "error": "Empty train/val/test partition — too few rows for split fractions"
                }
            )
        )
        sys.exit(1)

    X_train = train_df[feature_cols].to_numpy(dtype=np.float64)
    y_train = train_df["label_class"].to_numpy(dtype=np.int64)
    X_val = val_df[feature_cols].to_numpy(dtype=np.float64)
    y_val = val_df["label_class"].to_numpy(dtype=np.int64)
    X_test = test_df[feature_cols].to_numpy(dtype=np.float64)
    y_test = test_df["label_class"].to_numpy(dtype=np.int64)

    logger.info("Train: %d  Val: %d  Test: %d", len(X_train), len(X_val), len(X_test))

    # ── Class distribution ──
    classes, counts = np.unique(y_train, return_counts=True)
    class_dist = dict(zip(classes.astype(str), counts.tolist()))
    logger.info("Class distribution (train): %s", class_dist)

    if len(classes) < 2:
        logger.warning(
            "Only %d class(es) present — training would be degenerate; skipping",
            len(classes),
        )
        print(
            json.dumps(
                {
                    "status": "skipped",
                    "reason": f"Only {len(classes)} class(es) in training data",
                }
            )
        )
        return

    # ── Optional: BorderlineSMOTE (training data ONLY) ──
    if args.balance:
        try:
            from imblearn.over_sampling import BorderlineSMOTE

            smote = BorderlineSMOTE(random_state=args.seed)
            X_res, y_res = smote.fit_resample(X_train, y_train)[:2]
            X_train, y_train = X_res[: X_train.shape[0]], y_res[: y_train.shape[0]]
            # ^ unpack safely: fit_resample may return 2 or 3 values per its type stub
            logger.info(
                "BorderlineSMOTE applied: train resampled to %d rows", len(X_train)
            )
        except Exception as e:
            logger.warning(
                "BorderlineSMOTE failed — proceeding without balancing: %s", e
            )

    # ── Custom class weights (computed AFTER balancing) ──
    if args.class_weight == "custom":
        class_weight_map = {-1: 1.5, 0: 0.6, 1: 1.0}
        y_train_int = np.asarray(y_train, dtype=int).ravel()
        sample_weight = np.array(
            [class_weight_map.get(y, 1.0) for y in y_train_int], dtype=np.float64
        )
    else:
        sample_weight = None

    # ── Optional: Optuna hyperparameter optimization ──
    best_params: dict | None = None
    if args.optimize:
        best_params = _run_optuna(args, X_train, y_train, X_val, y_val)
        logger.info("Optuna best params: %s", best_params)

    # ── Build + train model ──
    model = _build_catboost(args, params=best_params)
    fit_kwargs: dict = {}
    if sample_weight is not None:
        fit_kwargs["sample_weight"] = sample_weight
    model.fit(X_train, y_train, eval_set=(X_val, y_val), **fit_kwargs)

    # ── Optional: purgedcv walk-forward CV ──
    cv_scores: list[float] = []
    cv_mean: float | None = None
    cv_std: float | None = None
    if args.cv_folds > 0:
        cv_scores, cv_mean, cv_std = _run_purged_cv(args, feature_cols)

    # ── Evaluate on test set ──
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)

    if model.classes_ is None:
        n_classes = 0
    else:
        n_classes = len(model.classes_)

    # Feature importance
    importance = _feature_importance(model, feature_cols)
    top_features = sorted(importance.items(), key=lambda x: -x[1])[:10]
    logger.info("Top 10 features by importance: %s", top_features)

    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred).tolist()
    logger.info("Confusion matrix:\n%s", np.array(cm))

    # Per-class metrics
    class_report = classification_report(
        y_test, y_pred, output_dict=True, zero_division=0
    )

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
        "model_type": "catboost",
        "cv_scores": cv_scores,
        "cv_mean": cv_mean,
        "cv_std": cv_std,
        "best_params": best_params,
    }

    # AUC — binary and multi-class variants
    if n_classes >= 2:
        try:
            if n_classes == 2:
                # Binary: use positive-class (index 1) probabilities
                metrics["auc"] = float(roc_auc_score(y_test, y_proba[:, 1]))
            else:
                metrics["auc_ovr"] = float(
                    roc_auc_score(y_test, y_proba, multi_class="ovr")
                )
                metrics["auc_ovo"] = float(
                    roc_auc_score(y_test, y_proba, multi_class="ovo")
                )
        except Exception as e:
            logger.warning(
                "AUC computation failed (may be expected with few samples): %s", e
            )

    logger.info(
        "Accuracy=%.4f  F1_weighted=%.4f", metrics["accuracy"], metrics["f1_weighted"]
    )

    # ── Optional: SHAP analysis ──
    shap_path: str | None = None
    if args.shap:
        shap_path = _run_shap(args, model, X_test, feature_cols, output_dir)
        metrics["shap_path"] = shap_path

    # ── Save model (.cbm + .joblib) ──
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    model_path_cbm = output_dir / f"model_{timestamp}.cbm"
    model_path_joblib = output_dir / f"model_{timestamp}.joblib"
    try:
        model.save_model(str(model_path_cbm))
        joblib.dump(model, str(model_path_joblib))
    except Exception as e:
        logger.error("Failed to save model: %s", e)
        print(json.dumps({"error": f"Model save failed: {e}"}))
        sys.exit(1)
    # Primary model_path is the .cbm (predict.py auto-detects by extension)
    model_path = model_path_cbm
    logger.info("Model saved: %s (and %s)", model_path_cbm, model_path_joblib)

    metrics["model_path"] = str(model_path)

    # ── Save metrics ──
    metrics_path = output_dir / f"metrics_{timestamp}.json"
    try:
        with open(metrics_path, "w") as f:
            json.dump(metrics, f, indent=2, default=str)
    except Exception as e:
        logger.warning("Failed to save metrics JSON: %s", e)

    metrics["metrics_path"] = str(metrics_path)
    logger.info("Metrics saved: %s", metrics_path)

    # Emit JSON to stdout for programmatic consumers (daemon.ts / CLI)
    print(json.dumps(metrics, indent=2, default=str))


# ── Optuna ─────────────────────────────────────────────────────────────────


def _run_optuna(args, X_train, y_train, X_val, y_val) -> dict:
    """Run Optuna hyperparameter search; return best trial params dict."""
    import optuna
    from optuna.pruners import HyperbandPruner
    from optuna.samplers import TPESampler

    storage = f"sqlite:///{args.output}/optuna_study.db"
    study = optuna.create_study(
        direction="maximize",
        sampler=TPESampler(n_startup_trials=10, seed=args.seed),
        pruner=HyperbandPruner(min_resource=1, max_resource=100, reduction_factor=3),
        storage=storage,
        load_if_exists=True,
    )

    def objective(trial):
        params = {
            "learning_rate": trial.suggest_float("learning_rate", 0.005, 0.1, log=True),
            "depth": trial.suggest_int("depth", 4, 10),
            "l2_leaf_reg": trial.suggest_int("l2_leaf_reg", 1, 10),
        }
        model = CatBoostClassifier(
            iterations=300,  # smaller for speed during search
            learning_rate=params["learning_rate"],
            depth=params["depth"],
            l2_leaf_reg=params["l2_leaf_reg"],
            nan_mode="Min",
            random_seed=args.seed,
            early_stopping_rounds=20,
            verbose=False,
        )
        model.fit(X_train, y_train, eval_set=(X_val, y_val))
        pred = model.predict(X_val)
        return float(f1_score(y_val, pred, average="weighted"))

    study.optimize(objective, n_trials=args.optuna_trials)
    best = study.best_trial
    return {
        "learning_rate": float(best.params["learning_rate"]),
        "depth": int(best.params["depth"]),
        "l2_leaf_reg": int(best.params["l2_leaf_reg"]),
    }


# ── purgedcv walk-forward CV ───────────────────────────────────────────────


def _run_purged_cv(
    args, feature_cols
) -> tuple[list[float], float | None, float | None]:
    """Run purgedcv WalkForwardSplit CV; return (scores, mean, std).

    Re-derives the raw chronological train partition from the CSV so that
    temporal order is preserved (SMOTE resampling in train() would break it).
    """
    from purgedcv import WalkForwardSplit

    data_path = Path(args.data)
    df = pd.read_csv(str(data_path))
    df = df.sort_values("open_time").reset_index(drop=True)
    exclude_cols = {"symbol", "interval", "open_time", "label_class"}
    feat = [
        c
        for c in df.columns
        if c not in exclude_cols and pd.api.types.is_numeric_dtype(df[c])
    ]
    if args.add_ta:
        feat = _add_ta_features(df, feat)
    feat = _feature_correlation_filter(df, feat, threshold=0.98)
    n = len(df)
    val_idx = int(n * (1 - args.test_split - args.val_split))
    train_df = df.iloc[:val_idx]

    X = train_df[feat].to_numpy(dtype=np.float64)
    y = train_df["label_class"].to_numpy(dtype=np.int64)

    cadence = _derive_cadence(train_df["open_time"])
    prediction_times = pd.to_datetime(train_df["open_time"], unit="ms")
    evaluation_times = prediction_times + cadence

    # purge_horizon / embargo derived from cadence: purge ~ a few bars,
    # embargo ~ 1 bar. Use multiples of the cadence.
    purge_horizon = cadence * 5
    embargo = cadence * 2
    test_size = max(1, int(len(X) * 0.15))

    splitter = WalkForwardSplit(
        n_splits=args.cv_folds,
        test_size=test_size,
        window="expanding",
        prediction_times=prediction_times,
        evaluation_times=evaluation_times,
        purge_horizon=purge_horizon,
        embargo=embargo,
    )

    scores: list[float] = []
    for train_idx, test_idx_cv in splitter.split(X):
        X_tr, X_te = X[train_idx], X[test_idx_cv]
        y_tr, y_te = y[train_idx], y[test_idx_cv]
        if len(np.unique(y_tr)) < 2 or len(X_te) == 0:
            continue
        m = CatBoostClassifier(
            iterations=300,
            learning_rate=args.learning_rate,
            depth=_num_leaves_to_depth(args.num_leaves),
            l2_leaf_reg=3,
            nan_mode="Min",
            random_seed=args.seed,
            verbose=False,
        )
        m.fit(X_tr, y_tr)
        pred = m.predict(X_te)
        scores.append(float(f1_score(y_te, pred, average="weighted")))

    if scores:
        arr = np.array(scores)
        return scores, float(arr.mean()), float(arr.std())
    return [], None, None


# ── SHAP ───────────────────────────────────────────────────────────────────


def _run_shap(args, model, X_test, feature_cols, output_dir) -> str:
    """Compute SHAP mean|SHAP| per feature; save JSON; return path."""
    import shap

    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_test)

    # shap.TreeExplainer on a CatBoost multiclass model returns a single 3D
    # ndarray of shape (n_samples, n_features, n_classes). On a binary
    # model it returns a 2D ndarray (n_samples, n_features) or, in some
    # shap versions, a list of per-class 2D arrays. Normalize to a
    # (n_samples, n_features) matrix of per-class-aggregated SHAP values.
    sv = np.array(shap_values, dtype=np.float64)
    if sv.ndim == 3:
        # multiclass: mean absolute SHAP across classes -> (n_samples, n_features)
        sv = np.mean(np.abs(sv), axis=2)
    elif isinstance(shap_values, list):
        if len(shap_values) == 2:
            sv = np.array(shap_values[1], dtype=np.float64)
        else:
            sv = np.mean([np.array(a, dtype=np.float64) for a in shap_values], axis=0)
    # sv is now (n_samples, n_features); collapse samples via mean|SHAP|
    mean_abs = np.abs(sv).mean(axis=0)

    if len(mean_abs) != len(feature_cols):
        # Fall back to whatever length we have
        cols = feature_cols[: len(mean_abs)]
    else:
        cols = feature_cols

    fi_shap = {str(cols[i]): float(mean_abs[i]) for i in range(len(cols))}
    top = sorted(fi_shap.items(), key=lambda x: -x[1])
    expected = None
    try:
        ev = explainer.expected_value
        if isinstance(ev, (list, np.ndarray)):
            expected = float(ev[1]) if len(ev) == 2 else float(ev[0])
        else:
            expected = float(ev)
    except Exception:
        expected = None

    out = {
        "feature_importance_shap": fi_shap,
        "top_features": [{"feature": f, "importance": v} for f, v in top[:10]],
        "expected_value": expected,
    }
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    shap_path = output_dir / f"shap_{timestamp}.json"
    try:
        with open(shap_path, "w") as f:
            json.dump(out, f, indent=2, default=str)
        logger.info("SHAP values saved: %s", shap_path)
    except Exception as e:
        logger.warning("Failed to save SHAP JSON: %s", e)
        return None  # type: ignore
    return str(shap_path)


if __name__ == "__main__":
    args = parse_args()
    train(args)
