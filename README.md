# Ravenclaw

**Personal work context management for AI-powered development.**

Ravenclaw is a self-hosted system that gives AI coding agents persistent memory of your work context. It tracks projects, epics, issues, wiki pages, and a knowledge ontology — so every agent session starts with full awareness of what you're building, what's been done, and what to do next.

## Key Features

- **Project → Epic → Issue** — Three-level hierarchy: projects (products/games), epics (phases/milestones), issues (tasks)
- **Agent Orchestration** — Dispatch work to agents from a web UI, monitor progress in real-time, view execution logs
- **Human-in-the-Loop** — Agents can ask questions; users answer via the web dashboard
- **Context Handoff** — Agents save progress snapshots; new sessions pick up where the last one left off
- **Dependency Graph** — Epic-to-epic and issue-to-issue dependencies with visual graph view
- **MCP Server** — 40+ tools for AI agent integration via Model Context Protocol
- **CLI (`rc`)** — Full command-line interface for all operations
- **Web Dashboard** — Project management UI with graph view, command panel, and real-time monitoring
- **Wiki & Ontology** — Versioned knowledge base with auto-extracted concept graph
- **Session Locking** — Epic-level locks prevent concurrent agent conflicts

## Architecture

```
┌─────────────┐
│ Web Dashboard│  React + Tailwind + ReactFlow
└──────┬───────┘
       │
┌──────┴───────┐     ┌──────────┐     ┌──────────┐
│  API Server  │────│ PostgreSQL│     │  AI Agent │
│  (Hono)      │     └──────────┘     │           │
└──┬───┬───┬───┘                      └─────┬─────┘
   │   │   │                                │
   │   │   └── Process Manager ─────────────┘
   │   │       (spawn/monitor claude)
   │   │
   │   └── REST API (/api/v1/*)
   │
   └── SSE (/api/v1/sse/logs/*)
        (real-time log streaming)

┌──────────┐     ┌──────────┐
│ MCP Server│     │ CLI (rc) │
│ (stdio)   │     │(Commander)│
└──────────┘     └──────────┘
```

| Package | Description |
|---------|-------------|
| `@ravenclaw/core` | DB schema (Drizzle ORM), services, types, validation |
| `@ravenclaw/api` | Hono REST API + Process Manager + SSE streaming |
| `@ravenclaw/cli` | Terminal interface (`rc` command) |
| `@ravenclaw/mcp` | MCP server for AI agent integration (40+ tools) |
| `@ravenclaw/web` | React web dashboard with graph view and command panel |

## Data Model

```
Workspace
  └─ Project (RC-P1: SURVIVE)          ← product/game/campaign
       │  directory: /path/to/survive   ← agents run in this directory
       ├─ Epic (RC-E10: Phase 1)       ← phase/milestone (depends_on other epics)
       │    ├─ Issue (RC-I26: Card data)  ← individual task
       │    └─ Issue (RC-I27: Deck mgr)   ← depends_on RC-I26
       ├─ Epic (RC-E11: Phase 2)       ← depends_on RC-E10
       │    └─ Issue (RC-I35: Rounds)
       └─ ...

  └─ Agent (claude-code | gemini-cli | codex)
       └─ Directives → dispatched to project directory
```

Additional entities: Wiki pages, Ontology (concepts + relations), Comments, Dependencies, Work sessions, Context snapshots, Human input requests, Conversations (persistent chat with DB storage), Work directives.

## Quick Start

See [docs/SETUP.md](./docs/SETUP.md) for detailed initial setup.

```bash
git clone https://github.com/chainofdive/ravenclaw.git
cd ravenclaw
pnpm install && pnpm build

# Start PostgreSQL + run migrations
docker-compose up -d
pnpm db:push

# Start API server
source .env && DATABASE_URL="$DATABASE_URL" node packages/api/dist/index.js

# Configure CLI
rc init

# Start web dashboard (dev mode)
pnpm --filter @ravenclaw/web dev
```

## Web Dashboard

The dashboard provides a project-centric workspace — like a web version of tmux for AI agents.

**Projects page (3-panel layout):**
- Left: Project list (resizable, shows project key + status)
- Center: Content area with List / Graph / History tabs
- Right: Command panel (slide-in overlay, resizable, fullscreen mode)

**Interactive Chat (Command Panel):**
- Real-time streaming conversation with AI agents (SSE)
- Conversation continuity via `claude --resume` (session preserved across messages)
- Persistent chat history stored in DB (survives server restart)
- Session selector — switch between past conversations or start new ones
- File path auto-detection — clickable links to preview md/images/PDF
- Support for Claude Code, Gemini CLI, Codex agents
- Permission mode control: auto-approve, bypass, accept-edits, interactive
- Tool activity indicator — shows "Running: Bash", "Running: Edit" etc. during execution
- Fullscreen mode for focused work
- Stop button to cancel running responses

**Detail Panel (click-to-view):**
- Click any project name, epic title, or issue row to open slide-in detail panel
- Works in list view, graph view (click nodes), and issues table
- Inline editing: click title or description to edit in place
- Shows all metadata: status, priority, type, assignee, labels, dates
- Comments section embedded for epics and issues

**Other Features:**
- Graph view with animated nodes (in_progress issues glow blue), clickable for details
- Epic progress auto-calculated from issue status (updates on every change)
- History tab: context snapshots and work session timeline
- Human input requests: agents ask questions, users answer via web UI
- Agents page: register/manage agents with type selection
- Collapsible sidebar, resizable panels
- File preview modal: markdown rendering, image display, PDF viewer

## Agent Workflow

See [docs/SESSION_GUIDE.md](./docs/SESSION_GUIDE.md) for full session guide.

```
Agent starts
  │
  ├─ get_latest_context(RC-P1)      ← load previous handoff
  ├─ start_work_session(...)        ← record session
  ├─ get_project(RC-P1)             ← see project tree
  │
  ├─ start_issue(RC-I26)            ← work on task
  ├─ ... coding ...
  ├─ complete_issue(RC-I26)
  ├─ save_context(RC-P1, "...")     ← save progress
  │
  ├─ request_human_input(...)       ← ask user if needed
  ├─ check_human_input(...)         ← poll for answer
  │
  └─ end_work_session(...)          ← close session
```

## CLI Reference

```bash
# Projects (--directory for working dir, --priority, --status)
rc project create "SURVIVE" --directory /path/to/survive --priority high
rc project list / show / update / delete

# Epics
rc epic list / show / create / update / delete

# Issues
rc issue list / create / start / done / delete

# Context & Snapshots
rc context                          # full work context
rc context save RC-P1 "progress..." # save snapshot
rc context latest RC-P1             # latest snapshot
rc context history RC-P1            # snapshot history

# Sessions
rc session start / end / list

# Other
rc wiki list / search
rc search "keyword"
rc comment list / add
rc lock list / acquire / release
rc ontology show / rebuild
```

## MCP Tools (40+)

| Category | Tools |
|----------|-------|
| **Projects** | list_projects, get_project, create_project, update_project, delete_project |
| **Epics** | list_epics, get_epic, create_epic, update_epic, delete_epic |
| **Issues** | list_issues, get_issue, create_issue, update_issue, delete_issue, start_issue, complete_issue |
| **Dependencies** | add_dependency, list_dependencies, remove_dependency |
| **Context** | get_work_context, get_work_context_summary |
| **Sessions** | save_context, get_latest_context, list_context_snapshots, start_work_session, end_work_session, list_work_sessions |
| **Human Input** | request_human_input, check_human_input, list_pending_inputs |
| **Wiki** | list_wiki_pages, get_wiki_page, create_wiki_page, update_wiki_page |
| **Other** | search, list_comments, add_comment, acquire_lock, release_lock, get_ontology, rebuild_ontology |

## API Endpoints

All endpoints under `/api/v1`, authenticated via `Authorization: Bearer <api-key>`.

| Group | Endpoints |
|-------|-----------|
| Health | `GET /health` |
| Projects | `GET/POST /projects`, `GET/PUT/DELETE /projects/:id`, `GET /projects/:id/tree` |
| Epics | `GET/POST /epics`, `GET/PUT/DELETE /epics/:id`, `GET /epics/:id/tree` |
| Issues | `GET/POST /issues`, `GET/PUT/DELETE /issues/:id`, `POST /issues/:id/start\|done` |
| Dependencies | `GET/POST /dependencies`, `DELETE /dependencies/:id` |
| Wiki | `GET/POST /wiki`, `GET/PUT /wiki/:id`, `GET /wiki/:id/history` |
| Context | `GET /context`, `GET /context/summary`, `GET /context/changes` |
| Sessions | `POST /sessions`, `PUT /sessions/:id/end`, `GET /sessions` |
| Snapshots | `POST /sessions/snapshots`, `GET /sessions/snapshots/latest`, `GET /sessions/snapshots` |
| Input Requests | `POST /input-requests`, `GET /input-requests/waiting`, `PUT /input-requests/:id/answer` |
| Agents | `GET/POST /agents`, `DELETE /agents/:id` |
| Directives | `POST /agents/directives`, `POST /agents/directives/:id/dispatch`, `GET /agents/directives/:id/logs` |
| Conversations | `GET /conversations/:projectId/list`, `POST .../new`, `POST .../message`, `GET .../stream` (SSE), `GET .../history` |
| Files | `GET /files?path=...&project_id=...` (serve project files), `GET /files/info` |
| SSE | `GET /sse/logs/:directiveId`, `GET /conversations/:id/stream?token=...` |
| Locks | `POST/DELETE/GET /epics/:id/lock`, `GET /locks` |
| Ontology | `GET /ontology/concepts`, `GET /ontology/graph`, `POST /ontology/rebuild` |
| Search | `GET /search?q=` |
| Comments | `GET/POST /comments`, `DELETE /comments/:id` |

## Testing

```bash
# E2E tests (Playwright)
cd packages/web && pnpm test:e2e

# 14 tests covering: Dashboard, Projects (list/graph/command/history),
# Issues, Agents, Human Input flow, Navigation, Wiki, Context
```

## Documentation

- [docs/SETUP.md](./docs/SETUP.md) — Initial installation and configuration
- [docs/SESSION_GUIDE.md](./docs/SESSION_GUIDE.md) — How to connect agents to Ravenclaw

## License

[Apache 2.0](./LICENSE)
