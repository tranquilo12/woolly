FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package.json and lock files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install next-themes first to handle the link: protocol
RUN npm install next-themes

# Install dependencies using pnpm without frozen-lockfile
RUN pnpm install --no-frozen-lockfile

# Copy the Next.js configuration files
COPY next.config.js ./
COPY tsconfig.json ./
COPY postcss.config.js ./
COPY tailwind.config.js ./
COPY .env.local ./.env.local

# Copy the application code
COPY app/ ./app/
COPY components/ ./components/
COPY hooks/ ./hooks/
COPY lib/ ./lib/
COPY public/ ./public/
COPY types/ ./types/

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application in development mode
CMD ["pnpm", "run", "next-dev"] 