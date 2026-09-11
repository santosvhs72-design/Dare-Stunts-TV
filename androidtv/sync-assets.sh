#!/bin/sh
# Copies the web app into the APK's assets. Run before every build: nothing does
# this automatically, and Gradle has no idea the game lives one level up.
set -eu

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$(cd "$(dirname "$0")" && pwd)/app/src/main/assets/game"

rm -rf "$DEST"
mkdir -p "$DEST"
for item in index.html css js img; do
  cp -r "$SRC/$item" "$DEST/"
done

echo "Sincronizado: $SRC -> $DEST"
