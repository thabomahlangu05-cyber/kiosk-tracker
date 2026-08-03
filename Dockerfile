# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install all dependencies (including dev, needed for the Next build)
COPY package*.json ./
RUN npm ci

# Copy source (schema included) and generate the Prisma client
COPY . .
RUN npx prisma generate

# Build Next.js app
RUN npm run build

# Runtime stage
FROM node:22-alpine

WORKDIR /app

# Production dependencies only. The prisma CLI and tsx are runtime deps so
# `db push` and `db seed` work on container start without a network install.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Schema first, then generate the client against it
COPY prisma ./prisma
RUN npx prisma generate

# Built app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY next.config.ts ./

# Create non-root user and hand over ownership
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

# Sync the schema to Postgres, seed demo data, then serve.
# `db push` is used instead of `migrate deploy` because the schema is the
# source of truth here; seeding is best-effort so a re-run never blocks boot.
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && (npx prisma db seed || true) && node_modules/.bin/next start"]
