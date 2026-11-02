#!/usr/bin/env sh
# Mobile validation (section 8.1). Usage: sh scripts/validate-mobile.sh
cd "$(dirname "$0")/../mobile" || exit 1
export PATH="$PATH:/c/Program Files/nodejs"
fail=0
npx tsc --noEmit || fail=1
npx eslint . || fail=1
npx jest --ci --silent || fail=1
npx expo-doctor || fail=1
if [ "$fail" -ne 0 ]; then echo "MOBILE VALIDATION FAILED"; exit 1; fi
echo "MOBILE VALIDATION OK"
