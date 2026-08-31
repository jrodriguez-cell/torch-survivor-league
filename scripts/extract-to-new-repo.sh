#!/usr/bin/env bash
#
# Copy this standalone app into a fresh directory and start a brand-new git repo,
# so it lives entirely separate from any surrounding project.
#
# Usage:  ./scripts/extract-to-new-repo.sh /path/to/new/torch
#
set -euo pipefail

DEST="${1:-}"
if [[ -z "$DEST" ]]; then
  echo "Usage: $0 <destination-directory>" >&2
  exit 1
fi

# Directory this app lives in (the parent of this scripts/ folder).
SRC="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -e "$DEST" ]]; then
  echo "Error: $DEST already exists. Choose a new path." >&2
  exit 1
fi

echo "Copying app from $SRC -> $DEST"
mkdir -p "$DEST"

# Copy everything except build artifacts, deps, local env, and any git metadata.
cp -R "$SRC/." "$DEST/"
rm -rf "$DEST/node_modules" "$DEST/.next" "$DEST/.git" "$DEST/.env.local"

cd "$DEST"
git init -q
git add .
git commit -q -m "Initial commit: Torch — fantasy Survivor league & weekly pick'em"

echo
echo "Done. New repo initialized at: $DEST"
echo
echo "Next steps:"
echo "  1. Create an empty repository on GitHub (no README/license)."
echo "  2. cd \"$DEST\""
echo "  3. git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO.git"
echo "  4. git push -u origin main"
echo "  5. cp .env.local.example .env.local  # then fill in your Supabase keys"
