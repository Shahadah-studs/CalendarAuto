#!/usr/bin/env bash
set -euo pipefail

rm -rf dist
mkdir -p dist
npx tsc
cp -r public/* dist/
