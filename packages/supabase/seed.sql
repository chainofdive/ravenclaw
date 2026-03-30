-- ============================================================================
-- Ravenclaw: Seed Data
-- ============================================================================
-- Populates the database with test data for local development.
-- Run after 00001_initial_schema.sql
-- ============================================================================

-- Fixed UUIDs for reproducible seeds
-- Workspace
-- Raw API key: rvc_sk_test1234567890abcdef
-- SHA-256 hash: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
-- (In production, use a real hash of the actual key)

-- ─── Workspace ──────────────────────────────────────────────────────────────

INSERT INTO workspaces (id, name, slug, description, settings) VALUES
  ('a0000000-0000-0000-0000-000000000001',
   'My Workspace',
   'my-workspace',
   'Default development workspace for Ravenclaw',
   '{"theme": "dark", "language": "ko"}');

-- ─── API Key ────────────────────────────────────────────────────────────────
-- Raw key: rvc_sk_test1234567890abcdef
-- key_prefix: rvc_sk_t (first 8 chars)
-- key_hash: SHA-256 of the raw key (pre-computed for test use)

INSERT INTO api_keys (id, workspace_id, key_hash, key_prefix, name, scopes) VALUES
  ('b0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   '786296d36bb6f93ba1679d574008e91e2e57760e5cdb2a0b1b08537b9bcec647',
   'rvc_sk_t',
   'Development API Key',
   ARRAY['read', 'write', 'admin']);

-- ─── Epics ──────────────────────────────────────────────────────────────────

INSERT INTO epics (id, workspace_id, key, title, description, status, priority, progress, started_at) VALUES
  ('c0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'EPIC-1',
   'MCP Server Integration',
   'Implement the Model Context Protocol server for AI agent communication. This includes tool definitions, resource handlers, and streaming support.',
   'active',
   'high',
   40,
   now() - interval '14 days'),

  ('c0000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000001',
   'EPIC-2',
   'CLI Tool Development',
   'Build a command-line interface for managing workspaces, epics, issues, and wiki pages. Should support both interactive and scripted usage.',
   'backlog',
   'medium',
   0,
   NULL);

-- ─── Issues ─────────────────────────────────────────────────────────────────

INSERT INTO issues (id, workspace_id, epic_id, key, title, description, status, priority, issue_type, assignee, labels, estimated_hours) VALUES
  -- Epic 1 issues
  ('d0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001',
   'ISSUE-1',
   'Define MCP tool schemas',
   'Create TypeScript schemas for all MCP tools: create_epic, update_issue, search_issues, etc.',
   'done',
   'high',
   'task',
   'chainofdive',
   ARRAY['mcp', 'schema'],
   4),

  ('d0000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001',
   'ISSUE-2',
   'Implement resource handlers',
   'Build resource handlers for workspace, epic, issue, and wiki_page resources.',
   'in_progress',
   'high',
   'task',
   'chainofdive',
   ARRAY['mcp', 'api'],
   8),

  ('d0000000-0000-0000-0000-000000000003',
   'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001',
   'ISSUE-3',
   'Add streaming support for long operations',
   'Implement SSE-based streaming for operations that take more than a few seconds.',
   'todo',
   'medium',
   'spike',
   NULL,
   ARRAY['mcp', 'performance'],
   6),

  -- Epic 2 issues
  ('d0000000-0000-0000-0000-000000000004',
   'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000002',
   'ISSUE-4',
   'Design CLI command structure',
   'Define the command hierarchy: ravenclaw epic list, ravenclaw issue create, etc.',
   'todo',
   'medium',
   'task',
   NULL,
   ARRAY['cli', 'design'],
   3),

  ('d0000000-0000-0000-0000-000000000005',
   'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000002',
   'ISSUE-5',
   'Fix incorrect status transition validation',
   'Currently allows transitioning from "done" back to "todo" which should not be permitted.',
   'todo',
   'high',
   'bug',
   NULL,
   ARRAY['cli', 'validation'],
   2),

  ('d0000000-0000-0000-0000-000000000006',
   'a0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001',
   'ISSUE-6',
   'Write MCP integration tests',
   'End-to-end tests for the MCP server using the official test harness.',
   'todo',
   'medium',
   'task',
   NULL,
   ARRAY['mcp', 'testing'],
   5);

-- ─── Dependencies ───────────────────────────────────────────────────────────

INSERT INTO dependencies (id, workspace_id, source_type, source_id, target_type, target_id, dependency_type) VALUES
  -- ISSUE-2 (resource handlers) depends on ISSUE-1 (tool schemas)
  ('e0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'issue',
   'd0000000-0000-0000-0000-000000000002',
   'issue',
   'd0000000-0000-0000-0000-000000000001',
   'depends_on'),

  -- ISSUE-6 (integration tests) blocks on ISSUE-2 (resource handlers)
  ('e0000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000001',
   'issue',
   'd0000000-0000-0000-0000-000000000006',
   'issue',
   'd0000000-0000-0000-0000-000000000002',
   'depends_on');

-- ─── Wiki Pages ─────────────────────────────────────────────────────────────

INSERT INTO wiki_pages (id, workspace_id, slug, title, content, summary, tags, linked_epics, version) VALUES
  ('f0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'architecture-overview',
   'Architecture Overview',
   '# Architecture Overview

Ravenclaw is a **personal work-context management SaaS** built as a monorepo.

## Stack
- **Runtime**: Node.js + TypeScript
- **Database**: PostgreSQL (Supabase)
- **ORM**: Drizzle ORM
- **Monorepo**: pnpm workspaces + Turborepo

## Packages
| Package | Description |
|---------|-------------|
| `@ravenclaw/core` | Shared types, DB schema, and domain logic |
| `@ravenclaw/api` | Hono-based REST API server |
| `@ravenclaw/mcp` | MCP server for AI agent integration |
| `@ravenclaw/cli` | Command-line interface |
| `@ravenclaw/supabase` | Database migrations and config |

## Data Flow
```
CLI / MCP Agent -> API Server -> Drizzle ORM -> PostgreSQL
```',
   'High-level architecture of the Ravenclaw monorepo',
   ARRAY['architecture', 'overview'],
   ARRAY['c0000000-0000-0000-0000-000000000001'::uuid, 'c0000000-0000-0000-0000-000000000002'::uuid],
   1),

  ('f0000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000001',
   'mcp-integration-guide',
   'MCP Integration Guide',
   '# MCP Integration Guide

## What is MCP?
The **Model Context Protocol** (MCP) allows AI agents (e.g., Claude) to interact with external tools and data sources in a structured way.

## Tools Provided
- `create_epic` - Create a new epic
- `list_issues` - List issues with filters
- `update_issue` - Update an issue''s fields
- `search` - Full-text search across entities
- `get_wiki_page` - Retrieve wiki content

## Authentication
All MCP requests require a valid API key passed via the `X-API-Key` header.

```bash
# Example: list issues via MCP
curl -H "X-API-Key: rvc_sk_..." http://localhost:3000/mcp/tools/list_issues
```',
   'How to use the MCP server for AI agent integration',
   ARRAY['mcp', 'guide', 'integration'],
   ARRAY['c0000000-0000-0000-0000-000000000001'::uuid],
   1),

  ('f0000000-0000-0000-0000-000000000003',
   'a0000000-0000-0000-0000-000000000001',
   'development-setup',
   'Development Setup',
   '# Development Setup

## Prerequisites
- Node.js >= 20
- pnpm >= 9
- Docker (for local Supabase)

## Getting Started

```bash
# Clone and install
git clone https://github.com/chainofdive/ravenclaw.git
cd ravenclaw
pnpm install

# Start local Supabase
docker compose up -d

# Run migrations
pnpm --filter @ravenclaw/core db:migrate

# Start development
pnpm dev
```

## Environment Variables
Copy `.env.example` to `.env` and fill in:
- `DATABASE_URL` - PostgreSQL connection string
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key',
   'How to set up the development environment',
   ARRAY['setup', 'development', 'getting-started'],
   NULL,
   1);

-- ─── Ontology Concepts ──────────────────────────────────────────────────────

INSERT INTO ontology_concepts (id, workspace_id, name, concept_type, description, aliases, frequency) VALUES
  ('10000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'Drizzle ORM',
   'technology',
   'TypeScript ORM for PostgreSQL with type-safe query building',
   ARRAY['drizzle', 'drizzle-orm'],
   5),

  ('10000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000001',
   'Model Context Protocol',
   'technology',
   'Protocol for AI agents to interact with external tools and data sources',
   ARRAY['MCP', 'mcp'],
   8),

  ('10000000-0000-0000-0000-000000000003',
   'a0000000-0000-0000-0000-000000000001',
   'Work Context Management',
   'domain',
   'Managing epics, issues, wiki pages, and knowledge graphs for personal/team productivity',
   ARRAY['project management', 'task management'],
   3),

  ('10000000-0000-0000-0000-000000000004',
   'a0000000-0000-0000-0000-000000000001',
   'Supabase',
   'technology',
   'Open-source Firebase alternative providing PostgreSQL, auth, storage, and edge functions',
   ARRAY['supabase'],
   4);

-- ─── Ontology Relations ─────────────────────────────────────────────────────

INSERT INTO ontology_relations (id, workspace_id, source_concept_id, target_concept_id, relation_type, strength, evidence) VALUES
  -- Drizzle ORM uses Supabase (as the database backend)
  ('20000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000004',
   'uses',
   0.80,
   '[{"source": "architecture", "context": "Drizzle ORM connects to Supabase PostgreSQL"}]'),

  -- MCP is part_of Work Context Management
  ('20000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000003',
   'part_of',
   0.70,
   '[{"source": "design", "context": "MCP enables AI agents to manage work context"}]'),

  -- Work Context Management depends_on Supabase
  ('20000000-0000-0000-0000-000000000003',
   'a0000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000003',
   '10000000-0000-0000-0000-000000000004',
   'depends_on',
   0.90,
   '[{"source": "architecture", "context": "All persistent data stored in Supabase PostgreSQL"}]');

-- ─── Activity Log (sample entries) ──────────────────────────────────────────

INSERT INTO activity_log (workspace_id, entity_type, entity_id, action, actor, changes) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'epic', 'c0000000-0000-0000-0000-000000000001',
   'created', 'chainofdive', '{"title": "MCP Server Integration"}'),

  ('a0000000-0000-0000-0000-000000000001', 'epic', 'c0000000-0000-0000-0000-000000000001',
   'status_changed', 'chainofdive', '{"from": "backlog", "to": "active"}'),

  ('a0000000-0000-0000-0000-000000000001', 'issue', 'd0000000-0000-0000-0000-000000000001',
   'status_changed', 'chainofdive', '{"from": "todo", "to": "done"}'),

  ('a0000000-0000-0000-0000-000000000001', 'wiki_page', 'f0000000-0000-0000-0000-000000000001',
   'created', 'chainofdive', '{"title": "Architecture Overview"}');
