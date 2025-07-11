# Stage 1: Builder
FROM python:3.12-slim AS builder

# Install uv from official source
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Install system dependencies needed for building packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files (only pyproject.toml and uv.lock needed to replicate environment)
COPY pyproject.toml uv.lock ./

# Install dependencies in virtual environment
RUN uv sync --frozen --compile-bytecode

# Stage 2: Runtime
FROM python:3.12-slim AS runtime

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    USER=woolly-user

# Create non-root user
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -s /bin/bash $USER

# Copy the virtual environment from builder stage
COPY --from=builder /app/.venv /app/.venv

# Add virtual environment to PATH
ENV PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Copy application code
COPY api/ ./api/
COPY migrations/ ./migrations/
COPY alembic.ini .
COPY .env.local ./.env.local

# Copy startup script
COPY docker/backend/start.sh .
RUN chmod +x start.sh

# Set ownership
RUN chown -R "$USER":"$USER" /app
USER $USER

# Expose port
EXPOSE 3001

# Run the application
CMD ["./start.sh"]