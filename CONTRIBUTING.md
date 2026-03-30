# Contributing to Ravenclaw

Thanks for your interest in contributing! This guide covers how to set up the project for local development and the conventions we follow.

## Development Setup

### Prerequisites

- **Node.js** >= 22.0.0
- **pnpm** >= 9.0.0 (we use pnpm workspaces)
- **Docker** (for PostgreSQL)

### Getting Started

```bash
# Clone the repo
git clone https://github.com/chainofdive/ravenclaw.git
cd ravenclaw

# Start the database
docker-compose up -d

# Copy environment config
cp .env.example .env

# Install dependencies
pnpm install

# Build all packages (core must build first — turbo handles ordering)
pnpm build

# Run database migrations
pnpm db:migrate

# Start the API server in dev mode (auto-reload)
pnpm --filter @ravenclaw/api dev
```

## Project Structure

```
ravenclaw/
├── packages/
│   ├── core/       # Shared: DB schema (Drizzle), services, types, validation (Zod)
│   ├── api/        # REST API server (Hono + @hono/node-server)
│   ├── cli/        # CLI tool (Commander.js, chalk, ora)
│   └── mcp/        # MCP server (@modelcontextprotocol/sdk)
├── scripts/        # Utility scripts (DB init, seed, etc.)
├── docker-compose.yml
├── turbo.json      # Turborepo task pipeline
└── pnpm-workspace.yaml
```

### Package Dependencies

```
@ravenclaw/core  ← no internal deps (foundation layer)
@ravenclaw/api   ← depends on @ravenclaw/core
@ravenclaw/cli   ← standalone (talks to API over HTTP)
@ravenclaw/mcp   ← standalone (talks to API over HTTP)
```

`@ravenclaw/api` imports from `@ravenclaw/core` directly. The CLI and MCP packages communicate with the API server over HTTP — they have no compile-time dependency on core.

## Code Style

### TypeScript

- **Strict mode** is enabled across all packages
- Use **ESM** (`"type": "module"` in package.json)
- Use **`.js` extensions** in import paths (required for ESM resolution):
  ```typescript
  // Correct
  import { foo } from './utils.js';

  // Wrong
  import { foo } from './utils';
  ```
- Prefer `interface` for object shapes, `type` for unions and intersections
- Use Zod for runtime validation at API boundaries

### Formatting

- No trailing semicolons in imports are enforced — follow the existing file's convention
- Use double quotes for strings (configured in the project)
- 2-space indentation

## Making Changes

### Branch Naming

Use descriptive branch names:

```
feat/wiki-search
fix/epic-progress-calculation
refactor/cli-output-formatting
```

### Commit Messages

Write clear, imperative commit messages:

```
Add wiki page version history endpoint
Fix epic progress calculation for nested issues
Refactor CLI output formatters to support markdown
```

### Pull Requests

1. Create a feature branch from `main`
2. Make your changes with clear, focused commits
3. Ensure all checks pass:
   ```bash
   pnpm typecheck
   pnpm test
   ```
4. Open a PR with a clear description of what and why
5. Add a changeset if your change affects a published package:
   ```bash
   pnpm changeset
   ```

## Testing

We use [Vitest](https://vitest.dev/) for testing across all packages.

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @ravenclaw/core test
pnpm --filter @ravenclaw/api test

# Run tests in watch mode
pnpm --filter @ravenclaw/core test -- --watch
```

### Writing Tests

- Place test files next to the code they test, using the `.test.ts` suffix
- For API route tests, test against the Hono app directly (no need to start a server)
- For service tests, use a real database connection when possible

## Database

### Schema Changes

The database schema lives in `packages/core/src/db/schema.ts` using Drizzle ORM.

```bash
# After modifying schema.ts, generate a migration
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Or push schema directly (dev only — skips migration files)
pnpm db:push
```

### Adding a New Entity

1. Define the table and relations in `packages/core/src/db/schema.ts`
2. Create Zod input schemas in `packages/core/src/types/`
3. Add a service in `packages/core/src/services/`
4. Add API routes in `packages/api/src/routes/`
5. Add CLI commands in `packages/cli/src/commands/`
6. Add MCP tools in `packages/mcp/src/tools/`
7. Generate and apply a migration

## Build System

We use [Turborepo](https://turbo.build/) to orchestrate builds across packages. Key tasks:

| Command | Description |
|---------|-------------|
| `pnpm build` | Build all packages (respects dependency order) |
| `pnpm dev` | Start all packages in watch mode |
| `pnpm typecheck` | Type-check all packages |
| `pnpm test` | Run all tests |
| `pnpm clean` | Remove all `dist/` directories |

Turbo caches build outputs — if nothing changed, subsequent builds are near-instant.

## Questions?

Open an issue on the [GitHub repository](https://github.com/chainofdive/ravenclaw/issues) and we'll be happy to help.
