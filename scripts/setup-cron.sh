#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Setup cron jobs for the Stock Signal Bot
# Runs analysis at 8:30 AM and 12:30 PM IST on weekdays
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANALYSIS_SCRIPT="$SCRIPT_DIR/run-analysis.sh"
LOG_DIR="$SCRIPT_DIR/../logs"

mkdir -p "$LOG_DIR"

# Ensure the analysis script is executable
chmod +x "$ANALYSIS_SCRIPT"

# IST is UTC+5:30
# 8:30 AM IST = 3:00 AM UTC
# 12:30 PM IST = 7:00 AM UTC
CRON_ENTRIES="# Stock Signal Bot — Market Analysis Cron Jobs
# 8:30 AM IST (3:00 UTC) Mon-Fri
0 3 * * 1-5 $ANALYSIS_SCRIPT >> $LOG_DIR/analysis.log 2>&1
# 12:30 PM IST (7:00 UTC) Mon-Fri
0 7 * * 1-5 $ANALYSIS_SCRIPT >> $LOG_DIR/analysis.log 2>&1"

# Check if cron entries already exist
if crontab -l 2>/dev/null | grep -q "Stock Signal Bot"; then
    echo "Cron jobs already installed. Updating..."
    # Remove old entries and add new ones
    crontab -l 2>/dev/null | grep -v "Stock Signal Bot" | grep -v "run-analysis.sh" > /tmp/crontab_tmp || true
    echo "$CRON_ENTRIES" >> /tmp/crontab_tmp
    crontab /tmp/crontab_tmp
    rm /tmp/crontab_tmp
else
    echo "Installing cron jobs..."
    (crontab -l 2>/dev/null || true; echo ""; echo "$CRON_ENTRIES") | crontab -
fi

echo "Cron jobs installed successfully:"
echo ""
echo "  8:30 AM IST (Mon-Fri) — Morning analysis"
echo " 12:30 PM IST (Mon-Fri) — Midday analysis"
echo ""
echo "Logs will be written to: $LOG_DIR/analysis.log"
echo ""
echo "Current crontab:"
crontab -l
