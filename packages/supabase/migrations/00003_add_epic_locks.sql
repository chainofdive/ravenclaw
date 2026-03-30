-- Epic Locks: per-epic session mutex for agent-safe concurrent work
-- Multiple agents can work on DIFFERENT epics simultaneously,
-- but within a single epic only ONE session at a time.

CREATE TABLE epic_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  epic_id UUID NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  session_id VARCHAR(255) NOT NULL,
  agent_name VARCHAR(255) NOT NULL DEFAULT 'unknown',
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes'),
  metadata JSONB DEFAULT '{}',
  CONSTRAINT uq_epic_lock UNIQUE(epic_id)
);

CREATE INDEX idx_epic_locks_workspace ON epic_locks(workspace_id);
CREATE INDEX idx_epic_locks_expires ON epic_locks(expires_at);
