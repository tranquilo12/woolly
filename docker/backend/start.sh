#!/bin/sh

# Run database migrations
echo "Running database migrations..."
alembic upgrade head

# Start the FastAPI application
echo "Starting FastAPI application..."
exec python -m uvicorn api.index:app --host 0.0.0.0 --port 3001 