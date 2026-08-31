# Validation record

## Performed in the artifact-generation environment

The finalization pass checks:

- required service/package/infra files exist,
- no `new Function()` / `eval()` model-generated-code execution is present,
- Git whitespace validation (`git diff --check`),
- JSON package manifests parse,
- TypeScript/TSX source parses/transpiles syntactically using the available TypeScript compiler,
- workspace import/dependency consistency,
- Prisma model/table migration count and names are checked for drift,
- Python/Node helper scripts parse.

## Full build — confirmed clean

`pnpm install && pnpm build` passes cleanly across all 12 workspace packages from a fully fresh state (`dist/`, `packages/database/generated` removed first — not relying on any stale local cache). Confirmed repeatedly during today's deployment work, including inside the Cloud Build image builds for all 5 services. `pnpm --filter <pkg> typecheck` was run individually against every package touched during today's fixes.

The dependency-aware acceptance gate on a networked machine is:

```bash
corepack enable
pnpm install
pnpm db:generate
pnpm preflight
pnpm typecheck
pnpm test
pnpm build
docker compose up --build -d
node tests/demo-e2e.mjs
```

Cloud Build repeats the production image/deployment path on Google infrastructure.
