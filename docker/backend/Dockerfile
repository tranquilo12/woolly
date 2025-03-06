FROM python:3.11-slim

WORKDIR /app

# Copy requirements files for better caching
COPY requirements.txt .
COPY api/requirements.txt ./api/

# Install dependencies from both requirements files
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir -r api/requirements.txt

# Copy the API code and migrations
COPY api/ ./api/
COPY migrations/ ./migrations/
COPY alembic.ini .
COPY .env.local ./.env.local

# Copy the startup script
COPY docker/backend/start.sh .
RUN chmod +x start.sh

# Expose the port the app runs on
EXPOSE 3001

# Command to run the application
CMD ["./start.sh"]