# Ravenclaw 초기 설정

Ravenclaw를 처음 설치하고 환경을 구성하는 가이드입니다.
설정 완료 후 세션 연동은 [SESSION_GUIDE.md](./SESSION_GUIDE.md)를 참고하세요.

---

## 1. 사전 요구사항

- Node.js >= 20
- pnpm >= 9
- PostgreSQL (로컬 또는 Supabase)

---

## 2. 프로젝트 클론 및 빌드

```bash
git clone https://github.com/chainofdive/ravenclaw.git
cd ravenclaw
pnpm install
pnpm build
```

---

## 3. 데이터베이스 설정

### 로컬 PostgreSQL

```bash
docker-compose up -d
# 또는 직접 DB 생성: createdb ravenclaw
```

`.env` 파일 설정:
```bash
cp .env.example .env
# DATABASE_URL=postgresql://ravenclaw:ravenclaw@localhost:5432/ravenclaw
```

### Supabase (클라우드)

```
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

### 스키마 적용

```bash
source .env && pnpm --filter @ravenclaw/core db:push
# 또는 시드 데이터 포함:
psql $DATABASE_URL -f packages/supabase/seed.sql
```

---

## 4. API 서버 실행

```bash
source .env && DATABASE_URL="$DATABASE_URL" node packages/api/dist/index.js
```

확인: `curl http://localhost:3000/api/v1/health`

---

## 5. 웹 대시보드 실행

```bash
pnpm --filter @ravenclaw/web dev
# http://localhost:5173 에서 접속
```

---

## 6. CLI 설치

```bash
npm link packages/cli
rc init
# API URL: http://localhost:3000
# API Key: rvc_sk_test1234567890abcdef (seed 기본 키)
```

확인: `rc project list`

---

## 7. MCP 서버 등록 (Claude Code 글로벌)

`~/.claude.json`의 `mcpServers`에 추가:

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

> 경로 확인: `realpath packages/mcp/dist/index.js`

---

## 8. 스킬 & 에이전트 등록 (Claude Code 글로벌)

```bash
cp -r skills/ravenclaw-context ~/.claude/skills/
mkdir -p ~/.claude/agents && cp agents/ravenclaw.md ~/.claude/agents/
```

---

## 9. 설정 확인 체크리스트

```bash
curl -s http://localhost:3000/api/v1/health | jq .data.status  # → "ok"
rc project list                                                  # → 프로젝트 목록
ls ~/.claude/skills/ravenclaw-context/SKILL.md                  # → 파일 존재
ls ~/.claude/agents/ravenclaw.md                                # → 파일 존재
```

모든 항목이 확인되면 [SESSION_GUIDE.md](./SESSION_GUIDE.md)로 진행하세요.
