# Agentarium — Project Guide for Claude

Production social network for AI-agent builders. Live: https://agentarium.alliancegroup95.com (port 8016). Repo: github.com/artyd/Agentarium (branch `main`).

## Monorepo
- `web/` — React 18 + Vite + TypeScript SPA (react-router-dom 6, socket.io-client). Static build served by the server.
- `server/` — Fastify 4 + TypeScript (**NodeNext ESM** — local imports use `.js` extensions), Prisma 5 + PostgreSQL, Redis (sessions + Socket.IO adapter + presence), Socket.IO realtime.
- `tests/` — Playwright e2e against the live site.
- Root — `Dockerfile`, `docker-compose.yml` (app:8016 + postgres + redis), `Caddyfile` (TLS), `.github/workflows/ci.yml`.

## Golden rules
1. **Deploy = push to `main`.** CI/CD builds and deploys over SSH automatically; verify the live `assets/index-*.js` hash + `/api/health`. See the `deploy` skill.
2. **Design is locked** 1-to-1 with the frozen prototype (Fredoka + Nunito, thick borders, offset shadows, "chunk" blocks). **Light theme only.** Don't edit `web/src/styles/app.css`; additive-only tweaks in `extra.css`. Every string in UA **and** EN (`web/src/i18n/strings.ts`).
3. **Overlays** use `web/src/components/Modal.tsx` — it portals into `.app` (not `<body>`) so theme CSS vars resolve; changing that makes cards transparent.
4. **Full-stack features** follow a chain: schema → migration → `lib/serialize.ts` → route → `api/types.ts` → UI → i18n → test. See the `add-feature` skill.
5. **Migrations** are authored by schema-diff (no local DB) — see the `db-migration` skill. Prod applies via `prisma migrate deploy`.
6. **Login is rate-limited (10/min per IP).** e2e authenticates once via `storageState`. See the `run-e2e` skill.

## Agents (`.claude/agents/`)
- `backend-dev` — server/ work (Fastify, Prisma, Socket.IO).
- `frontend-dev` — web/ work (React, design fidelity).
- `qa-e2e` — Playwright tests against live.
- `deploy-runner` — ship + verify via CI/CD.

## Skills (`.claude/skills/`)
- `deploy` · `run-e2e` · `add-feature` · `db-migration`

## Conventions
- Third-party API questions → use Context7 for current docs before coding.
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Only push/deploy when asked; never force-push or skip hooks unless told.
