#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
export KIDS_APP_ORIGIN="${KIDS_APP_ORIGIN:-https://study.vuminh90.click}"
export KIDS_API_ORIGIN="${KIDS_API_ORIGIN:-$KIDS_APP_ORIGIN}"

echo "Starting kids kiosk at $KIDS_APP_ORIGIN"
echo "Press Ctrl+C from this terminal to stop the kiosk."
exec python3 kiosk_controller.py
