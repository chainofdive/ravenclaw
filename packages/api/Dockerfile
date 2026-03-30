# === Build stage ===
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./

# Copy package manifests for dependency resolution
COPY packages/core/package.json packages/core/package.json
COPY packages/api/package.json packages/api/package.json

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/core/ packages/core/
COPY packages/api/ packages/api/

# Build core first, then api
RUN pnpm --filter @ravenclaw/core build && \
    pnpm --filter @ravenclaw/api build

# === Production stage ===
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy package manifests
COPY packages/core/package.json packages/core/package.json
COPY packages/api/package.json packages/api/package.json

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built output
COPY --from=builder /app/packages/core/dist packages/core/dist
COPY --from=builder /app/packages/api/dist packages/api/dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "packages/api/dist/index.js"]
