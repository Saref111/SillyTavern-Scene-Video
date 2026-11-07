#!/usr/bin/env bash
# Links Scene Video into a SillyTavern install for development.
# Usage: ./install.sh [/path/to/SillyTavern] [user]
set -euo pipefail
ST="${1:-$HOME/SillyTavern-new}"
USER_DIR="${2:-default-user}"
HERE="$(cd "$(dirname "$0")" && pwd)"

[ -f "$HERE/dist/index.js" ] || { echo "Build first: npm install && npm run build"; exit 1; }

ln -sfn "$HERE" "$ST/data/$USER_DIR/extensions/st-scene-video"
mkdir -p "$ST/plugins"
ln -sfn "$HERE/server" "$ST/plugins/scene-video"

echo "Linked UI extension and server plugin."
if ! grep -q '^enableServerPlugins: true' "$ST/config.yaml"; then
    echo "NOTE: set 'enableServerPlugins: true' in $ST/config.yaml (needed for OpenRouter/WaveSpeed), then restart SillyTavern."
fi
