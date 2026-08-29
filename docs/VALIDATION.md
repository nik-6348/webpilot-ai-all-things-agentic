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

## Environment limitation

A fresh package-manager install and dependency-aware `pnpm typecheck/test/build` cannot be executed in the generation container because DNS resolution for `registry.npmjs.org` returns `EAI_AGAIN`. That is an environment/network limitation, not represented as a successful build.

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
