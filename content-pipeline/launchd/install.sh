#!/bin/bash
# install.sh — richtet die beiden launchd-Agents ein (oder entfernt sie).
#
#   bash content-pipeline/launchd/install.sh            # einrichten + starten
#   bash content-pipeline/launchd/install.sh --uninstall # entfernen
#   bash content-pipeline/launchd/install.sh --status    # Zustand anzeigen
#
# Die Agents:
#   com.mathemit.review  Freigabe-Server, immer an (KeepAlive)
#   com.mathemit.daily   jeden Tag rendern + Freigabe-Mail (06:30)
#
# Achtung Pfad: Die .plist-Dateien enthalten den absoluten Repo-Pfad. Liegt
# das Repo woanders, muessen die Pfade in beiden .plist angepasst werden (oder
# der Editor macht es). Dieses Skript kopiert die .plist unveraendert nach
# ~/Library/LaunchAgents.

set -u

LAUNCHD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENTS_DIR="$HOME/Library/LaunchAgents"
LABELS=(com.mathemit.review com.mathemit.daily)

mkdir -p "$AGENTS_DIR"

install_agents() {
  for label in "${LABELS[@]}"; do
    src="$LAUNCHD_DIR/$label.plist"
    dst="$AGENTS_DIR/$label.plist"
    if [ ! -f "$src" ]; then
      echo "FEHLER: $src fehlt." >&2
      exit 1
    fi
    # Altbestand entladen, falls vorhanden (ignoriere Fehler).
    launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
    cp "$src" "$dst"
    launchctl bootstrap "gui/$(id -u)" "$dst"
    launchctl enable "gui/$(id -u)/$label" 2>/dev/null || true
    echo "✓ $label geladen"
  done
  echo
  echo "Fertig. Status mit: bash $LAUNCHD_DIR/install.sh --status"
  echo "Logs: content-pipeline/work/logs/"
}

uninstall_agents() {
  for label in "${LABELS[@]}"; do
    launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
    rm -f "$AGENTS_DIR/$label.plist"
    echo "✓ $label entfernt"
  done
}

show_status() {
  for label in "${LABELS[@]}"; do
    echo "=== $label ==="
    launchctl print "gui/$(id -u)/$label" 2>/dev/null | grep -E 'state|program|next fire|runs|last exit' || \
      echo "  (nicht geladen)"
  done
}

case "${1:-}" in
  --uninstall) uninstall_agents ;;
  --status)    show_status ;;
  "")          install_agents ;;
  *)           echo "Aufruf: install.sh [--uninstall|--status]" >&2; exit 1 ;;
esac
