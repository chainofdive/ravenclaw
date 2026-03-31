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
# DB 생성
createdb ravenclaw

# .env 파일 설정
cp .env.example .env
# DATABASE_URL=postgresql://user:password@localhost:5432/ravenclaw
```

### Supabase

Supabase 프로젝트 생성 후 `.env`에 연결 문자열 설정:
```
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

### 마이그레이션 및 시드

```bash
# 스키마 생성
pnpm --filter @ravenclaw/core db:push

# 테스트 데이터 (선택)
psql $DATABASE_URL -f packages/supabase/seed.sql
```

---

## 4. API 서버 실행

```bash
source .env && DATABASE_URL="$DATABASE_URL" node packages/api/dist/index.js
```

확인:
```bash
curl http://localhost:3000/api/v1/health
# {"data":{"status":"ok",...}}
```

---

## 5. CLI 설치

```bash
# 글로벌 링크
npm link packages/cli

# 초기 설정
rc init
# API URL: http://localhost:3000
# API Key: rvc_sk_test1234567890abcdef  (seed 기본 키)
```

확인:
```bash
rc epic list
```

---

## 6. MCP 서버 등록 (Claude Code 글로벌)

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

> 경로는 `realpath packages/mcp/dist/index.js`로 확인할 수 있습니다.

---

## 7. 스킬 & 에이전트 등록 (Claude Code 글로벌)

```bash
# 스킬 — 어떤 프로젝트에서든 /ravenclaw-context 사용 가능
cp -r skills/ravenclaw-context ~/.claude/skills/

# 에이전트 — claude --agent ravenclaw 으로 세션 시작 가능
mkdir -p ~/.claude/agents
cp agents/ravenclaw.md ~/.claude/agents/
```

---

## 8. 설정 확인 체크리스트

```bash
# API 서버
curl -s http://localhost:3000/api/v1/health | jq .data.status
# → "ok"

# CLI
rc epic list
# → 에픽 테이블 출력

# MCP (Claude Code 새 세션에서)
# ravenclaw 도구들이 보이면 성공

# 스킬
ls ~/.claude/skills/ravenclaw-context/SKILL.md
# → 파일 존재 확인

# 에이전트
ls ~/.claude/agents/ravenclaw.md
# → 파일 존재 확인
```

모든 항목이 확인되면 [SESSION_GUIDE.md](./SESSION_GUIDE.md)로 진행하세요.
