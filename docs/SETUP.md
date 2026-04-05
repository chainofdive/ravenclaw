# Ravenclaw Setup Guide

Initial installation and environment configuration.
After setup, see [SESSION_GUIDE.md](./SESSION_GUIDE.md) for agent integration.

---

## 1. Prerequisites

- Node.js >= 20
- pnpm >= 9
- PostgreSQL (local or Supabase)

---

## 2. Clone and Build

```bash
git clone https://github.com/chainofdive/ravenclaw.git
cd ravenclaw
pnpm install
pnpm build
```

---

## 3. Database Setup

### Local PostgreSQL

```bash
docker-compose up -d
# Or create the DB manually: createdb ravenclaw
```

Configure `.env`:
```bash
cp .env.example .env
# DATABASE_URL=postgresql://ravenclaw:ravenclaw@localhost:5432/ravenclaw
```

### Supabase (Cloud)

```
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

### Apply Schema

```bash
source .env && pnpm --filter @ravenclaw/core db:push
# Or with seed data:
psql $DATABASE_URL -f packages/supabase/seed.sql
```

---

## 4. Start API Server

```bash
source .env && DATABASE_URL="$DATABASE_URL" node packages/api/dist/index.js
```

Verify: `curl http://localhost:3000/api/v1/health`

---

## 5. Start Web Dashboard

```bash
pnpm --filter @ravenclaw/web dev
# Open http://localhost:5173
```

---

## 6. Install CLI

```bash
npm link packages/cli
rc init
# API URL: http://localhost:3000
# API Key: rvc_sk_test1234567890abcdef (default seed key)
```

Verify: `rc project list`

---

## 7. Register MCP Server (Claude Code Global)

Add to `~/.claude.json` under `mcpServers`:

```json
{
  "mcpServers": {
    "ravenclaw": {
      "command": "node",
      "args": ["/absolute/path/to/ravenclaw/packages/mcp/dist/index.js"],
      "env": {
        "RAVENCLAW_API_URL": "http://localhost:3000",
        "RAVENCLAW_API_KEY": "rvc_sk_test1234567890abcdef"
      }
    }
  }
}
```

> Find the path: `realpath packages/mcp/dist/index.js`

---

## 8. Register Skills & Agents (Claude Code Global)

```bash
cp -r skills/ravenclaw-context ~/.claude/skills/
mkdir -p ~/.claude/agents && cp agents/ravenclaw.md ~/.claude/agents/
```

---

## 9. Verification Checklist

```bash
curl -s http://localhost:3000/api/v1/health | jq .data.status  # → "ok"
rc project list                                                  # → project list
ls ~/.claude/skills/ravenclaw-context/SKILL.md                  # → file exists
ls ~/.claude/agents/ravenclaw.md                                # → file exists
```

Once all checks pass, proceed to [SESSION_GUIDE.md](./SESSION_GUIDE.md).
