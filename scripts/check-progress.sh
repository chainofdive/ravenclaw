#!/bin/bash
# Ravenclaw 에이전트 진행 상황 모니터링
# Usage: bash scripts/check-progress.sh

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

packages=("core" "api" "cli" "mcp")
expected_core=("drizzle.config.ts" "src/db/schema.ts" "src/db/client.ts" "src/db/index.ts" "src/types/index.ts" "src/services/epic.service.ts" "src/services/issue.service.ts" "src/services/dependency.service.ts" "src/services/wiki.service.ts" "src/services/context.service.ts" "src/services/ontology.service.ts" "src/services/search.service.ts" "src/services/activity-logger.ts" "src/index.ts")
expected_api=("src/app.ts" "src/index.ts" "src/middleware/auth.ts" "src/middleware/error.ts" "src/middleware/logging.ts" "src/routes/health.ts" "src/routes/epics.ts" "src/routes/issues.ts" "src/routes/wiki.ts" "src/routes/context.ts" "src/routes/ontology.ts" "src/routes/search.ts" "src/routes/dependencies.ts" "Dockerfile")
expected_cli=("src/index.ts" "src/config.ts" "src/client.ts" "src/types.ts" "src/output/formatter.ts" "src/output/colors.ts" "src/commands/init.ts" "src/commands/epic.ts" "src/commands/issue.ts" "src/commands/wiki.ts" "src/commands/context.ts" "src/commands/ontology.ts" "src/commands/search.ts")
expected_mcp=("src/index.ts" "src/server.ts" "src/client.ts" "src/format.ts" "src/tools/epic.tools.ts" "src/tools/issue.tools.ts" "src/tools/wiki.tools.ts" "src/tools/context.tools.ts" "src/tools/ontology.tools.ts" "src/tools/search.tools.ts" "src/resources/context.resources.ts" "src/resources/epic.resources.ts" "src/resources/wiki.resources.ts")

echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   Ravenclaw Build Progress Monitor       ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""

for pkg in "${packages[@]}"; do
    eval "expected=(\"\${expected_${pkg}[@]}\")"
    total=${#expected[@]}
    done=0
    missing=()

    for f in "${expected[@]}"; do
        if [ -f "packages/${pkg}/${f}" ]; then
            ((done++))
        else
            missing+=("$f")
        fi
    done

    pct=$((done * 100 / total))

    if [ $pct -eq 100 ]; then
        color=$GREEN
        status="DONE"
    elif [ $pct -gt 50 ]; then
        color=$YELLOW
        status="IN PROGRESS"
    else
        color=$CYAN
        status="BUILDING"
    fi

    bar_done=$((pct / 5))
    bar_remain=$((20 - bar_done))
    bar=$(printf '%0.s█' $(seq 1 $bar_done 2>/dev/null))
    bar_empty=$(printf '%0.s░' $(seq 1 $bar_remain 2>/dev/null))

    echo -e "${BOLD}@ravenclaw/${pkg}${NC}  [${color}${status}${NC}]"
    echo -e "  ${color}${bar}${NC}${bar_empty}  ${done}/${total} (${pct}%)"

    if [ ${#missing[@]} -gt 0 ]; then
        echo -e "  남은 파일: ${missing[*]}"
    fi
    echo ""
done

echo -e "${BOLD}package.json 확인:${NC}"
for pkg in "${packages[@]}"; do
    if [ -f "packages/${pkg}/package.json" ]; then
        echo -e "  ${GREEN}✓${NC} packages/${pkg}/package.json"
    else
        echo -e "  ✗ packages/${pkg}/package.json"
    fi
done
