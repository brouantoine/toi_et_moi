#!/usr/bin/env sh
# Backend validation (section 8.1). Usage: sh backend/scripts/validate.sh
cd "$(dirname "$0")/.." || exit 1
if [ -x .venv/Scripts/python.exe ]; then PY=.venv/Scripts/python.exe; else PY=.venv/bin/python; fi
fail=0
$PY -m ruff check . || fail=1
$PY -m ruff format --check . || fail=1
$PY -m mypy . || fail=1
$PY -m pytest -q -p no:warnings || fail=1
$PY manage.py makemigrations --check --dry-run --settings=config.settings.test || fail=1
$PY manage.py spectacular --settings=config.settings.test --validate --fail-on-warn > /dev/null || fail=1
if [ "$fail" -ne 0 ]; then echo "BACKEND VALIDATION FAILED"; exit 1; fi
echo "BACKEND VALIDATION OK"
