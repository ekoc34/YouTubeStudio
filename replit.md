# YouTube Content Studio

A workspace for YouTube creators to research topics, organize ideas, use an AI strategist, and plan Shorts scripts and production projects.

## Run & Operate

- Install the locked workspace dependencies with `pnpm install --frozen-lockfile`.
- Start `artifacts/youtube-studio: web` and `artifacts/api-server: API Server` from Replit Workflows. The managed workflows provide the required `PORT` and `BASE_PATH`.
- For a fresh development database, run `pnpm --filter @workspace/db run push` to create/update the schema. This command is for the development database only.
- `pnpm run typecheck` — typecheck workspace packages.
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API clients and schemas after changing the OpenAPI specification.
- `YOUTUBE_API_KEY` enables live YouTube research; `OPENAI_API_KEY` enables AI strategy and analysis. `DATABASE_URL` is provided by Replit's managed PostgreSQL database.
- The `artifacts/mockup-sandbox: Component Preview Server` workflow is only needed for the component-preview canvas.

## Stack

- pnpm workspaces, Node.js 20, TypeScript 5.9
- Frontend: React, Vite, TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- API build: esbuild

## Where things live

- `artifacts/youtube-studio` — React/Vite application.
- `artifacts/api-server` — Express API.
- `lib/api-spec/openapi.yaml` — API contract source of truth.
- `lib/api-client-react` and `lib/api-zod` — generated client hooks and validation schemas.
- `lib/db/src/schema` — Drizzle database schema.
- `artifacts/mockup-sandbox` — isolated component preview canvas.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
