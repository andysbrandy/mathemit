#!/bin/bash
# Persistent review server (launchd Agent A: com.mathemit.review).
#
# Startet den Freigabe-Server dauerhaft. Der Freigabe-Link in der taeglichen
# Mail zeigt auf diesen Server — er muss also laufen, bevor die Mail ankommt.
#
# Der Token ist fix und liegt in .review-token: nur so stimmt der Link aus
# der Mail ueber Server-Neustarts hinweg. Fehlt die Datei, wird beim ersten
# Start ein Token erzeugt. weekly.js liest dieselbe Datei (--kein-server).
#
# Warum ein Login-Shell: `node` kommt hier aus nvm und steht nur in einer
# Login-Shell im PATH. Ohne `-l` findet launchd kein node.

set -u
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"   # tailscale liegt in /usr/local/bin

PIPELINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="$(cd "$PIPELINE/.." && pwd)"
TOKEN_FILE="$PIPELINE/.review-token"

if [ ! -s "$TOKEN_FILE" ]; then
  umask 077
  openssl rand -base64 24 | tr -d '/+=\n' | cut -c1-24 > "$TOKEN_FILE"
  echo "Neuen Freigabe-Token in $TOKEN_FILE erzeugt." >&2
fi

TOKEN="$(head -n1 "$TOKEN_FILE")"
PORT="${REVIEW_PORT:-8787}"

cd "$REPO"
exec node "$PIPELINE/review-server.js" --port "$PORT" --token "$TOKEN"
