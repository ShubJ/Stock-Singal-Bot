#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Seed historical data via Claude Code
# Fetches recent price data for NIFTY 50 stocks and creates initial entries
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SIGNALS_DIR="${SIGNALS_OUTPUT_DIR:-$PROJECT_ROOT/data/signals}"
CLAUDE_CMD="${CLAUDE_PATH:-claude}"
MAX_RETRIES=3

mkdir -p "$SIGNALS_DIR"

echo "[$(date)] Seeding historical data..."

SEED_PROMPT='Search the web for the latest closing prices of these NIFTY 50 stocks:
RELIANCE, TCS, HDFCBANK, INFY, ICICIBANK, HINDUNILVR, ITC, SBIN, BHARTIARTL, KOTAKBANK,
LT, AXISBANK, BAJFINANCE, ASIANPAINT, MARUTI, SUNPHARMA, TATAMOTORS, WIPRO, TITAN, ULTRACEMCO

For each stock, get the last 5 trading days of OHLCV data.

Your ENTIRE response must be ONLY a valid JSON object — no text before or after, no markdown fences.
Start your response with { and end with }.

Use this exact structure:
{
  "generatedAt": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
  "marketSummary": "Seed data - historical prices for NIFTY 50 stocks",
  "signals": [],
  "prices": [
    {
      "symbol": "RELIANCE",
      "name": "Reliance Industries Ltd",
      "date": "2026-02-25",
      "open": 2440.00,
      "high": 2465.00,
      "low": 2430.00,
      "close": 2450.50,
      "volume": 8500000
    }
  ]
}

Include ALL 20 stocks listed above with their last 5 trading days each (100 price entries total).
CRITICAL: Output ONLY the raw JSON. No markdown, no explanation, no code fences. First character must be {.'

OUTPUT_FILE="$SIGNALS_DIR/signals_seed_$(date +%Y-%m-%d).json"

# Validate that a file contains parseable JSON with the expected structure
validate_json() {
    local file="$1"
    if [ ! -s "$file" ]; then
        return 1
    fi
    python3 -c "
import json, sys, re
try:
    with open('$file', 'r') as f:
        content = f.read().strip()
    # Try to extract JSON from markdown fences if present
    m = re.search(r'\`\`\`(?:json)?\s*(.*?)\`\`\`', content, re.DOTALL)
    if m:
        content = m.group(1).strip()
    # Try to extract JSON object from surrounding text
    start = content.find('{')
    end = content.rfind('}')
    if start != -1 and end != -1 and end > start:
        content = content[start:end+1]
    data = json.loads(content)
    assert 'prices' in data, 'Missing prices key'
    # Re-write the cleaned JSON back to the file
    with open('$file', 'w') as f:
        json.dump(data, f, indent=2)
    sys.exit(0)
except Exception as e:
    print(f'Validation failed: {e}', file=sys.stderr)
    sys.exit(1)
" 2>/dev/null
}

echo "[$(date)] Fetching historical prices via Claude Code..."

attempt=0
success=false

while [ $attempt -lt $MAX_RETRIES ]; do
    attempt=$((attempt + 1))
    echo "[$(date)] Attempt $attempt of $MAX_RETRIES..."

    "$CLAUDE_CMD" -p "$SEED_PROMPT" \
        --allowedTools "WebSearch,WebFetch" \
        --output-format text \
        > "$OUTPUT_FILE" 2>/dev/null || true

    if validate_json "$OUTPUT_FILE"; then
        success=true
        break
    else
        echo "[$(date)] Attempt $attempt: Did not get valid JSON. $(head -c 100 "$OUTPUT_FILE" 2>/dev/null)"
        if [ $attempt -lt $MAX_RETRIES ]; then
            echo "[$(date)] Retrying..."
        fi
    fi
done

if [ "$success" = true ]; then
    echo "[$(date)] Seed data saved to: $OUTPUT_FILE"
    touch "$SIGNALS_DIR/.new_signals"
    echo "[$(date)] Trigger file created. NestJS bot will import seed data."
else
    echo "[$(date)] ERROR: Seed data fetch failed after $MAX_RETRIES attempts"
    rm -f "$OUTPUT_FILE"
    exit 1
fi

echo "[$(date)] Seed complete."
