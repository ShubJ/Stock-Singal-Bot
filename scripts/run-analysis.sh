#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Stock Signal Bot — Multi-Agent Analysis Script
# Runs Claude Code in non-interactive mode (-p) with a multi-agent prompt
# that sequentially executes 4 agents: QUANT, SENTINEL, ORACLE, TRADER
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SIGNALS_DIR="${SIGNALS_OUTPUT_DIR:-$PROJECT_ROOT/data/signals}"
TIMESTAMP=$(date +"%Y-%m-%d_%H%M")
OUTPUT_FILE="$SIGNALS_DIR/signals_${TIMESTAMP}.json"
TRIGGER_FILE="$SIGNALS_DIR/.new_signals"
MAX_ITERATIONS="${MAX_VALIDATION_ITERATIONS:-6}"
CLAUDE_CMD="${CLAUDE_PATH:-claude}"
MAX_RETRIES=3

mkdir -p "$SIGNALS_DIR"

echo "[$(date)] Starting multi-agent stock analysis..."

# The multi-agent analysis prompt
ANALYSIS_PROMPT='You are a multi-agent stock analysis system for the Indian stock market (NSE/BSE).
You will execute 4 agents sequentially, each building on the previous agents output.
Focus on NIFTY 50 stocks. Today is '"$(date +%Y-%m-%d)"'.

═══════════════════════════════════════════════════════════════
AGENT 1: QUANT (Technical Analyst)
═══════════════════════════════════════════════════════════════
Task: Search the web for current NIFTY 50 stock prices and compute technical indicators.

1. Search for current prices of top 15-20 actively traded NIFTY 50 stocks
2. For each stock, compute or find:
   - RSI (14-period) — Overbought >70, Oversold <30
   - MACD (12,26,9) — Signal line crossovers
   - Bollinger Bands (20,2) — Price relative to bands
   - Moving Averages — SMA 20, 50, 200 and their crossovers
3. Flag any stocks showing strong technical signals (golden cross, death cross, RSI extremes, BB squeeze)

Output your findings as structured data for the next agent.

═══════════════════════════════════════════════════════════════
AGENT 2: SENTINEL (News & Sentiment Analyst)
═══════════════════════════════════════════════════════════════
Task: Search the web for market-moving news, FII/DII data, earnings, and insider activity.

1. Search for today'"'"'s FII/DII buy/sell data
2. Search for any earnings announcements or results from NIFTY 50 companies in the last 48 hours
3. Search for breaking news affecting Indian markets (RBI policy, global cues, sector-specific news)
4. Search for any insider trading activity or bulk/block deals
5. Rate overall market sentiment: BULLISH, BEARISH, or NEUTRAL with reasoning

Output your findings as structured data for the next agent.

═══════════════════════════════════════════════════════════════
AGENT 3: ORACLE (Signal Synthesizer)
═══════════════════════════════════════════════════════════════
Task: Combine QUANT technicals + SENTINEL sentiment into composite signals.

Weighted Scoring Formula:
- MACD Signal: 30% weight
- RSI Signal: 25% weight
- Moving Average Signal: 25% weight
- Bollinger Band Signal: 20% weight

For each stock analyzed by QUANT:
1. Compute individual indicator scores (-1 to +1 scale)
2. Apply weights to get composite score
3. Adjust based on SENTINEL'"'"'s sentiment data:
   - Strong positive news: boost by 10%
   - Strong negative news: reduce by 10%
   - FII buying: boost by 5%
   - FII selling: reduce by 5%
4. Map composite score to signal:
   - >= 0.6: STRONG_BUY
   - >= 0.3: BUY
   - >= -0.3: HOLD
   - >= -0.6: SELL
   - < -0.6: STRONG_SELL
5. Calculate target price and stop loss based on technicals (ATR-based or support/resistance)
6. Compute risk/reward ratio (must be >= 2:1 to generate a BUY/STRONG_BUY)

Output signals with full scoring breakdown.

═══════════════════════════════════════════════════════════════
AGENT 4: TRADER (Signal Classifier & Validator)
═══════════════════════════════════════════════════════════════
Task: Classify each signal and run self-validation.

For each signal from ORACLE:
1. Classify as:
   - IMPULSE (1-5 day holding, momentum-based, quick entry/exit)
   - LONG_TERM (weeks to months, value-based, fundamentals matter)

2. Set position size (% of portfolio):
   - STRONG_BUY: 8-10%
   - BUY: 5-7%
   - Others: 0% (no position)

3. Run Self-Validation Loop (max '"$MAX_ITERATIONS"' iterations per signal):
   For each signal, answer these 5 questions honestly:
   Q1: Is the data fresh and reliable? (Are prices from today? Are news items recent?)
   Q2: Do technicals and news agree? (Are they pointing in the same direction?)
   Q3: What is the biggest invalidation risk? (What could make this signal wrong?)
   Q4: Is the risk/reward ratio >= 2:1? (Is the potential gain at least 2x the potential loss?)
   Q5: Would I bet ₹1,00,000 of real money on this? (Gut check — is this truly convincing?)

   If ANY answer is NO:
   - Revise the signal (adjust target, stop loss, confidence, or downgrade signal type)
   - Reduce confidence by 10% per iteration
   - Re-run validation
   - Continue until all 5 answers are YES or max iterations reached

   If max iterations reached with any NO: downgrade to HOLD

Output the final validated signals.

═══════════════════════════════════════════════════════════════
FINAL OUTPUT FORMAT
═══════════════════════════════════════════════════════════════
Output ONLY a valid JSON object (no markdown, no explanation, no wrapping) with this exact structure:

{
  "generatedAt": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
  "marketSummary": "Brief 2-3 sentence market overview",
  "signals": [
    {
      "symbol": "RELIANCE",
      "name": "Reliance Industries Ltd",
      "signalType": "STRONG_BUY|BUY|HOLD|SELL|STRONG_SELL",
      "tradeType": "IMPULSE|LONG_TERM",
      "confidence": 85.0,
      "currentPrice": 2450.50,
      "targetPrice": 2600.00,
      "stopLoss": 2380.00,
      "riskRewardRatio": 2.12,
      "positionSizePct": 8.0,
      "technicals": {
        "rsi": 55.3,
        "macd": { "value": 12.5, "signal": 8.3, "histogram": 4.2 },
        "bollingerBands": { "upper": 2520, "middle": 2440, "lower": 2360 },
        "movingAverages": { "sma20": 2430, "sma50": 2380, "sma200": 2250 }
      },
      "sentiment": {
        "newsScore": 0.7,
        "fiiDiiFlow": "FII net buyers +1200cr",
        "earningsSurprise": "Beat estimates by 5%",
        "insiderActivity": null
      },
      "reasoning": "Detailed reasoning for this signal...",
      "validationIterations": 2,
      "validationLog": [
        {
          "iteration": 1,
          "questions": {
            "q1DataFresh": true,
            "q2TechNewsAgree": true,
            "q3InvalidationRisk": "Global crude spike above $90",
            "q4RiskReward": true,
            "q5WouldBetReal": false
          },
          "passed": false,
          "adjustments": "Tightened stop loss, reduced position size"
        },
        {
          "iteration": 2,
          "questions": {
            "q1DataFresh": true,
            "q2TechNewsAgree": true,
            "q3InvalidationRisk": "Global crude spike above $90",
            "q4RiskReward": true,
            "q5WouldBetReal": true
          },
          "passed": true,
          "adjustments": null
        }
      ]
    }
  ],
  "prices": [
    {
      "symbol": "RELIANCE",
      "name": "Reliance Industries Ltd",
      "date": "'"$(date +%Y-%m-%d)"'",
      "open": 2440.00,
      "high": 2465.00,
      "low": 2430.00,
      "close": 2450.50,
      "volume": 8500000
    }
  ]
}

CRITICAL: Your ENTIRE response must be ONLY the JSON object. Do not include any text, explanation, markdown fences, or commentary. Start with { and end with }.'

# Validate that a file contains parseable JSON with the expected structure
validate_json() {
    local file="$1"
    if [ ! -s "$file" ]; then
        return 1
    fi
    # Try to parse as JSON and check for required top-level keys
    python3 - "$file" << 'PYEOF'
import json, sys, re

file_path = sys.argv[1]
try:
    with open(file_path, 'r') as f:
        content = f.read().strip()
    if not content:
        print("Validation failed: empty file", file=sys.stderr)
        sys.exit(1)
    # Try to extract JSON from markdown fences if present
    m = re.search(r'```(?:json)?\s*(.*?)```', content, re.DOTALL)
    if m:
        content = m.group(1).strip()
    # Try to extract JSON object from surrounding text
    start = content.find('{')
    end = content.rfind('}')
    if start != -1 and end != -1 and end > start:
        content = content[start:end+1]
    data = json.loads(content)
    assert 'signals' in data or 'prices' in data, 'Missing signals/prices key'
    # Re-write the cleaned JSON back to the file
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"Validation passed: {len(data.get('signals', []))} signals")
    sys.exit(0)
except Exception as e:
    print(f"Validation failed: {e}", file=sys.stderr)
    sys.exit(1)
PYEOF
}

echo "[$(date)] Sending analysis prompt to Claude..."

attempt=0
success=false

while [ $attempt -lt $MAX_RETRIES ]; do
    attempt=$((attempt + 1))
    echo "[$(date)] Attempt $attempt of $MAX_RETRIES..."

    # Run Claude Code in non-interactive mode with web tools allowed
    "$CLAUDE_CMD" -p "$ANALYSIS_PROMPT" \
        --allowedTools "WebSearch,WebFetch" \
        --output-format text \
        > "$OUTPUT_FILE" 2>/dev/null || true

    if validate_json "$OUTPUT_FILE"; then
        success=true
        break
    else
        echo "[$(date)] Attempt $attempt: Claude did not return valid JSON. $(head -c 100 "$OUTPUT_FILE" 2>/dev/null)"
        if [ $attempt -lt $MAX_RETRIES ]; then
            echo "[$(date)] Retrying..."
        fi
    fi
done

if [ "$success" = true ]; then
    echo "[$(date)] Analysis complete. Output saved to: $OUTPUT_FILE"

    # Create trigger file for the NestJS file watcher
    touch "$TRIGGER_FILE"
    echo "[$(date)] Trigger file created. NestJS bot will import signals."
else
    echo "[$(date)] ERROR: Analysis failed after $MAX_RETRIES attempts"
    rm -f "$OUTPUT_FILE"
    exit 1
fi

echo "[$(date)] Analysis pipeline complete."
