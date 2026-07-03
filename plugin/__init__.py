"""
Hermes Crypto Radar plugin — Multi-chain crypto market tracking.

Registers 8 tools (scan, signals, news, tokens, chart, daemon, onchain, ws) that wrap
the TypeScript crypto-radar CLI. When the daemon is running on port 9877, scan/signals
calls route through the daemon's HTTP bridge for sub-50ms responses instead of spawning
a Node.js subprocess per call (~200ms).

Tools:
  🛰️  crypto_radar_scan     — Full market scan with technical indicators & signals
  🚀  crypto_radar_signals   — Composite trading signals from market data
  📰  crypto_radar_news      — Crypto news from 9 sources matched to tracked tokens
  📋  crypto_radar_tokens    — List all tracked tokens by chain
  📊  crypto_radar_chart     — Price charts (SVG, ASCII, EMA overlay, dashboard)
  ⚙️  crypto_radar_daemon    — Warm daemon lifecycle management (start/stop/status)
  ⛓️  crypto_radar_onchain   — On-chain metrics (protocol TVL, chain TVL, DEX fees)
  🔌  crypto_radar_ws        — WebSocket stream management for real-time prices

Installation:
  1. npm install && npm run build   (compile TypeScript)
  2. hermes plugins install /path/to/hermes-crypto-radar  (register in Hermes)

Or symlink: ln -s /path/to/hermes-crypto-radar ~/.hermes/plugins/crypto-radar
"""

from __future__ import annotations

import http.client
import json
import os
import shutil
import subprocess
from pathlib import Path

PLUGIN_DIR = Path(__file__).resolve().parent
DIST_CLI = PLUGIN_DIR / "dist" / "cli.js"
DAEMON_PORT = 9877

TOOL_EMOJI = {
    "crypto_radar_scan": "🛰️",
    "crypto_radar_signals": "🚀",
    "crypto_radar_news": "📰",
    "crypto_radar_tokens": "📋",
    "crypto_radar_chart": "📊",
    "crypto_radar_daemon": "⚙️",
    "crypto_radar_onchain": "⛓️",
    "crypto_radar_ws": "🔌",
}


def _check_available() -> bool:
    """Check if the TS CLI is compiled and available."""
    return DIST_CLI.is_file() and shutil.which("node") is not None


def _daemon_request(path: str) -> dict | None:
    """Try to get data from running daemon via HTTP. Returns None if unavailable."""
    conn = None
    try:
        conn = http.client.HTTPConnection("127.0.0.1", DAEMON_PORT, timeout=2)
        conn.request("GET", path)
        resp = conn.getresponse()
        if resp.status == 200:
            return json.loads(resp.read().decode())
        return None
    except (ConnectionRefusedError, OSError, TimeoutError):
        return None
    except json.JSONDecodeError:
        return None
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass


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
    # Try daemon first (fast path — sub-50ms)
    daemon_data = _daemon_request("/scan")
    if daemon_data and daemon_data.get("tickers"):
        tickers = daemon_data["tickers"]
        # Apply filters client-side from daemon cache
        if args.get("filter"):
            symbols_lower = {s.upper() for s in args["filter"]}
            tickers = [t for t in tickers if t.get("symbol", "").upper() in symbols_lower]
        chain = args.get("chain")
        if chain:
            tickers = [t for t in tickers if t.get("chain", "").lower() == chain.lower()]
        sort_by = args.get("sort_by", "momentum")
        result = {
            "success": True,
            "tickers": tickers,
            "signals": daemon_data.get("signals", []),
            "source": "daemon",
            "sorted_by": sort_by,
        }
        return json.dumps(result)

    # Fallback to subprocess
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
    # Try daemon first (fast path)
    daemon_data = _daemon_request("/scan")
    if daemon_data and daemon_data.get("signals"):
        signals = daemon_data["signals"]
        if args.get("filter"):
            symbols_lower = {s.upper() for s in args["filter"]}
            signals = [s for s in signals if s.get("symbol", "").upper() in symbols_lower]
        return json.dumps({"success": True, "signals": signals, "source": "daemon"})

    # Fallback to subprocess
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


def _check_daemon_running() -> bool:
    """Check if the warm daemon process is running."""
    daemon_health = _daemon_request("/health")
    if daemon_health:
        return True
    try:
        output = _run_cli("daemon", "--status")
        return "RUNNING" in output
    except Exception:
        return False


def _run_cli_raw(*args: str) -> str:
    """Run the CLI and return raw stdout (no JSON wrapping)."""
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


def _handle_chart(args: dict, **kw) -> str:
    """Generate price charts for a token.

    Supports SVG (rich vector chart), ASCII sparkline (terminal),
    MA overlay (EMA20/50), and multi-panel dashboard (price+RSI).
    """
    symbol = (args.get("symbol") or "").upper().strip()
    if not symbol:
        return json.dumps({"success": False, "error": "symbol is required"})

    chart_type = args.get("type", "svg")
    period = args.get("period", "1h")
    width = str(args.get("width", 600))

    cli_args = ["chart", symbol, "--type", chart_type, "--period", period, "--width", width]
    raw_output = _run_cli_raw(*cli_args)

    # Check if _run_cli_raw returned an error JSON
    try:
        parsed = json.loads(raw_output)
        if isinstance(parsed, dict) and parsed.get("success") is False:
            return raw_output
    except (json.JSONDecodeError, ValueError):
        pass

    # Wrap based on type
    if chart_type in ("svg", "dashboard"):
        return json.dumps({"success": True, "svg": raw_output})
    else:
        # sparkline or ma — ASCII chart text
        return json.dumps({"success": True, "chart": raw_output})


def _handle_daemon(args: dict, **kw) -> str:
    """Manage the warm daemon lifecycle — start, stop, or check status."""
    action = args.get("action", "status")

    if action == "status":
        # Try daemon health endpoint first (fast path)
        daemon_health = _daemon_request("/health")
        if daemon_health and daemon_health.get("status") == "ok":
            return json.dumps({"success": True, "running": True, "source": "daemon"})
        output = _run_cli("daemon", "--status")
        running = "RUNNING" in output
        return json.dumps({"success": True, "running": running})

    if action == "stop":
        output = _run_cli("daemon", "--stop")
        stopped = "stopped" in output.lower() or "Stopped" in output
        return json.dumps({"success": True, "stopped": stopped})

    if action == "start":
        if _check_daemon_running():
            return json.dumps({"success": True, "message": "Daemon is already running"})
        try:
            proc = subprocess.Popen(
                ["node", str(DIST_CLI), "daemon"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                cwd=str(PLUGIN_DIR),
            )
            return json.dumps({"success": True, "message": f"Daemon started (pid: {proc.pid})"})
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

    return json.dumps({"success": False, "error": f"Unknown action: {action}"})


def _handle_onchain(args: dict, **kw) -> str:
    """Fetch on-chain metrics for tracked tokens — protocol TVL, chain TVL, DEX fees."""
    cli_args = ["scan", "--onchain", "--no-news", "--no-tech", "--format", "json"]
    if args.get("filter"):
        cli_args.extend(["--filter", *args["filter"]])
    return _run_cli(*cli_args)


# WebSocket process state — tracks the background ws stream process
_WS_PROCESS: subprocess.Popen | None = None


def _handle_ws(args: dict, **kw) -> str:
    """Manage WebSocket data streams — start, stop, or check status.

    The WebSocket stream connects to Binance WS feeds for real-time price
    updates and feeds them to the daemon cache. Only one WS process is
    tracked per plugin session.
    """
    global _WS_PROCESS
    action = args.get("action", "status")

    if action == "status":
        if _WS_PROCESS is not None:
            poll = _WS_PROCESS.poll()
            if poll is None:
                return json.dumps({"success": True, "running": True, "pid": _WS_PROCESS.pid})
            else:
                # Process exited since last check
                _WS_PROCESS = None
                return json.dumps({"success": True, "running": False, "exited": poll})
        return json.dumps({"success": True, "running": False})

    if action == "start":
        if _WS_PROCESS is not None and _WS_PROCESS.poll() is None:
            return json.dumps({"success": True, "message": "WebSocket stream is already running"})
        try:
            _WS_PROCESS = subprocess.Popen(
                ["node", str(DIST_CLI), "ws", "--daemon-port", str(DAEMON_PORT)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                cwd=str(PLUGIN_DIR),
            )
            return json.dumps({"success": True, "message": f"WebSocket stream started (pid: {_WS_PROCESS.pid})"})
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

    if action == "stop":
        if _WS_PROCESS is not None:
            try:
                _WS_PROCESS.terminate()
                try:
                    _WS_PROCESS.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    _WS_PROCESS.kill()
                    _WS_PROCESS.wait(timeout=3)
                _WS_PROCESS = None
                return json.dumps({"success": True, "message": "WebSocket stream stopped"})
            except Exception as e:
                return json.dumps({"success": False, "error": str(e)})
        return json.dumps({"success": True, "message": "WebSocket stream is not running"})

    return json.dumps({"success": False, "error": f"Unknown action: {action}"})


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

CRYPTO_RADAR_CHART_SCHEMA = {
    "name": "crypto_radar_chart",
    "description": "📊 Generate price charts for a tracked token. Supports SVG (rich vector chart for sharing/embedding), ASCII terminal sparkline, EMA overlay with 20/50-period moving averages, and a multi-panel dashboard (price + RSI). For SVG/dashboard types, returns inline SVG markup the agent can render. For sparkline/ma types, returns ASCII chart text.",
    "parameters": {
        "type": "object",
        "properties": {
            "symbol": {
                "type": "string",
                "description": "Token symbol (e.g. SOL, BTC, ETH). Required.",
            },
            "type": {
                "type": "string",
                "enum": ["sparkline", "ma", "svg", "dashboard"],
                "description": "Chart type: sparkline (ASCII price), ma (ASCII with EMA20/50), svg (rich vector chart), dashboard (multi-panel with RSI)",
                "default": "svg",
            },
            "period": {
                "type": "string",
                "enum": ["15m", "1h", "4h", "1d"],
                "description": "Kline/candle interval",
                "default": "1h",
            },
            "width": {
                "type": "number",
                "description": "SVG chart width in pixels (svg/dashboard only)",
                "default": 600,
            },
        },
        "required": ["symbol"],
    },
}

CRYPTO_RADAR_DAEMON_SCHEMA = {
    "name": "crypto_radar_daemon",
    "description": "⚙️ Manage the Crypto Radar warm daemon — a persistent Node.js process that pre-fetches and caches market data for sub-50ms tool calls. Supports start, stop, and status actions. Use this to keep the radar hot between scans.",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["status", "start", "stop"],
                "description": "Action: status (check if running), start (launch daemon in background), stop (shutdown daemon)",
                "default": "status",
            },
        },
    },
}

CRYPTO_RADAR_ONCHAIN_SCHEMA = {
    "name": "crypto_radar_onchain",
    "description": "⛓️ Fetch on-chain metrics for tracked tokens — protocol TVL, chain TVL, DEX fees, and volume data. Uses DeFiLlama and other on-chain data sources via the crypto-radar CLI. Returns structured metrics for fundamental analysis.",
    "parameters": {
        "type": "object",
        "properties": {
            "filter": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Filter to specific token symbols (e.g. ['SOL', 'ETH'])",
            },
        },
    },
}

CRYPTO_RADAR_WS_SCHEMA = {
    "name": "crypto_radar_ws",
    "description": "🔌 Manage WebSocket data streams for real-time crypto price updates. Supports start, stop, and status actions. When active, streams live prices from Binance WebSocket and feeds them to the daemon cache for real-time awareness.",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["status", "start", "stop"],
                "description": "Action: status (check if running), start (launch WebSocket stream in background), stop (shutdown WebSocket stream)",
                "default": "status",
            },
        },
    },
}

_TOOLS = (
    ("crypto_radar_scan",    CRYPTO_RADAR_SCAN_SCHEMA,    _handle_scan,    "🛰️"),
    ("crypto_radar_signals", CRYPTO_RADAR_SIGNALS_SCHEMA, _handle_signals, "🚀"),
    ("crypto_radar_news",    CRYPTO_RADAR_NEWS_SCHEMA,    _handle_news,    "📰"),
    ("crypto_radar_tokens",  CRYPTO_RADAR_TOKENS_SCHEMA,  _handle_tokens,  "📋"),
    ("crypto_radar_chart",   CRYPTO_RADAR_CHART_SCHEMA,   _handle_chart,   "📊"),
    ("crypto_radar_daemon",  CRYPTO_RADAR_DAEMON_SCHEMA,  _handle_daemon,  "⚙️"),
    ("crypto_radar_onchain", CRYPTO_RADAR_ONCHAIN_SCHEMA, _handle_onchain, "⛓️"),
    ("crypto_radar_ws",      CRYPTO_RADAR_WS_SCHEMA,      _handle_ws,      "🔌"),
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
