# Repository Guidelines

## Project Structure & Module Organization

Cadence is a Next.js 16 App Router application written in strict TypeScript. Route pages and HTTP handlers live in `src/app/`; dashboard features are grouped under `src/app/(protected)/`, while API and MCP endpoints are under `src/app/api/`. Reusable UI belongs in feature folders under `src/components/`, hooks in `src/hooks/`, and shared logic in `src/lib/`. Database schema code is in `src/lib/db/schema.ts`; generated Drizzle migrations belong in `drizzle/`. Keep tests beside their subject in `__tests__/` directories or as `*.test.ts(x)`. Static landing assets are in `landing/`, and contributor documentation is in `docs/`.

## Build, Test, and Development Commands

- `npm install`: install dependencies from `package-lock.json`.
- `npm run dev`: start the local dashboard and APIs with Next.js.
- `npm run build`: create the production standalone build.
- `npm run lint`: run ESLint with Next.js Core Web Vitals and TypeScript rules.
- `npm test`: run the Vitest suite once; use `npm run test:watch` while developing.
- `npm run test:coverage`: produce test coverage.
- `npm run db:generate` / `npm run db:migrate`: generate migrations after schema changes and apply them.

Copy required values from `.env.example` into `.env.local` before local development. Never commit secrets or production credentials.

## Coding Style & Naming Conventions

Follow existing TypeScript and React patterns: two-space indentation, semicolons, double quotes, and the `@/` alias for `src/`. Use `PascalCase` for React components and their files, `camelCase` for functions and variables, and kebab-case for route directories. Keep domain-specific MCP tools, queries, and resources in the matching `src/lib/mcp/` subdirectory. Prefer small, typed modules and validate external input with Zod.

## Testing Guidelines

Vitest runs in `jsdom` with React Testing Library setup from `src/test/setup.ts`. Name tests `*.test.ts` or `*.test.tsx`; shared database and MCP fixtures live in `src/test/`. Add regression tests for bug fixes and cover API/MCP behavior at domain boundaries. Run `npm test`, `npm run lint`, and `npm run build` before submitting.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commit-style subjects such as `feat(tasks): ...`, `fix(pwa): ...`, and `chore(release): ...`. Use an imperative, concise subject with a relevant scope. Pull requests should explain behavior and data-model changes, link related issues, list verification commands, and include screenshots for visible UI updates. Commit generated migration SQL with its schema change and document new environment variables.
