# Backend validation (section 8.1). Run from repo root: powershell -File backend/scripts/validate.ps1
$ErrorActionPreference = "Continue"
Push-Location (Join-Path $PSScriptRoot "..")
$py = ".\.venv\Scripts\python.exe"
$failed = $false
& $py -m ruff check .; if ($LASTEXITCODE) { $failed = $true }
& $py -m ruff format --check .; if ($LASTEXITCODE) { $failed = $true }
& $py -m mypy .; if ($LASTEXITCODE) { $failed = $true }
& $py -m pytest -q -p no:warnings; if ($LASTEXITCODE) { $failed = $true }
& $py manage.py makemigrations --check --dry-run --settings=config.settings.test; if ($LASTEXITCODE) { $failed = $true }
Pop-Location
if ($failed) { Write-Output "BACKEND VALIDATION FAILED"; exit 1 } else { Write-Output "BACKEND VALIDATION OK" }
