#!/usr/bin/env sh
# Regenerate the typed API client types from the backend OpenAPI schema.
# openapi-typescript needs TypeScript 5 (the app uses 6), so it runs isolated via npx.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"
if [ -x .venv/Scripts/python.exe ]; then PY=.venv/Scripts/python.exe; else PY=.venv/bin/python; fi
$PY manage.py spectacular --settings=config.settings.test --file "$ROOT/mobile/src/api/schema.yaml"
cd "$ROOT/mobile"
npx --yes -p openapi-typescript@7.13.0 -p typescript@5.9.3 openapi-typescript src/api/schema.yaml -o src/api/schema.d.ts
npx prettier --write src/api/schema.d.ts > /dev/null
echo "API types regenerated: mobile/src/api/schema.d.ts"
