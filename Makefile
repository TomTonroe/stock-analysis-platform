PYTHON := python

.PHONY: install dev api web lint fmt clean db-upgrade db-migrate

# Installation
install:
	cd backend && pip install -e .

dev:
	cd backend && pip install -e ".[dev]"

# Services
api:
	@echo "Starting FastAPI server..."
	cd backend && PYTHONPATH=src uvicorn app.app:app --host 0.0.0.0 --port 8000 --reload

web:
	@echo "Starting Next.js frontend..."
	cd frontend && npm run dev

# Database
db-upgrade:
	@echo "Applying database migrations..."
	cd backend && PYTHONPATH=src alembic upgrade head

db-migrate:
	@echo "Creating new database migration..."
	cd backend && PYTHONPATH=src alembic revision --autogenerate -m "Database changes"

# Code quality
lint:
	@echo "Running linters..."
	ruff check backend/src/ --fix || true
	mypy backend/src/ || true

fmt:
	@echo "Formatting code..."
	black backend/src/
	ruff check backend/src/ --fix

clean:
	@echo "Cleaning up..."
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	rm -rf .mypy_cache .pytest_cache .ruff_cache
	rm -rf backend/artifacts/*.joblib backend/artifacts/*.json 2>/dev/null || true
