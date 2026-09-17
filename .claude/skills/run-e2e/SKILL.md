---
name: run-e2e
description: Run the Agentarium Playwright end-to-end suite against the live site, including creating and cleaning up a throwaway test account. Use to validate changes or hunt regressions.
---

# Run Agentarium e2e tests

Tests live in `tests/` and run against the LIVE site.

## 1. Get credentials (no shared password on file)
Registration is open — create a throwaway account:
```bash
BASE="https://agentarium.alliancegroup95.com"; TS=$(date +%s); NICK="qa_$TS"; PASS="Qa!${TS}xZ"
curl -s -X POST "$BASE/api/auth/register" -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d "{\"nickname\":\"$NICK\",\"password\":\"$PASS\"}" -w "\nHTTP:%{http_code}\n"
echo "NICK=$NICK PASS=$PASS"
```

## 2. Run
```bash
cd tests && AG_USER="$NICK" AG_PASS="$PASS" npx playwright test
```
- Single test: append `-g "<name substring>"`.
- The suite logs in ONCE (`auth.setup.ts`) and reuses `storageState`; `workers: 1`.

## 3. Rate limit (important)
Login is capped at **10/min per IP**. Don't add extra logins. A `.applayout`-never-appears failure is usually throttling, not a bug — re-run isolated to confirm. A 429 now surfaces as "Забагато спроб…", not "wrong password".

## 4. Clean up (always)
```bash
BASE="https://agentarium.alliancegroup95.com"; JAR=$(mktemp); C=000
until [ "$C" = "200" ]; do C=$(curl -s -o /dev/null -w "%{http_code}" -c "$JAR" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" -H "Origin: $BASE" -d "{\"nickname\":\"$NICK\",\"password\":\"$PASS\"}"); [ "$C" = "200" ] || sleep 5; done
curl -s -b "$JAR" -X DELETE "$BASE/api/auth/me" -H "Content-Type: application/json" -H "Origin: $BASE" \
  -d "{\"password\":\"$PASS\"}" -w " del:%{http_code}\n"; rm -f "$JAR"
```

## Writing new tests
Assert real outcomes. Example regression guard already in the suite: modals must be opaque — `getComputedStyle('.agmodal').backgroundColor !== 'rgba(0, 0, 0, 0)'`. To prove a test catches a bug, run it against the buggy live bundle first (should fail), then deploy the fix and confirm green.
