---
name: deploy
description: Deploy Agentarium to production. Use when the user asks to ship, deploy, push live, or release changes to agentarium.alliancegroup95.com.
---

# Deploy Agentarium

Deploying is **committing and pushing to `main`** — CI/CD does the rest. There is no manual deploy command.

## Steps

1. **Build locally first** (fail fast before pushing):
   - `cd web && npm run build` — note the emitted `dist/assets/index-*.js` hash.
   - `cd server && npm run build`.
2. **Commit + push:**
   - Commit with a clear message; end it with the trailer:
     `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
   - `git push origin main`.
3. **Watch CI:**
   - `gh run list --branch main --limit 1 --json databaseId -q '.[0].databaseId'`
   - `gh run watch <id> --exit-status`
4. **Verify live:**
   - Bundle: `curl -s https://agentarium.alliancegroup95.com/ | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js'` — must equal the hash from step 1.
   - Health: `curl -s https://agentarium.alliancegroup95.com/api/health` → `{"ok":true,...}`.
5. **Tell the user to Ctrl+F5** — the site caches aggressively.

## Under the hood
`.github/workflows/ci.yml`: build (web + server) → deploy over SSH (secrets `DEPLOY_HOST/USER/KEY`) → on host `/opt/agentarium`: `git reset --hard origin/main && docker compose up -d --build`, health-check `:8016`. Schema changes apply via `prisma migrate deploy`.

Only push when the user wants to deploy. Never force-push or skip hooks unless explicitly asked.
