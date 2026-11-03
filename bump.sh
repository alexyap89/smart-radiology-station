#!/bin/bash
# Rewrite the asset-version stamp so the tablet cannot serve a stale stylesheet.
# Run before every commit that touches CSS or JS.
set -e
cd "$(dirname "$0")"
STAMP=$(date +%Y%m%d%H%M%S)
perl -0pi -e "s/styles\.css\?v=[A-Za-z0-9]+/styles.css?v=$STAMP/; s/app\.js\?v=[A-Za-z0-9]+/app.js?v=$STAMP/" index.html
echo "stamp: $STAMP"
grep -o 'styles.css?v=[A-Za-z0-9]*\|app.js?v=[A-Za-z0-9]*' index.html
