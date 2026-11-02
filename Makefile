# Requires GNU make (Linux/macOS/WSL/Git Bash). Windows PowerShell users: see CLAUDE.md.
PY ?= backend/.venv/bin/python
ifeq ($(OS),Windows_NT)
PY = backend/.venv/Scripts/python.exe
endif

.PHONY: up down test test-backend test-mobile lint seed demo api-types

up:
	docker compose up --build -d

down:
	docker compose down

test: test-backend test-mobile

test-backend:
	cd backend && ../$(PY) -m pytest --cov

test-mobile:
	cd mobile && npx jest

lint:
	cd backend && ../$(PY) -m ruff check . && ../$(PY) -m ruff format --check . && ../$(PY) -m mypy .
	cd backend && ../$(PY) manage.py makemigrations --check --dry-run --settings=config.settings.test
	cd mobile && npx tsc --noEmit && npx eslint .

# Catalogues (questions, date ideas) - implemented in P4/P6.
seed:
	cd backend && ../$(PY) manage.py migrate && ../$(PY) manage.py seed_catalogs

# Demo couple for store reviewers (needs DEMO_PASSWORD) - implemented in P11.
demo: seed
	cd backend && ../$(PY) manage.py seed_demo

# Regenerate the typed API client from the backend OpenAPI schema.
api-types:
	sh scripts/api-types.sh
