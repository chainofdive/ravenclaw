# Ravenclaw

**Personal work context management for AI-powered development.**

Ravenclaw is a self-hosted system that gives AI coding agents persistent memory of your work context — epics, issues, wiki pages, and a knowledge ontology — so every conversation starts with full awareness of what you're building and why.

## Features

- **Epic & Issue Tracking** — Hierarchical epics with child issues, status workflows, priorities, dependencies, and progress tracking
- **Wiki** — Versioned knowledge base with slug-based addressing, tags, and linked epics/issues
- **Knowledge Ontology** — Auto-extracted concept graph (technologies, domains, patterns) with typed relations
- **MCP Server** — Model Context Protocol integration so AI agents can read/write your work context natively
- **CLI (`rc`)** — Full-featured command-line interface for managing everything from the terminal
- **REST API** — Hono-based API server with workspace isolation and API key authentication
- **Context Dump** — Single-call endpoint that aggregates your entire active work context for agent handoff
- **PostgreSQL + Supabase** — Direct Postgres or managed Supabase as your backing store

## Architecture

```
                         +-----------+
                         | PostgreSQL|
                         +-----+-----+
                               |
                    +----------+----------+
                    |                     |
              +-----+------+    +--------+--------+
              | @ravenclaw |    |   Supabase      |
              |    /core   |    |   (optional)    |
              +-----+------+    +-----------------+
                    |
       +------------+------------+
       |            |            |
+------+---+ +-----+----+ +----+------+
| @ravenclaw| |@ravenclaw| |@ravenclaw |
|   /api    | |  /cli    | |   /mcp    |
+------+---+ +-----+----+ +----+------+
       |            |            |
   REST API     `rc` CLI    MCP stdio
  (Hono)      (Commander)   (AI agents)
```

| Package | Description |
|---------|-------------|
| `@ravenclaw/core` | Database schema (Drizzle ORM), services, types, and validation |
| `@ravenclaw/api` | REST API server built on Hono with workspace-scoped endpoints |
| `@ravenclaw/cli` | Terminal interface (`rc` command) using Commander.js |
| `@ravenclaw/mcp` | MCP server for AI agent integration via stdio transport |

## Quick Start

### Prerequisites

- Node.js >= 22.0.0
- pnpm >= 9.0.0
- Docker (for PostgreSQL)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/chainofdive/ravenclaw.git
cd ravenclaw

# 2. Start PostgreSQL
docker-compose up -d

# 3. Configure environment
cp .env.example .env

# 4. Install dependencies and build
pnpm install
pnpm build

# 5. Run database migrations
pnpm db:migrate

# 6. Start the API server
pnpm --filter @ravenclaw/api start

# 7. Configure the CLI
rc init
```

## CLI Reference

The CLI is invoked as `rc` (or `ravenclaw`).

| Command | Description |
|---------|-------------|
| `rc init` | Configure CLI connection (API URL, API key, workspace) |
| `rc epic list` | List all epics (filter by `--status`, `--priority`) |
| `rc epic create <title>` | Create a new epic |
| `rc epic show <key>` | Show epic details with issue tree |
| `rc epic update <key>` | Update epic fields (status, priority, title, etc.) |
| `rc epic delete <key>` | Delete an epic |
| `rc issue list` | List issues (filter by `--epic`, `--status`, `--priority`, `--assignee`) |
| `rc issue create <epic-key> <title>` | Create an issue under an epic |
| `rc issue show <key>` | Show issue details |
| `rc issue update <key>` | Update issue fields |
| `rc issue start <key>` | Set issue status to `in_progress` |
| `rc issue done <key>` | Set issue status to `done` |
| `rc wiki list` | List wiki pages |
| `rc wiki read <slug>` | Read wiki page content |
| `rc wiki write <slug>` | Create/update wiki page (reads content from stdin) |
| `rc wiki search <query>` | Search wiki pages |
| `rc wiki history <slug>` | Show version history |
| `rc context` | Dump full work context (for agent handoff) |
| `rc context changes --since <ISO>` | Show changes since a timestamp |
| `rc ontology show` | Show knowledge graph concepts and relations |
| `rc ontology rebuild` | Trigger full ontology rebuild |
| `rc search <query>` | Unified search across epics, issues, and wiki |

All list/show commands support `--format table|json|markdown`.

## MCP Integration

Add Ravenclaw to your Claude Code configuration to give AI agents access to your work context.

Add to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "ravenclaw": {
      "command": "npx",
      "args": ["ravenclaw-mcp"],
      "env": {
        "RAVENCLAW_API_URL": "http://localhost:3000",
        "RAVENCLAW_API_KEY": "rc_your-api-key"
      }
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `get_work_context` | Full current work context (active epics, in-progress issues, recent activity) |
| `get_work_context_summary` | Compact summary for token efficiency |
| `list_epics` | List epics with optional filters |
| `get_epic` | Get epic details with full issue tree |
| `create_epic` | Create a new epic |
| `update_epic` | Update an existing epic |
| `list_issues` | List issues with filters |
| `get_issue` | Get issue details |
| `create_issue` | Create an issue under an epic |
| `update_issue` | Update an existing issue |
| `start_issue` | Mark issue as in_progress |
| `complete_issue` | Mark issue as done |
| `read_wiki` | Read a wiki page by slug |
| `write_wiki` | Create or update a wiki page |
| `search_wiki` | Search wiki pages |
| `list_wiki_pages` | List all wiki pages |
| `get_ontology` | Get the knowledge graph |
| `rebuild_ontology` | Trigger ontology rebuild |
| `search` | Unified search across all entities |

## Claude Code Skill

Ravenclaw includes a Claude Code skill for quick context loading. Copy the skill to your project:

```bash
cp -r skills/ravenclaw-context .claude/skills/
```

Then invoke with `/ravenclaw-context` in Claude Code to load your work context at the start of any session.

### Custom Agent

A custom agent definition is also provided:

```bash
cp .claude/agents/ravenclaw.md your-project/.claude/agents/
```

This configures Claude Code to automatically work with Ravenclaw for task management.

## API Endpoints

All endpoints are under `/api/v1` and require an API key via the `Authorization` header.

### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/health` | Health check |

### Epics

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/epics` | List epics |
| `POST` | `/api/v1/epics` | Create epic |
| `GET` | `/api/v1/epics/:id` | Get epic |
| `PUT` | `/api/v1/epics/:id` | Update epic |
| `DELETE` | `/api/v1/epics/:id` | Delete epic |
| `GET` | `/api/v1/epics/:id/tree` | Get epic with issue tree |
| `GET` | `/api/v1/epics/:id/progress` | Get calculated progress |

### Issues

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/issues` | List issues |
| `POST` | `/api/v1/issues` | Create issue |
| `GET` | `/api/v1/issues/:id` | Get issue |
| `PUT` | `/api/v1/issues/:id` | Update issue |
| `DELETE` | `/api/v1/issues/:id` | Delete issue |
| `POST` | `/api/v1/issues/:id/start` | Mark as in_progress |
| `POST` | `/api/v1/issues/:id/done` | Mark as done |

### Wiki

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/wiki` | List wiki pages |
| `POST` | `/api/v1/wiki` | Create wiki page |
| `GET` | `/api/v1/wiki/by-slug/:slug` | Get page by slug |
| `GET` | `/api/v1/wiki/:id` | Get page by ID |
| `PUT` | `/api/v1/wiki/:id` | Update wiki page |
| `GET` | `/api/v1/wiki/:id/history` | Get version history |

### Context

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/context` | Full aggregated work context |
| `GET` | `/api/v1/context/summary` | Compact context summary |
| `GET` | `/api/v1/context/changes?since=` | Changes since timestamp |

### Ontology

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/ontology/concepts` | List concepts |
| `GET` | `/api/v1/ontology/graph` | Get full knowledge graph |
| `POST` | `/api/v1/ontology/rebuild` | Trigger rebuild |

### Dependencies

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/dependencies` | Get dependencies for an entity |
| `POST` | `/api/v1/dependencies` | Create dependency |
| `DELETE` | `/api/v1/dependencies/:id` | Delete dependency |

### Search

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/search?q=` | Unified search |

## Database

Ravenclaw uses PostgreSQL as its primary data store, with [Drizzle ORM](https://orm.drizzle.team/) for schema management and queries.

**Direct PostgreSQL** — Use the included `docker-compose.yml` for local development:

```bash
docker-compose up -d
```

**Supabase** — Optionally use a managed Supabase instance by setting `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in your `.env` file. See `.env.example` for details.

### Data Model

- **Workspaces** — Top-level isolation boundary with settings and API keys
- **Epics** — High-level work items with status, priority, hierarchy, and target dates
- **Issues** — Granular tasks under epics with types (task/bug/spike/story), assignees, and time tracking
- **Dependencies** — Cross-entity relationships (blocks, depends_on, relates_to)
- **Wiki Pages** — Versioned documents with tags and entity linking
- **Ontology** — Concepts (technology/domain/pattern/person/system) connected by typed relations
- **Activity Log** — Audit trail of all entity changes

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all packages in dev mode (watch)
pnpm dev

# Type-check all packages
pnpm typecheck

# Run tests
pnpm test

# Clean build artifacts
pnpm clean
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed development guidelines.

## License

[Apache 2.0](./LICENSE)
