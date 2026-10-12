#!/bin/bash
# Daily video render (launchd Agent B: com.mathemit.daily).
#
# Laeuft einmal taeglich (Standard 06:30), rendert einen Clip, legt ihn in die
# Queue und schickt eine Mail mit dem Freigabe-Link an mathemit@andybrandy.at.
# Der Link zeigt auf den persistenten Review-Server (--kein-server), weil der
# schon per com.mathemit.review laeuft.
#
# Laeuft schon ein anderer Lauf, ueberspringt weekly.js gefahrlos (Lock-Datei)
# und schreibt nur eine Log-Zeile. Mail-Fehler sind nicht fatal.
#
# Warum ein Login-Shell: `node` kommt aus nvm, `tailscale` aus /usr/local/bin —
# beides steht nur in einer Login-Shell bzw. mit vollem PATH bereit.

set -u
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

PIPELINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="$(cd "$PIPELINE/.." && pwd)"
LOG_DIR="$PIPELINE/work/logs"
mkdir -p "$LOG_DIR"
STAMP="$(date +%F_%H%M)"
LOG="$LOG_DIR/daily-$STAMP.log"

cd "$PIPELINE"
echo "=== Tageslauf $STAMP ===" | tee "$LOG"
# --kein-server: der Server laeuft schon. --daily: eigener Seed/Hook pro Tag.
node weekly.js --daily --kein-server 2>&1 | tee -a "$LOG"
