"""
Hermes Crypto Radar plugin — Multi-chain crypto market tracking.

Registers 4 tools (scan, signals, news, tokens) that wrap the TypeScript
crypto-radar CLI. When the agent calls a tool, the handler spawns the
compiled TypeScript binary via subprocess and returns structured output.

Installation:
  1. npm install && npm run build   (compile TypeScript)
  2. hermes plugins install /path/to/hermes-crypto-radar  (register in Hermes)

Or symlink: ln -s /path/to/hermes-crypto-radar ~/.hermes/plugins/crypto-radar
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

PLUGIN_DIR = Path(__file__).resolve().parent
DIST_CLI = PLUGIN_DIR / "dist" / "cli.js"

TOOL_EMOJI = {
    "crypto_radar_scan": "🛰️",
    "crypto_radar_signals": "🚀",
    "crypto_radar_news": "📰",
    "crypto_radar_tokens": "📋",
}


def _check_available() -> bool:
    """Check if the TS CLI is compiled and available."""
    return DIST_CLI.is_file() and shutil.which("node") is not None


def _run_cli(*args: str) -> str:
    """Run the crypto-radar CLI and return JSON output."""
    cmd = ["node", str(DIST_CLI), *args]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60,
            cwd=str(PLUGIN_DIR),
        )
        if result.returncode != 0:
            error_msg = result.stderr.strip() or result.stdout.strip() or "unknown error"
            return json.dumps({"success": False, "error": error_msg})
        return result.stdout
    except subprocess.TimeoutExpired:
        return json.dumps({"success": False, "error": "CLI timed out after 60s"})
    except FileNotFoundError:
        return json.dumps({"success": False, "error": "node or cli.js not found. Run 'npm install && npm run build' first."})
    except Exception as e:
        return json.dumps({"success": False, "error": str(e)})


def _handle_scan(args: dict, **kw) -> str:
    """Run a full radar scan with optional filters."""
    cli_args = ["scan", "--format", "json"]

    if args.get("filter"):
        cli_args.extend(["--filter", *args["filter"]])

    chain = args.get("chain")
    if chain:
        cli_args.extend(["--chain", chain])

    sort_by = args.get("sort_by") or "momentum"
    cli_args.extend(["--sort", sort_by])

    if args.get("no_tech"):
        cli_args.append("--no-tech")
    if args.get("no_news"):
        cli_args.append("--no-news")
    if args.get("no_log"):
        cli_args.append("--no-log")

    return _run_cli(*cli_args)


def _handle_signals(args: dict, **kw) -> str:
    """Generate composite signals from latest data."""
    cli_args = ["signals", "--format", "json"]

    if args.get("filter"):
        cli_args.extend(["--filter", *args["filter"]])

    return _run_cli(*cli_args)


def _handle_news(args: dict, **kw) -> str:
    """Fetch and display crypto news matching tracked tokens."""
    cli_args = ["news", "--format", "json"]

    if args.get("filter"):
        cli_args.extend(["--filter", *args["filter"]])

    return _run_cli(*cli_args)


def _handle_tokens(args: dict, **kw) -> str:
    """List all tracked tokens with their details."""
    cli_args = ["tokens"]

    if args.get("chain"):
        cli_args.extend(["--chain", args["chain"]])

    return _run_cli(*cli_args)


# ── Tool schemas — auto-registered by the plugin loader ──

CRYPTO_RADAR_SCAN_SCHEMA = {
    "name": "crypto_radar_scan",
    "description": "🛰️ Run a full crypto market radar scan. Fetches live prices from Binance for 30+ tokens, computes technical indicators (RSI, MACD, BB, ATR), matches crypto news, and generates composite signals. Returns JSON with enriched tickers.",
    "parameters": {
        "type": "object",
        "properties": {
            "filter": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Filter to specific token symbols (e.g. ['SOL', 'BTC', 'ETH'])",
            },
            "chain": {
                "type": "string",
                "enum": ["solana", "polygon", "bnb", "xrp", "ethereum", "bitcoin", "dogecoin", "cardano"],
                "description": "Filter to a specific blockchain chain",
            },
            "sort_by": {
                "type": "string",
                "enum": ["alpha", "change", "volume", "momentum"],
                "description": "Sort results (default: momentum)",
            },
            "no_tech": {
                "type": "boolean",
                "description": "Skip technical indicator computation (faster)",
            },
            "no_news": {
                "type": "boolean",
                "description": "Skip news fetching (faster)",
            },
            "no_log": {
                "type": "boolean",
                "description": "Skip logging results to CSV",
            },
        },
    },
}

CRYPTO_RADAR_SIGNALS_SCHEMA = {
    "name": "crypto_radar_signals",
    "description": "🚀 Generate composite trading signals from the latest market data. Scores tokens on momentum, technicals, and news. Returns ranked signals with alerts for overbought/oversold, high volume, and price movements.",
    "parameters": {
        "type": "object",
        "properties": {
            "filter": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Filter to specific token symbols",
            },
        },
    },
}

CRYPTO_RADAR_NEWS_SCHEMA = {
    "name": "crypto_radar_news",
    "description": "📰 Fetch and display crypto news matching tracked tokens from 9 sources. Scores articles by relevance (headline match, description match, source tier). Returns matched news items with relevance scores.",
    "parameters": {
        "type": "object",
        "properties": {
            "filter": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Filter to specific token symbols",
            },
        },
    },
}

CRYPTO_RADAR_TOKENS_SCHEMA = {
    "name": "crypto_radar_tokens",
    "description": "📋 List all tokens tracked by the Crypto Radar with their symbol, name, and chain. Optionally filter by chain.",
    "parameters": {
        "type": "object",
        "properties": {
            "chain": {
                "type": "string",
                "enum": ["solana", "polygon", "bnb", "xrp", "ethereum", "bitcoin", "dogecoin", "cardano"],
                "description": "Filter to a specific chain",
            },
        },
    },
}

_TOOLS = (
    ("crypto_radar_scan",    CRYPTO_RADAR_SCAN_SCHEMA,    _handle_scan,    "🛰️"),
    ("crypto_radar_signals", CRYPTO_RADAR_SIGNALS_SCHEMA, _handle_signals, "🚀"),
    ("crypto_radar_news",    CRYPTO_RADAR_NEWS_SCHEMA,    _handle_news,    "📰"),
    ("crypto_radar_tokens",  CRYPTO_RADAR_TOKENS_SCHEMA,  _handle_tokens,  "📋"),
)


def register(ctx) -> None:
    """Register all crypto-radar tools. Called once by the plugin loader."""
    for name, schema, handler, emoji in _TOOLS:
        ctx.register_tool(
            name=name,
            toolset="crypto",
            schema=schema,
            handler=handler,
            check_fn=_check_available,
            emoji=emoji,
        )
