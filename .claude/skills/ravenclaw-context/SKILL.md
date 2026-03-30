---
name: ravenclaw-context
description: Load work context from Ravenclaw and prepare for task execution. Use at the start of a new session or when switching between tasks.
---

This skill helps you quickly load and apply work context from the Ravenclaw system.

## Steps

### 1. Load Work Context

First, get the full work context. If the Ravenclaw MCP server is available, use the `get_work_context` tool. Otherwise, run the CLI:

```bash
rc context
```

### 2. Review Active Work

Check what's currently in progress:
```bash
rc issue list --status=in_progress --format=table
```

Check what's blocked or ready to start:
```bash
rc issue list --status=todo --format=table
```

### 3. Check User Comments

If working on a specific issue, check for user comments/feedback:
```bash
rc comment list issue <issue-id>
```

### 4. Start Working

Pick an issue to work on and mark it:
```bash
rc issue start <key>
```

### 5. When Done

Update the issue and add any relevant wiki documentation:
```bash
rc issue done <key>
rc wiki write <topic-slug>
```

### 6. Epic Locks (Multi-Agent Safety)

Before starting work on an epic's issues, acquire a lock:
```bash
rc lock acquire <epic-id> --session $SESSION_ID --agent claude-code
```

Keep the lock alive during long work:
```bash
rc lock heartbeat <epic-id> --session $SESSION_ID
```

Release when done:
```bash
rc lock release <epic-id> --session $SESSION_ID
```

Or simply use `rc issue start <key>` — it auto-acquires the epic lock.

Check for existing locks:
```bash
rc lock list
```

## Tips

- Use `rc context --compact` for a token-efficient summary
- Use `rc search "keyword"` to find relevant epics, issues, or wiki pages
- Always read comments before starting — the user may have specific instructions
- Update the wiki with architectural decisions or important context for future agents
