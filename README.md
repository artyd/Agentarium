# Agentarium

Production build of the Agentarium social network for AI-agent builders — a
playful-styled (Fredoka + Nunito, thick borders, offset shadows), UA/EN,
light/dark app. The UI is a **1-to-1 React port** of the frozen Claude Design
prototype (`web/reference/`); the mock data / fake login is replaced by a real
Fastify + PostgreSQL + Prisma + Redis + Socket.IO backend.

## Stack
- **web/** — React 18 + Vite + TypeScript SPA. Prototype CSS copied verbatim into
  `web/src/styles/app.css`; icons ported to `web/src/icons/ag-icons.ts`.
- **server/** — Fastify + TypeScript. Prisma/PostgreSQL, Redis sessions +
  Socket.IO Redis adapter, argon2 auth, sanitize-html, GitHub OAuth (public repos).
- **docker-compose.yml** — `app` (:8016) + `postgres` + `redis`, behind the
  host `Caddyfile` (TLS for `agentarium.alliancegroup95.com`).

## Local development
```bash
# 1. Start Postgres + Redis (docker) — or point env at your own instances
docker compose up -d postgres redis

# 2. Backend
cd server
cp ../.env.example .env        # edit secrets; set DATABASE_URL/REDIS_URL to localhost
npm install
npx prisma migrate deploy      # applies prisma/migrations (schema + FTS GIN indexes)
SEED_ADMIN_NICK=admin SEED_ADMIN_PASS=changeme npm run seed   # achievements + first member
npm run dev                    # Fastify on :8016

# 3. Frontend (separate terminal) — Vite proxies /api + /socket.io to :8016
cd web
npm install
npm run dev                    # http://localhost:5173
```
The first login uses the seeded bootstrap member (`admin` / `changeme`). New users
register → a `JoinRequest` is created → **any existing member** approves it in the
**Запити** screen → the account becomes real.

## Production (target host)
```bash
cp .env.example .env           # fill ALL secrets (SESSION_SECRET, TOKEN_ENC_KEY 64-hex,
                               # POSTGRES_PASSWORD, GITHUB_* , PUBLIC_URL)
docker compose up -d --build   # app listens on 127.0.0.1:8016
# Point Caddy (host) at it:
caddy run --config ./Caddyfile # → https://agentarium.alliancegroup95.com
```
`docker compose` runs `prisma migrate deploy` on start. Run the seed once inside the
container to create achievements + the first member:
```bash
docker compose exec app sh -c "cd server && SEED_ADMIN_NICK=… SEED_ADMIN_PASS=… npm run seed"
```

## GitHub OAuth
Register a GitHub OAuth App with callback `…/api/github/callback`, scope `read:user`
(public repos only). Put client id/secret in `.env`. Manual mode (paste repo URL)
needs no GitHub App.

## Backups (plan §11)
Daily `pg_dump` with 7–14 day rotation, e.g. host cron:
```bash
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > backups/agentarium-$(date +%F).sql.gz
find backups -name '*.sql.gz' -mtime +14 -delete
```

## Security posture (plan §11)
argon2id password hashing · Redis httpOnly+secure signed session cookie ·
`SameSite=Lax` + Origin check (CSRF) · rate limits on `/api/auth/*` &
`/api/join-requests` · `sanitize-html` allow-list on write **and** read · GitHub
tokens AES-256-GCM encrypted at rest (`TOKEN_ENC_KEY`) · HTTPS via Caddy.

## Launch checklist (plan §8)
- [ ] Secrets set in `.env` (no dev defaults in prod)
- [ ] `docker compose up --build` — all three services healthy; `GET /api/health` 200
- [ ] Seed run once (achievements + first member)
- [ ] Caddy serving TLS for the domain
- [ ] Daily `pg_dump` cron installed
- [ ] End-to-end: register → approve → first post (each type) → vote/🔥/comment →
      friend → 1:1 + group chat (two sessions) → GitHub connect → search
```
```
