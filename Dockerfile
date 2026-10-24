# Open Agent Hackathon 2026 - Nexus Submission
# Multi-stage reproducible container build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json tsconfig.json ./

# Install all dependencies at build time
RUN npm ci || npm install

# Copy application source code and assets
COPY src/ ./src/
COPY data/ ./data/
COPY public/ ./public/

# Compile TypeScript into JavaScript
RUN npm run build

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000
ENV HOST=0.0.0.0
ENV SAMPLE_MODE=true

# Copy package manifests and production dependencies
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy compiled output and runtime assets
COPY --from=builder /app/dist ./dist
COPY data/ ./data/
COPY public/ ./public/
COPY input_examples/ ./input_examples/
COPY output_examples/ ./output_examples/
COPY run.js ./run.js
COPY .env.example ./.env.example

# Create storage and logs directories
RUN mkdir -p /app/storage /app/logs && chmod -R 777 /app/storage /app/logs

EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8000/api/health || exit 1

CMD ["node", "dist/src/server.js"]
