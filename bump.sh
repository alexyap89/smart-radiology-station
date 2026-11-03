#!/bin/bash
# Rewrite the version stamp on every local asset URL, so the tablet cannot serve
# a stale stylesheet, script, poster or clip. Run before every commit.
set -e
cd "$(dirname "$0")"
STAMP=$(date +%Y%m%d%H%M%S)
perl -0pi -e "s{(assets/[A-Za-z0-9_./ -]+\.(?:png|jpg|jpeg|mp4|svg|usdz|js))(?:\?v=[A-Za-z0-9]+)?}{\$1?v=$STAMP}g" index.html app.js
perl -0pi -e "s{styles\.css\?v=[A-Za-z0-9]+}{styles.css?v=$STAMP}g" index.html
echo "stamp: $STAMP"
grep -o 'assets/[^"?]*?v=[0-9]*' index.html | head -3
