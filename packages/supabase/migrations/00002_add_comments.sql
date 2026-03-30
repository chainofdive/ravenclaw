-- Add comments table for epics, issues, wiki pages, and concepts
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type entity_type NOT NULL,
  entity_id UUID NOT NULL,
  content TEXT NOT NULL,
  author VARCHAR(255) NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_entity ON comments(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_comments_workspace ON comments(workspace_id, created_at DESC);

-- Auto-update updated_at trigger
CREATE TRIGGER set_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
