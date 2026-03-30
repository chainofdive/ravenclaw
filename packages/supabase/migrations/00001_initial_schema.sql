-- ============================================================================
-- Ravenclaw: Initial Schema Migration
-- ============================================================================
-- Converts the Drizzle ORM schema (packages/core/src/db/schema.ts) to raw SQL.
-- Target: PostgreSQL 15+ / Supabase
-- ============================================================================

-- ─── Extensions ─────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- fuzzy / trigram search
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- uuid_generate_v4 fallback

-- ─── Enum Types ─────────────────────────────────────────────────────────────

CREATE TYPE epic_status AS ENUM ('backlog', 'active', 'completed', 'cancelled');
CREATE TYPE issue_status AS ENUM ('todo', 'in_progress', 'in_review', 'done', 'cancelled');
CREATE TYPE priority AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE issue_type AS ENUM ('task', 'bug', 'spike', 'story');
CREATE TYPE dependency_type AS ENUM ('blocks', 'depends_on', 'relates_to');
CREATE TYPE entity_type AS ENUM ('epic', 'issue', 'wiki_page', 'concept');
CREATE TYPE activity_action AS ENUM ('created', 'updated', 'status_changed', 'deleted');
CREATE TYPE concept_type AS ENUM ('technology', 'domain', 'pattern', 'person', 'system', 'custom');
CREATE TYPE relation_type AS ENUM ('uses', 'part_of', 'depends_on', 'related_to', 'instance_of');

-- ─── Tables ─────────────────────────────────────────────────────────────────

-- Workspaces
CREATE TABLE workspaces (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  slug       VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  settings   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- API Keys
CREATE TABLE api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key_hash     VARCHAR(64) NOT NULL,
  key_prefix   VARCHAR(8)  NOT NULL,
  name         VARCHAR(255) NOT NULL,
  scopes       TEXT[],
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Epics
CREATE TABLE epics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_epic_id  UUID REFERENCES epics(id) ON DELETE SET NULL,
  key             VARCHAR(20) NOT NULL,
  title           VARCHAR(500) NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  status          epic_status NOT NULL DEFAULT 'backlog',
  priority        priority NOT NULL DEFAULT 'medium',
  progress        SMALLINT NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}',
  started_at      TIMESTAMPTZ,
  target_date     TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Issues
CREATE TABLE issues (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  epic_id          UUID NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  parent_issue_id  UUID REFERENCES issues(id) ON DELETE SET NULL,
  key              VARCHAR(20) NOT NULL,
  title            VARCHAR(500) NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  status           issue_status NOT NULL DEFAULT 'todo',
  priority         priority NOT NULL DEFAULT 'medium',
  issue_type       issue_type NOT NULL DEFAULT 'task',
  assignee         VARCHAR(255),
  labels           TEXT[],
  metadata         JSONB NOT NULL DEFAULT '{}',
  estimated_hours  NUMERIC,
  actual_hours     NUMERIC,
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dependencies
CREATE TABLE dependencies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_type     entity_type NOT NULL,
  source_id       UUID NOT NULL,
  target_type     entity_type NOT NULL,
  target_id       UUID NOT NULL,
  dependency_type dependency_type NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_dependency UNIQUE (source_type, source_id, target_type, target_id, dependency_type)
);

-- Wiki Pages
CREATE TABLE wiki_pages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES wiki_pages(id) ON DELETE SET NULL,
  slug          VARCHAR(500) NOT NULL,
  title         VARCHAR(500) NOT NULL,
  content       TEXT NOT NULL DEFAULT '',
  summary       TEXT,
  tags          TEXT[],
  linked_epics  UUID[],
  linked_issues UUID[],
  version       INTEGER NOT NULL DEFAULT 1,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_wiki_workspace_slug UNIQUE (workspace_id, slug)
);

-- Wiki Page Versions
CREATE TABLE wiki_page_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wiki_page_id   UUID NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
  version        INTEGER NOT NULL,
  content        TEXT NOT NULL,
  change_summary VARCHAR(500),
  changed_by     VARCHAR(255),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ontology Concepts
CREATE TABLE ontology_concepts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  concept_type  concept_type NOT NULL,
  description   TEXT,
  aliases       TEXT[],
  source_refs   JSONB NOT NULL DEFAULT '[]',
  frequency     INTEGER NOT NULL DEFAULT 1,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ontology Relations
CREATE TABLE ontology_relations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_concept_id UUID NOT NULL REFERENCES ontology_concepts(id) ON DELETE CASCADE,
  target_concept_id UUID NOT NULL REFERENCES ontology_concepts(id) ON DELETE CASCADE,
  relation_type     relation_type NOT NULL,
  strength          NUMERIC(3,2) NOT NULL DEFAULT 0.5,
  evidence          JSONB NOT NULL DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activity Log
CREATE TABLE activity_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type   entity_type NOT NULL,
  entity_id     UUID NOT NULL,
  action        activity_action NOT NULL,
  actor         VARCHAR(255) NOT NULL,
  changes       JSONB NOT NULL DEFAULT '{}',
  context       JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ────────────────────────────────────────────────────────────────

-- Workspace lookups
CREATE INDEX idx_workspaces_slug ON workspaces (slug);

-- API Keys
CREATE INDEX idx_api_keys_workspace ON api_keys (workspace_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys (key_hash);

-- Epics: workspace scoping, tree traversal, status queries
CREATE INDEX idx_epics_workspace ON epics (workspace_id);
CREATE INDEX idx_epics_parent ON epics (parent_epic_id) WHERE parent_epic_id IS NOT NULL;
CREATE INDEX idx_epics_workspace_status ON epics (workspace_id, status);
CREATE INDEX idx_epics_workspace_key ON epics (workspace_id, key);

-- Issues: workspace scoping, epic grouping, tree traversal, status/type queries
CREATE INDEX idx_issues_workspace ON issues (workspace_id);
CREATE INDEX idx_issues_epic ON issues (epic_id);
CREATE INDEX idx_issues_parent ON issues (parent_issue_id) WHERE parent_issue_id IS NOT NULL;
CREATE INDEX idx_issues_workspace_status ON issues (workspace_id, status);
CREATE INDEX idx_issues_workspace_key ON issues (workspace_id, key);
CREATE INDEX idx_issues_assignee ON issues (workspace_id, assignee) WHERE assignee IS NOT NULL;

-- Dependencies: source/target lookups
CREATE INDEX idx_deps_source ON dependencies (source_type, source_id);
CREATE INDEX idx_deps_target ON dependencies (target_type, target_id);
CREATE INDEX idx_deps_workspace ON dependencies (workspace_id);

-- Wiki Pages: workspace scoping, tree traversal
CREATE INDEX idx_wiki_workspace ON wiki_pages (workspace_id);
CREATE INDEX idx_wiki_parent ON wiki_pages (parent_id) WHERE parent_id IS NOT NULL;

-- Wiki Page Versions: page history
CREATE INDEX idx_wiki_versions_page ON wiki_page_versions (wiki_page_id, version);

-- Ontology: workspace scoping, type lookups
CREATE INDEX idx_onto_concepts_workspace ON ontology_concepts (workspace_id);
CREATE INDEX idx_onto_concepts_type ON ontology_concepts (workspace_id, concept_type);
CREATE INDEX idx_onto_relations_workspace ON ontology_relations (workspace_id);
CREATE INDEX idx_onto_relations_source ON ontology_relations (source_concept_id);
CREATE INDEX idx_onto_relations_target ON ontology_relations (target_concept_id);

-- Activity Log: time-series queries, entity lookups
CREATE INDEX idx_activity_workspace_time ON activity_log (workspace_id, created_at DESC);
CREATE INDEX idx_activity_entity ON activity_log (entity_type, entity_id);

-- ─── Full-text Search (GIN) ────────────────────────────────────────────────

-- Full-text search on epics (title + description)
CREATE INDEX idx_epics_fts ON epics
  USING GIN (to_tsvector('english', title || ' ' || description));

-- Full-text search on issues (title + description)
CREATE INDEX idx_issues_fts ON issues
  USING GIN (to_tsvector('english', title || ' ' || description));

-- Full-text search on wiki pages (title + content)
CREATE INDEX idx_wiki_fts ON wiki_pages
  USING GIN (to_tsvector('english', title || ' ' || content));

-- Trigram indexes for fuzzy search (requires pg_trgm)
CREATE INDEX idx_epics_title_trgm ON epics USING GIN (title gin_trgm_ops);
CREATE INDEX idx_issues_title_trgm ON issues USING GIN (title gin_trgm_ops);
CREATE INDEX idx_wiki_title_trgm ON wiki_pages USING GIN (title gin_trgm_ops);
CREATE INDEX idx_onto_concepts_name_trgm ON ontology_concepts USING GIN (name gin_trgm_ops);

-- Ontology concept name lookup for deduplication
CREATE INDEX idx_onto_concepts_name ON ontology_concepts (workspace_id, name);

-- ─── Updated-at Trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_epics_updated_at
  BEFORE UPDATE ON epics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_issues_updated_at
  BEFORE UPDATE ON issues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_wiki_pages_updated_at
  BEFORE UPDATE ON wiki_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_onto_concepts_updated_at
  BEFORE UPDATE ON ontology_concepts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Row-Level Security (RLS) ──────────────────────────────────────────────
-- Uncomment and customize these policies when deploying to Supabase with auth.
-- Each policy assumes a workspace_id claim in the JWT or a helper function
-- that extracts the current user's workspace access.

-- ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE epics ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE dependencies ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE wiki_pages ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE wiki_page_versions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ontology_concepts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ontology_relations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Example policy: users can only access rows in their workspace
-- CREATE POLICY workspace_isolation ON workspaces
--   USING (id = (current_setting('app.current_workspace_id'))::uuid);
--
-- CREATE POLICY workspace_isolation ON epics
--   USING (workspace_id = (current_setting('app.current_workspace_id'))::uuid);
--
-- CREATE POLICY workspace_isolation ON issues
--   USING (workspace_id = (current_setting('app.current_workspace_id'))::uuid);
--
-- CREATE POLICY workspace_isolation ON dependencies
--   USING (workspace_id = (current_setting('app.current_workspace_id'))::uuid);
--
-- CREATE POLICY workspace_isolation ON wiki_pages
--   USING (workspace_id = (current_setting('app.current_workspace_id'))::uuid);
--
-- CREATE POLICY workspace_isolation ON wiki_page_versions
--   USING (wiki_page_id IN (
--     SELECT id FROM wiki_pages
--     WHERE workspace_id = (current_setting('app.current_workspace_id'))::uuid
--   ));
--
-- CREATE POLICY workspace_isolation ON ontology_concepts
--   USING (workspace_id = (current_setting('app.current_workspace_id'))::uuid);
--
-- CREATE POLICY workspace_isolation ON ontology_relations
--   USING (workspace_id = (current_setting('app.current_workspace_id'))::uuid);
--
-- CREATE POLICY workspace_isolation ON activity_log
--   USING (workspace_id = (current_setting('app.current_workspace_id'))::uuid);
--
-- CREATE POLICY workspace_isolation ON api_keys
--   USING (workspace_id = (current_setting('app.current_workspace_id'))::uuid);
