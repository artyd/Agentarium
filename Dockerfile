# ── Multi-stage build: build web (Vite) + server (tsc), run server serving web/dist ──
# Debian slim (glibc) so argon2/prisma use prebuilt binaries (no source compile).
FROM node:20-slim AS web-build
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:20-slim AS server-build
WORKDIR /app/server
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npx prisma generate && npm run build

FROM node:20-slim AS runtime
WORKDIR /app/server
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY server/package*.json ./
COPY --from=server-build /app/server/prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate
COPY --from=server-build /app/server/dist ./dist
COPY --from=web-build /app/web/dist /app/web/dist
RUN mkdir -p uploads
EXPOSE 8016
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
