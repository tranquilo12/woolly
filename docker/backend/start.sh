#!/bin/sh

# Ensure virtual environment is activated
export PATH="/app/.venv/bin:$PATH"

# Run database migrations
echo "Running database migrations..."
python -m alembic upgrade head

# Start the FastAPI application
echo "Starting FastAPI application..."
exec python -m uvicorn api.index:app --host 0.0.0.0 --port 3001 