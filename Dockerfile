# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy prisma for build-time schema access
COPY prisma ./prisma

# Copy source
COPY . .

# Generate Prisma client with dummy PostgreSQL URL (for build-time generation)
RUN DATABASE_URL="postgresql://dummy:dummy@localhost/dummy" npx prisma generate || true

# Build Next.js app
RUN npm run build

# Runtime stage
FROM node:22-alpine

WORKDIR /app

# Install PostgreSQL client library for Prisma
RUN apk add --no-cache postgresql-client

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built app from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Copy prisma schema for runtime
COPY prisma ./prisma

# Clean Prisma cache to force fresh schema parsing
RUN rm -rf .prisma node_modules/.prisma

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

# Start app - run migrations first, then start
CMD ["sh", "-c", "npx prisma migrate deploy 2>/dev/null || true && node_modules/.bin/next start"]
