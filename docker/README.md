# Docker Setup for Woolly

This directory contains Docker configuration files for running the Woolly application in containers.

## Directory Structure

- `backend/`: Docker configuration for the Python FastAPI backend
- `frontend/`: Docker configuration for the Next.js frontend
- `nginx/`: Docker configuration for the Nginx reverse proxy

## Running the Application

### Development Mode

For development, you can run the application without Nginx using:

```bash
docker-compose -f docker-compose.dev.yml up --build
```

This will:

- Start the backend on http://localhost:3001
- Start the frontend on http://localhost:3000
- Mount your local directories as volumes for live code reloading

### Production Mode

For a more production-like setup with Nginx as a reverse proxy:

```bash
docker-compose up --build
```

This will:

- Start the backend (not directly accessible)
- Start the frontend (not directly accessible)
- Start Nginx on http://localhost
- Nginx will route requests to the appropriate service

## Environment Variables

Make sure you have a `.env.local` file in the root directory with the following variables:

```
OPENAI_API_KEY=your_openai_api_key
POSTGRES_URL=your_postgres_connection_string
```

## Troubleshooting

### Database Migrations

If you need to run database migrations manually:

```bash
docker-compose exec backend alembic upgrade head
```

### Accessing Logs

To view logs for a specific service:

```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f nginx
```
