# Multi-stage Dockerfile for Hugging Face Spaces
# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (sharp, bcrypt)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    vips-dev \
    ca-certificates

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy source code
COPY src/ ./src/

# ---- Runtime Stage ----
FROM node:20-alpine AS runner

ENV NODE_ENV=production
ENV PORT=7860

# Install runtime dependencies (sharp needs libvips)
RUN apk add --no-cache \
    vips \
    ca-certificates \
    tini \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# Create directory for static files (frontend)
RUN mkdir -p /app/src/client && chown nodejs:nodejs /app/src/client

USER nodejs

EXPOSE 7860

# Use tini for proper signal handling
ENTRYPOINT ["tini", "--"]
CMD ["node", "src/server/index.js"]