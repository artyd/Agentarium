---
name: add-feature
description: Add a new end-to-end feature to Agentarium (data field, endpoint, and UI). Use when implementing a feature that spans the server and web app so nothing in the chain is missed.
---

# Add an Agentarium feature (full-stack checklist)

A feature usually touches this chain in order. Skipping a link is the most common source of bugs.

## Backend (`server/`)
1. **Schema** — edit `prisma/schema.prisma`. If you added/changed a column, author a migration via the `db-migration` skill (no local DB), then `npx prisma generate`.
2. **Serialize** — update `src/lib/serialize.ts` (`postInclude`, `serializePost`, `serializeComment`) so the API returns the new shape.
3. **Route** — add/extend a handler in `src/routes/*.ts`. Remember: local imports use `.js` extensions; sanitize user HTML (`lib/sanitize.ts`); emit realtime (`lib/realtime.ts`) and notifications (`lib/notify.ts`) where relevant; rate-limit sensitive endpoints.
4. `cd server && npm run build` must pass.

## Frontend (`web/`)
5. **Types** — mirror the new API shape in `src/api/types.ts`.
6. **UI** — build with existing prototype classes (`.chunk`, `.btnp`, `.btng`, `.chip`, `.field2`, `.finput`). Overlays use `components/Modal.tsx` (portals into `.app`). Do NOT edit `styles/app.css`; additive tweaks go in `styles/extra.css`.
7. **i18n** — add every string in BOTH `ua` and `en` in `src/i18n/strings.ts`.
8. `cd web && npm run build` must pass; note the bundle hash.

## Verify & ship
9. Add/extend a Playwright test (`run-e2e` skill) asserting the real outcome.
10. Deploy (`deploy` skill): push to `main`, watch CI, confirm the live bundle hash + health, tell the user to Ctrl+F5.

Keep design 1-to-1 with the prototype and light-theme only.
