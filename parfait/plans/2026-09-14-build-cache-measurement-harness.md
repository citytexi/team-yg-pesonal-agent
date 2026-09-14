# 로컬 빌드 캐시 측정 하니스 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 리모트 빌드 캐시가 실제로 얼마를 사 오는지 재는 로컬 측정 하니스를 만든다.

**Architecture:** Gradle init script가 빌드 캐시 디렉토리를 하니스 전용 경로로 돌리고 태스크
outcome을 CSV로 떨군다. 셸 러너가 시나리오별 사전 상태(빌드 출력·캐시 내용물·체크아웃 커밋)를
세우고 반복 측정한다. 핵심 지표는 커밋 쌍 `(A, B)`에 대해 전용 캐시가 `A`만 담은 상태로 `B`를
빌드한 시간과 `A`·`B` 둘 다 담은 상태로 빌드한 시간의 차이이며, 뒤쪽이 CI가 이미 구운 항목을
개발자가 받는 상태를 대역한다.

**Tech Stack:** Gradle 9.5 init script (Kotlin DSL), `BuildEventsListenerRegistry` +
`OperationCompletionListener`, bash, `git worktree`.

**Spec:** [`parfait/specs/2026-09-14-build-cache-measurement-harness.md`](../specs/2026-09-14-build-cache-measurement-harness.md)

## Global Constraints

- **작업 저장소는 `TJYG-Android`다.** 이 계획 문서가 있는 위키 저장소가 아니다. 로컬 절대경로는
  `wiki/personal-private/project-paths.md`에 있고, 리모트는 `mash-up-kr/TEAMYG-Android`다.
- **브랜치는 `build/remote-build-cache`.** 이미 존재하며 `develop`과 같은 자리에 있다.
- **태스크마다 커밋한다.** `git push`와 PR 생성은 사용자 승인 전까지 하지 않는다.
- **새 도구 의존성을 들이지 않는다.** `bats`·`gradle-profiler`·`jq` 설치를 요구하지 않는다.
  검증은 실제 Gradle 실행과 러너의 dry-run 출력으로 한다.
- **개발자의 워킹 트리와 Gradle User Home을 파괴하지 않는다.** `~/.gradle/caches/build-cache-1`에
  쓰지 않고, 측정 대상 트리에서 `git stash`와 `git checkout -f`를 쓰지 않는다.
- **절대경로를 스크립트에 박지 않는다.** 경로는 인자나 스크립트 위치 기준 상대경로로 받는다.
- **주석 규약**(`parfait/CLAUDE.md`):
  - 코드가 이미 말하는 것은 쓰지 않는다.
  - `@return`·`@param`은 타입·이름이 말하지 못할 때만 쓴다.
  - 다른 컴포넌트의 현재 상태를 단정하지 않는다(낡는다).
- **Gradle 9.5 / JDK 17.** `gradle/wrapper/gradle-wrapper.properties`와 CI의 `setup-java` 설정 기준.

---

### Task 1: init script — 태스크 outcome 수집

**Files:**
- Create: `tools/build-cache-bench/cache-report.init.gradle.kts`

**Interfaces:**
- Consumes: 없음.
- Produces: Gradle 프로퍼티 `cacheReport.csv`(출력 파일 절대경로)를 받아 헤더
  `task_path,outcome,duration_ms,execution_reasons`를 가진 CSV를 쓴다. 이후 모든 태스크가 이 파일을 `-I`로 주입한다.

**배경:** `TaskExecutionListener`와 `gradle.taskGraph.afterTask`는 Gradle 9.5에 아직 있지만
deprecated이고, configuration cache를 켜는 순간 `Listener registration ... is unsupported.`로
빌드가 깨진다. 지원되는 경로인 `BuildEventsListenerRegistry`를 쓴다.

**함정 둘** — 아래 코드가 그 형태여야 하는 이유다.

- init script 스코프에는 `objects`가 없다. `objects.newInstance` + `@Inject`로 서비스를 얻으려
  하면 `Unresolved reference 'objects'`로 죽는다. `org.gradle.kotlin.dsl.support.serviceOf`를 쓴다.
- `gradle.settingsEvaluated { }`를 Kotlin 람다로 넘기면 컴파일이 실패한다(Groovy `Closure`를
  기대한다). `Action<Settings> { }`로 명시해야 한다. Task 2에서 쓴다.

- [ ] **Step 1: init script를 작성한다**

```kotlin
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.services.BuildService
import org.gradle.api.services.BuildServiceParameters
import org.gradle.build.event.BuildEventsListenerRegistry
import org.gradle.kotlin.dsl.registerIfAbsent
import org.gradle.kotlin.dsl.support.serviceOf
import org.gradle.tooling.events.FinishEvent
import org.gradle.tooling.events.OperationCompletionListener
import org.gradle.tooling.events.task.TaskExecutionResult
import org.gradle.tooling.events.task.TaskFailureResult
import org.gradle.tooling.events.task.TaskFinishEvent
import org.gradle.tooling.events.task.TaskSkippedResult
import org.gradle.tooling.events.task.TaskSuccessResult
import java.io.File

abstract class TaskOutcomeRecorder :
    BuildService<TaskOutcomeRecorder.Params>, OperationCompletionListener, AutoCloseable {

    interface Params : BuildServiceParameters {
        val csv: RegularFileProperty
    }

    private val rows = StringBuilder()

    override fun onFinish(event: FinishEvent) {
        if (event !is TaskFinishEvent) return
        val result = event.result
        // getSkipMessage() 가 돌려주는 "NO-SOURCE" 는 하이픈이다. 원본 대조를 위해 정규화하지 않는다.
        val outcome = when (result) {
            is TaskSuccessResult -> when {
                result.isFromCache -> "FROM_CACHE"
                result.isUpToDate -> "UP_TO_DATE"
                else -> "EXECUTED"
            }
            is TaskSkippedResult -> result.skipMessage
            is TaskFailureResult -> "FAILED"
            else -> "UNKNOWN"
        }
        // 왜 실행됐는지를 남긴다. S3 에서 EXECUTED 로 남은 태스크의 사유가 판단 재료다.
        val reasons = (result as? TaskExecutionResult)?.executionReasons.orEmpty()
            .joinToString(";") { it.replace(',', ' ') }
        rows.append(event.descriptor.taskPath).append(',')
            .append(outcome).append(',')
            .append(result.endTime - result.startTime).append(',')
            .append('"').append(reasons).append('"').append('\n')
    }

    override fun close() {
        val target = parameters.csv.get().asFile
        target.parentFile.mkdirs()
        target.writeText("task_path,outcome,duration_ms,execution_reasons\n" + rows)
    }
}

val csvPath = providers.gradleProperty("cacheReport.csv")
    .getOrElse(File(gradle.startParameter.currentDir, "build/task-outcomes.csv").absolutePath)

val recorder = gradle.sharedServices.registerIfAbsent(
    "taskOutcomeRecorder",
    TaskOutcomeRecorder::class,
) { parameters.csv.set(File(csvPath)) }

gradle.serviceOf<BuildEventsListenerRegistry>().onTaskCompletion(recorder)
```

- [ ] **Step 2: 실행해서 CSV가 나오는지 확인한다**

Run (TJYG-Android 루트에서):
```bash
./gradlew help \
  -I tools/build-cache-bench/cache-report.init.gradle.kts \
  -PcacheReport.csv="$PWD/build/bench-smoke.csv"
cat build/bench-smoke.csv
```

Expected: 빌드 성공. `build/bench-smoke.csv`에 헤더 `task_path,outcome,duration_ms,execution_reasons`와 함께
`:help,EXECUTED,<ms>` 행이 있고, included build 태스크(`:build-logic:convention:compileKotlin` 등)도
행으로 잡힌다.

- [ ] **Step 3: outcome 네 값이 실제로 갈리는지 확인한다**

Run:
```bash
./gradlew :core:util:jvm:compileKotlin \
  -I tools/build-cache-bench/cache-report.init.gradle.kts \
  -PcacheReport.csv="$PWD/build/bench-run1.csv"
./gradlew :core:util:jvm:compileKotlin \
  -I tools/build-cache-bench/cache-report.init.gradle.kts \
  -PcacheReport.csv="$PWD/build/bench-run2.csv"
grep compileKotlin build/bench-run1.csv build/bench-run2.csv
grep -c 'NO-SOURCE' build/bench-run2.csv
```

Expected: 두 번째 실행의 `:core:util:jvm:compileKotlin`이 `UP_TO_DATE`다. `NO-SOURCE` 행이
하나 이상 있다(하이픈 표기 확인). 첫 실행 쪽 `compileKotlin` 행의 마지막 컬럼에 실행 사유
문자열이 비어 있지 않게 들어 있다.

- [ ] **Step 4: 스모크 산출물을 지우고 커밋한다**

```bash
rm -f build/bench-smoke.csv build/bench-run1.csv build/bench-run2.csv
git add tools/build-cache-bench/cache-report.init.gradle.kts
git commit -m "feat: 빌드 캐시 측정용 태스크 outcome 수집 init script를 추가한다"
```

---

### Task 2: init script — 전용 빌드 캐시 디렉토리 전환

**Files:**
- Modify: `tools/build-cache-bench/cache-report.init.gradle.kts`

**Interfaces:**
- Consumes: Task 1의 init script.
- Produces: Gradle 프로퍼티 `cacheReport.cacheDir`(디렉토리 절대경로). 주면 그 경로를 로컬 빌드
  캐시로 쓰고, 안 주면 Gradle 기본값을 그대로 둔다.

**왜 필요한가:** 시나리오가 요구하는 "캐시에 커밋 `A`만" / "`A`와 `B` 모두" 상태를 디렉토리
교체로 만든다. 동시에 개발자의 `~/.gradle/caches/build-cache-1`을 건드리지 않는다.

- [ ] **Step 1: 전환 코드를 파일 끝에 추가한다**

```kotlin
// 측정이 개발자의 ~/.gradle 캐시를 쓰거나 더럽히지 않게 한다.
// settingsEvaluated 에 Kotlin 람다를 넘기면 Closure 를 기대해 컴파일이 깨진다.
val benchCacheDir = providers.gradleProperty("cacheReport.cacheDir").orNull
if (benchCacheDir != null) {
    gradle.settingsEvaluated(
        Action<Settings> {
            buildCache.local.directory = File(benchCacheDir)
        },
    )
}
```

import 두 줄을 파일 상단 import 블록에 추가한다.

```kotlin
import org.gradle.api.Action
import org.gradle.api.initialization.Settings
```

- [ ] **Step 2: 전용 디렉토리에만 쓰는지 확인한다**

Run:
```bash
BENCH=$(mktemp -d)
BEFORE=$(ls ~/.gradle/caches/build-cache-1 | wc -l)
./gradlew :core:util:jvm:compileKotlin --rerun-tasks \
  -I tools/build-cache-bench/cache-report.init.gradle.kts \
  -PcacheReport.csv="$PWD/build/bench-cache.csv" \
  -PcacheReport.cacheDir="$BENCH"
AFTER=$(ls ~/.gradle/caches/build-cache-1 | wc -l)
echo "original before=$BEFORE after=$AFTER"
echo "bench entries=$(ls "$BENCH" | wc -l)"
```

Expected: `before`와 `after`가 같다. `bench entries`가 1 이상이다.

- [ ] **Step 3: 전용 디렉토리에서 캐시 적중이 나는지 확인한다**

Run (위 `$BENCH`를 그대로 쓴다):
```bash
./gradlew :core:util:jvm:clean \
  -I tools/build-cache-bench/cache-report.init.gradle.kts \
  -PcacheReport.csv="$PWD/build/bench-clean.csv" \
  -PcacheReport.cacheDir="$BENCH"
./gradlew :core:util:jvm:compileKotlin \
  -I tools/build-cache-bench/cache-report.init.gradle.kts \
  -PcacheReport.csv="$PWD/build/bench-hit.csv" \
  -PcacheReport.cacheDir="$BENCH"
grep ':core:util:jvm:compileKotlin' build/bench-hit.csv
```

Expected: outcome이 `FROM_CACHE`다. 아니면 전용 디렉토리 전환이 먹지 않은 것이므로 여기서 멈춘다.

- [ ] **Step 4: 정리하고 커밋한다**

```bash
rm -rf "$BENCH" build/bench-cache.csv build/bench-clean.csv build/bench-hit.csv
git add tools/build-cache-bench/cache-report.init.gradle.kts
git commit -m "feat: 측정용 전용 빌드 캐시 디렉토리 전환을 init script에 추가한다"
```

---

### Task 3: 게이트 G0 — 캐시 항목 이식성 확인

**Files:**
- Create: `tools/build-cache-bench/check-relocatability.sh`

**Interfaces:**
- Consumes: Task 1·2의 init script.
- Produces: 이식 가능/불가 태스크 목록과 적중률. **이 게이트가 실패하면 이후 태스크를 진행하지
  않고 사용자에게 보고한다.**

**왜 첫 관문인가:** 리모트 캐시는 다른 머신이 만든 항목을 받는 구조다. 절대경로가 다르다는
이유만으로 적중하지 않는다면, 핵심 값이 얼마로 나오든 리모트 캐시의 가치는 0이다.

> **이 게이트가 재지 못하는 것**: CI는 `ubuntu-latest`이고 개발자는 macOS다. OS와 JDK 벤더가
> 캐시 키에 들어가므로 실제 리모트에서는 여기서 통과해도 적중하지 않을 수 있다. 그 확인은
> 리모트 캐시를 세워야만 가능하다. 이 게이트는 필요조건만 본다.

- [ ] **Step 1: 확인 스크립트를 작성한다**

```bash
#!/usr/bin/env bash
# 다른 절대경로에서 만들어진 캐시 항목이 적중하는지 본다.
# 여기서 깨지면 리모트 빌드 캐시는 무의미하다.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INIT="$ROOT/tools/build-cache-bench/cache-report.init.gradle.kts"
TARGET="${1::-:core:util:jvm:compileKotlin}"

WORK="$(mktemp -d)"
CACHE="$WORK/cache"
TREE="$WORK/tree"
trap 'rm -rf "$WORK"; git -C "$ROOT" worktree prune' EXIT

git -C "$ROOT" worktree add --detach "$TREE" HEAD >/dev/null

# 1) 두 번째 트리(다른 절대경로)에서 캐시를 채운다.
(cd "$TREE" && ./gradlew "$TARGET" --rerun-tasks --offline \
  -I "$INIT" \
  -PcacheReport.csv="$WORK/seed.csv" \
  -PcacheReport.cacheDir="$CACHE" >/dev/null)

# 2) 원래 트리에서 같은 캐시를 읽는다.
(cd "$ROOT" && ./gradlew "$TARGET" --offline \
  -I "$INIT" \
  -PcacheReport.csv="$WORK/probe.csv" \
  -PcacheReport.cacheDir="$CACHE" >/dev/null)

echo "seed tree:  $TREE"
echo "probe tree: $ROOT"
echo
echo "-- probe outcomes --"
awk -F, 'NR>1 {c[$2]++} END {for (o in c) printf "%-12s %d\n", o, c[o]}' "$WORK/probe.csv"
echo
echo "-- not reused (executed despite warm cache) --"
awk -F, 'NR>1 && $2=="EXECUTED" {print $1}' "$WORK/probe.csv"
```

`TARGET` 기본값 표기의 `${1::-...}` 는 오타가 나기 쉽다. 정확히 `${1:-:core:util:jvm:compileKotlin}`
로 쓴다(기본값이 콜론으로 시작하는 태스크 경로라 콜론이 연달아 보인다).

- [ ] **Step 2: 실행 권한을 주고 돌린다**

Run:
```bash
chmod +x tools/build-cache-bench/check-relocatability.sh
./tools/build-cache-bench/check-relocatability.sh
```

Expected: `probe outcomes`에 `FROM_CACHE`가 잡힌다. 원래 트리에서 빌드한 적 없는 캐시인데도
적중한다는 뜻이다.

- [ ] **Step 3: 더 넓은 그래프로 한 번 더 돌린다**

Run:
```bash
./tools/build-cache-bench/check-relocatability.sh :domain:compileDebugKotlin
```

Expected: 마찬가지로 `FROM_CACHE`가 다수다. `not reused` 목록이 길면 그 태스크들이 이식
불가 후보다 — 목록을 보고한다.

- [ ] **Step 4: 결과를 판정하고 보고한다**

`FROM_CACHE`가 0건이면 **여기서 멈춘다.** 이후 태스크를 진행하지 않고, `not reused` 목록과 함께
사용자에게 보고한다. 스펙의 전제가 깨진 것이므로 하니스를 더 짓는 것이 의미가 없다.

적중이 나면 커밋한다.

```bash
git add tools/build-cache-bench/check-relocatability.sh
git commit -m "feat: 캐시 항목 이식성 확인 스크립트를 추가한다"
```

---

### Task 4: 러너 뼈대 — 인자·선행 조건·dry-run

**Files:**
- Create: `tools/build-cache-bench/run.sh`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: Task 1·2의 init script.
- Produces: `run.sh`. 인자 `--tree`·`--scenarios`·`--targets`·`--iterations`·`--pair`·`--cache-dir`·
  `--out`·`--dry-run`을 받는다. 셸 함수 `precheck`(선행 조건 검사)와 `plan_runs`(실행 계획 출력)를
  이후 태스크가 쓴다.

- [ ] **Step 1: 러너 뼈대를 작성한다**

```bash
#!/usr/bin/env bash
# 로컬 빌드 캐시 측정 러너. 설계 근거는
# parfait/specs/2026-09-14-build-cache-measurement-harness.md 에 있다.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INIT="$ROOT/tools/build-cache-bench/cache-report.init.gradle.kts"

TREE=""
SCENARIOS="S0,S1,S2"
TARGETS=":app:assembleDebug,test"
ITERATIONS=3
PAIR=""
CACHE_DIR=""
OUT=""
DRY_RUN=0

usage() {
    cat <<'USAGE'
사용법: run.sh [옵션]
  --tree <경로>       측정 대상 트리. 생략하면 worktree 를 새로 만든다.
  --scenarios <목록>  S0,S1,S2,S3,S4 중 쉼표 구분. 기본 S0,S1,S2
  --targets <목록>    Gradle 태스크 경로, 쉼표 구분. 기본 :app:assembleDebug,test
  --iterations <N>    시나리오당 반복 횟수. 기본 3
  --pair <A:B>        S3·S4 가 쓸 커밋 쌍. 두 커밋을 콜론으로 잇는다.
  --cache-dir <경로>  전용 빌드 캐시 경로. 기본 <out>/cache
  --out <경로>        결과 디렉토리. 기본 tools/build-cache-bench/runs/<timestamp>
  --dry-run           실행 계획만 출력한다.
USAGE
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --tree) TREE="$2"; shift 2 ;;
        --scenarios) SCENARIOS="$2"; shift 2 ;;
        --targets) TARGETS="$2"; shift 2 ;;
        --iterations) ITERATIONS="$2"; shift 2 ;;
        --pair) PAIR="$2"; shift 2 ;;
        --cache-dir) CACHE_DIR="$2"; shift 2 ;;
        --out) OUT="$2"; shift 2 ;;
        --dry-run) DRY_RUN=1; shift ;;
        -h|--help) usage; exit 0 ;;
        *) echo "알 수 없는 옵션: $1" >&2; usage; exit 2 ;;
    esac
done

OUT="${OUT:-$ROOT/tools/build-cache-bench/runs/$(date +%Y%m%d-%H%M%S)}"
CACHE_DIR="${CACHE_DIR:-$OUT/cache}"

# :app:assembleDebug 는 서명·google-services 를 탄다. 한 시간짜리 측정이 중간에 죽지 않게 먼저 본다.
precheck() {
    local tree="$1" missing=0
    [[ -f "$tree/local.properties" ]] || { echo "없음: $tree/local.properties (템플릿 local.default.properties)" >&2; missing=1; }
    if [[ "$TARGETS" == *"assembleDebug"* ]]; then
        [[ -f "$tree/app/google-services.json" ]] || { echo "없음: $tree/app/google-services.json" >&2; missing=1; }
        grep -q '^sdk.dir' "$tree/local.properties" 2>/dev/null || { echo "local.properties 에 sdk.dir 없음" >&2; missing=1; }
    fi
    if git -C "$tree" status --porcelain | grep -q .; then
        echo "작업 트리가 clean 하지 않다: $tree" >&2
        missing=1
    fi
    # 다른 데몬이 돌면 수치가 흔들린다. 막지는 않고 알린다.
    if "$tree/gradlew" --status 2>/dev/null | grep -qi idle; then
        echo "경고: 유휴 Gradle 데몬이 있다. IDE 를 닫고 돌리는 편이 낫다." >&2
    fi
    return "$missing"
}

plan_runs() {
    local scenario target i
    for target in ${TARGETS//,/ }; do
        for scenario in ${SCENARIOS//,/ }; do
            for ((i = 1; i <= ITERATIONS; i++)); do
                echo "$scenario|$target|$i"
            done
        done
    done
}

if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "tree=${TREE:-<새 worktree>} out=$OUT cache=$CACHE_DIR pair=${PAIR:-<없음>}"
    plan_runs
    exit 0
fi

echo "아직 시나리오 실행이 구현되지 않았다. --dry-run 으로 계획만 볼 수 있다." >&2
exit 1
```

- [ ] **Step 2: dry-run 출력이 기대와 맞는지 확인한다**

Run:
```bash
chmod +x tools/build-cache-bench/run.sh
./tools/build-cache-bench/run.sh --dry-run --scenarios S0,S1 --targets test --iterations 2
```

Expected: 6줄 중 첫 줄이 `tree=...` 요약이고 이어서 정확히 4줄이 나온다.
```
S0|test|1
S0|test|2
S1|test|1
S1|test|2
```

- [ ] **Step 3: 선행 조건 검사가 실제로 걸리는지 확인한다**

Run:
```bash
bash -c 'source tools/build-cache-bench/run.sh --dry-run >/dev/null 2>&1; true' || true
TARGETS=":app:assembleDebug" bash -c '
  ROOT="$PWD"
  source /dev/stdin <<SH
$(sed -n "/^precheck()/,/^}/p" tools/build-cache-bench/run.sh)
SH
  precheck "$ROOT" && echo "precheck: 통과" || echo "precheck: 실패 (위 사유)"
'
```

Expected: 이 머신에는 파일이 있으므로 `precheck: 통과`가 나온다. 파일이 없는 환경에서는 누락
항목이 이름과 함께 찍힌다.

- [ ] **Step 4: 결과 디렉토리를 커밋 대상에서 뺀다**

`.gitignore` 끝에 추가한다.

```
# 빌드 캐시 측정 결과 — 머신마다 다르고 저장소에 쌓일 이유가 없다
/tools/build-cache-bench/runs/
```

- [ ] **Step 5: 커밋한다**

```bash
git add tools/build-cache-bench/run.sh .gitignore
git commit -m "feat: 빌드 캐시 측정 러너 뼈대와 선행 조건 검사를 추가한다"
```

---

### Task 5: 시나리오 S0·S1·S2 실행

**Files:**
- Modify: `tools/build-cache-bench/run.sh`

**Interfaces:**
- Consumes: Task 4의 `precheck`·`plan_runs`, Task 1·2의 init script.
- Produces: 셸 함수 `prepare_state`(시나리오별 사전 상태 구성)·`measure`(1회 측정)와 산출물
  `builds.csv`(헤더 `scenario,target,iteration,wall_ms,daemon_id,daemon_build_no`)·
  `cache-size.csv`(헤더 `scenario,target,iteration,entries,bytes`). Task 6이 같은 함수에 `S3`·`S4`를
  더한다.

**핵심 제약:** 사전 상태는 **반복 매 회차마다** 다시 세운다. 시나리오 단위로 한 번만 세우면
`S2`의 2회차는 캐시가 이미 차 있어 사실상 `S1`이 되고, 중앙값이 통째로 무의미해진다.

- [ ] **Step 1: 상태 구성과 측정 함수를 추가한다**

`plan_runs` 아래, `--dry-run` 분기 위에 넣는다.

```bash
# 전용 캐시를 통째로 지운다. 빈 변수로 rm -rf 가 나가지 않게 막는다.
wipe_cache() {
    [[ -n "$CACHE_DIR" && "$CACHE_DIR" != "/" ]] || { echo "캐시 경로가 비었다" >&2; exit 3; }
    rm -rf "${CACHE_DIR:?}"
    mkdir -p "$CACHE_DIR"
}

gradle_run() {
    local tree="$1" csv="$2"; shift 2
    (cd "$tree" && ./gradlew "$@" --offline \
        -I "$INIT" \
        -PcacheReport.csv="$csv" \
        -PcacheReport.cacheDir="$CACHE_DIR" >/dev/null 2>&1)
}

# 시나리오가 요구하는 "빌드 직전 상태"를 만든다. 이 단계의 시간은 측정하지 않는다.
prepare_state() {
    local scenario="$1" tree="$2"
    local -a targets=(${TARGETS//,/ })
    case "$scenario" in
        S0)
            gradle_run "$tree" "$OUT/discard.csv" "${targets[@]}"
            ;;
        S1)
            gradle_run "$tree" "$OUT/discard.csv" "${targets[@]}"
            gradle_run "$tree" "$OUT/discard.csv" clean
            ;;
        S2)
            wipe_cache
            gradle_run "$tree" "$OUT/discard.csv" clean
            ;;
        *)
            echo "알 수 없는 시나리오: $scenario" >&2
            return 4
            ;;
    esac
}

cache_stats() {
    local entries bytes
    entries=$(find "$CACHE_DIR" -type f | wc -l | tr -d ' ')
    bytes=$(find "$CACHE_DIR" -type f -exec cat {} + 2>/dev/null | wc -c | tr -d ' ')
    echo "$entries,$bytes"
}

measure() {
    local scenario="$1" target="$2" iteration="$3" tree="$4"
    local tag="$scenario-${target//:/_}-$iteration"
    local csv="$OUT/tasks/$tag.csv"
    mkdir -p "$OUT/tasks"

    # 회차마다 데몬을 새로 띄워 JIT·파일 해시 축적이 단조 편향을 만들지 않게 한다.
    (cd "$tree" && ./gradlew --stop >/dev/null 2>&1) || true
    gradle_run "$tree" "$OUT/discard.csv" help

    prepare_state "$scenario" "$tree"

    local start end
    start=$(date +%s%3N 2>/dev/null || python3 -c 'import time;print(int(time.time()*1000))')
    gradle_run "$tree" "$csv" "$target"
    end=$(date +%s%3N 2>/dev/null || python3 -c 'import time;print(int(time.time()*1000))')

    echo "$scenario,$target,$iteration,$((end - start)),$(hostname)-$$,1" >> "$OUT/builds.csv"
    echo "$scenario,$target,$iteration,$(cache_stats)" >> "$OUT/cache-size.csv"
}
```

`date +%s%3N`은 macOS 기본 `date`에서 동작하지 않는다. 위 폴백이 그 자리다.

- [ ] **Step 2: 실행 본문으로 dry-run 아래를 교체한다**

```bash
mkdir -p "$OUT" "$CACHE_DIR"
TREE="${TREE:-$ROOT}"
precheck "$TREE" || { echo "선행 조건 미충족" >&2; exit 5; }

echo "scenario,target,iteration,wall_ms,daemon_id,daemon_build_no" > "$OUT/builds.csv"
echo "scenario,target,iteration,entries,bytes" > "$OUT/cache-size.csv"

while IFS='|' read -r scenario target iteration; do
    echo "[$scenario] $target ($iteration/$ITERATIONS)"
    measure "$scenario" "$target" "$iteration" "$TREE"
done < <(plan_runs)

rm -f "$OUT/discard.csv"
echo "결과: $OUT"
```

- [ ] **Step 3: 가장 가벼운 구성으로 돌려 본다**

Run:
```bash
./tools/build-cache-bench/run.sh \
  --scenarios S1,S2 --targets :core:util:jvm:compileKotlin --iterations 1
```

Expected: `builds.csv`에 2행, `cache-size.csv`에 2행. `S2`의 `wall_ms`가 `S1`보다 크다.

- [ ] **Step 4: 반복 오염이 없는지 확인한다**

Run:
```bash
./tools/build-cache-bench/run.sh \
  --scenarios S2 --targets :core:util:jvm:compileKotlin --iterations 3
for f in tools/build-cache-bench/runs/*/tasks/S2-*; do
  echo "$f $(awk -F, 'NR>1 && $2=="FROM_CACHE"' "$f" | wc -l)"
done
```

Expected: 세 회차 모두 `FROM_CACHE` 건수가 0에 가깝다. 회차가 늘수록 늘어나면 `wipe_cache`가
매 회차 돌지 않는 것이므로 고친다.

- [ ] **Step 5: 커밋한다**

```bash
git add tools/build-cache-bench/run.sh
git commit -m "feat: S0·S1·S2 시나리오 측정을 러너에 구현한다"
```

---

### Task 6: 시나리오 S3·S4 — 커밋 쌍과 격리된 트리

**Files:**
- Modify: `tools/build-cache-bench/run.sh`

**Interfaces:**
- Consumes: Task 5의 `prepare_state`·`measure`·`wipe_cache`·`gradle_run`.
- Produces: `prepare_state`에 `S3`·`S4` 분기. `--pair A:B` 인자를 소비한다. `builds.csv`에
  `pair` 컬럼이 추가된다.

**무엇을 만드는가:**
- `S3` = `T_local`. 전용 캐시에 커밋 `A`의 항목만 있는 상태로 `B`를 빌드한다.
- `S4` = `T_remote`. 캐시에 `A`와 `B`의 항목이 모두 있는 상태로, 빌드 출력만 지우고 `B`를 빌드한다.
- **핵심 값은 `S3 − S4`다.**

**워킹 트리 안전:** `--tree`가 주어지지 않으면 러너가 `git worktree`로 전용 트리를 만든다.
개발자 트리에서 커밋을 오가지 않는다. `git stash`와 `checkout -f`는 쓰지 않고, 종료 시
worktree를 정리하는 `trap`을 건다.

- [ ] **Step 1: 전용 트리 확보 함수를 추가한다**

```bash
OWNED_TREE=""

cleanup_tree() {
    [[ -n "$OWNED_TREE" ]] || return 0
    git -C "$ROOT" worktree remove --force "$OWNED_TREE" >/dev/null 2>&1 || true
    git -C "$ROOT" worktree prune >/dev/null 2>&1 || true
}
trap cleanup_tree EXIT

# S3·S4 는 커밋을 오간다. 개발자 트리에서 하면 중단 시 detached HEAD 와 지워진 build/ 가 남는다.
ensure_tree() {
    [[ -z "$TREE" ]] || { echo "$TREE"; return 0; }
    OWNED_TREE="$OUT/tree"
    git -C "$ROOT" worktree add --detach "$OWNED_TREE" HEAD >/dev/null
    for f in local.properties app/google-services.json; do
        [[ -f "$ROOT/$f" ]] && cp "$ROOT/$f" "$OWNED_TREE/$f"
    done
    echo "$OWNED_TREE"
}

checkout_commit() {
    local tree="$1" commit="$2"
    git -C "$tree" checkout --detach "$commit" >/dev/null 2>&1
}
```

- [ ] **Step 2: `prepare_state`에 `S3`·`S4` 분기를 더한다**

`case` 문의 `*)` 앞에 넣는다.

```bash
        S3)
            [[ -n "$PAIR" ]] || { echo "S3 는 --pair A:B 가 필요하다" >&2; return 6; }
            wipe_cache
            checkout_commit "$tree" "${PAIR%%:*}"
            gradle_run "$tree" "$OUT/discard.csv" "${targets[@]}"
            checkout_commit "$tree" "${PAIR##*:}"
            gradle_run "$tree" "$OUT/discard.csv" clean
            ;;
        S4)
            [[ -n "$PAIR" ]] || { echo "S4 는 --pair A:B 가 필요하다" >&2; return 6; }
            wipe_cache
            checkout_commit "$tree" "${PAIR%%:*}"
            gradle_run "$tree" "$OUT/discard.csv" "${targets[@]}"
            checkout_commit "$tree" "${PAIR##*:}"
            gradle_run "$tree" "$OUT/discard.csv" "${targets[@]}"
            gradle_run "$tree" "$OUT/discard.csv" clean
            ;;
```

`S4`는 커밋 `B`를 한 번 빌드해 캐시에 항목을 심은 뒤 출력만 지운다. 그것이 "CI가 이미 구웠다"를
대역한다.

- [ ] **Step 3: `builds.csv`에 `pair` 컬럼을 더한다**

헤더와 기록 줄을 각각 고친다.

```bash
echo "scenario,target,pair,iteration,wall_ms,daemon_id,daemon_build_no" > "$OUT/builds.csv"
```

```bash
    echo "$scenario,$target,${PAIR:-none},$iteration,$((end - start)),$(hostname)-$$,1" >> "$OUT/builds.csv"
```

그리고 실행 본문의 `TREE="${TREE:-$ROOT}"`를 다음으로 바꾼다.

```bash
TREE="$(ensure_tree)"
```

- [ ] **Step 4: 커밋 쌍으로 돌려 본다**

Run:
```bash
PAIR_A=$(git rev-parse HEAD~1)
PAIR_B=$(git rev-parse HEAD)
./tools/build-cache-bench/run.sh \
  --scenarios S3,S4 --pair "$PAIR_A:$PAIR_B" \
  --targets :core:util:jvm:compileKotlin --iterations 1
cat tools/build-cache-bench/runs/*/builds.csv
```

Expected: 2행이 나오고 `S4`의 `wall_ms`가 `S3`보다 작거나 같다. `S4`의 태스크 CSV에
`FROM_CACHE`가 `S3`보다 많다.

- [ ] **Step 5: 워킹 트리가 온전한지 확인한다**

Run:
```bash
git status --porcelain
git rev-parse --abbrev-ref HEAD
git worktree list
```

Expected: 변경 없음, 브랜치는 `build/remote-build-cache`, worktree 목록에 측정용 트리가 남아
있지 않다.

- [ ] **Step 6: 중단해도 안전한지 확인한다**

Run: 측정을 시작하고 몇 초 뒤 `Ctrl-C`로 끊은 다음 위 Step 5의 세 명령을 다시 실행한다.

Expected: 같은 결과다. worktree가 남아 있으면 `trap`이 동작하지 않은 것이므로 고친다.

- [ ] **Step 7: 커밋한다**

```bash
git add tools/build-cache-bench/run.sh
git commit -m "feat: 커밋 쌍 기반 S3·S4 시나리오와 격리 트리를 러너에 구현한다"
```

---

### Task 7: 요약 리포트와 README

**Files:**
- Modify: `tools/build-cache-bench/run.sh`
- Create: `tools/build-cache-bench/README.md`

**Interfaces:**
- Consumes: Task 5·6이 만든 `builds.csv`·`cache-size.csv`·`tasks/*.csv`.
- Produces: `summary.md`. 핵심 값, 참고값, 적중률(actionable 기준), `S3` 미스 태스크와 사유를 담는다.

- [ ] **Step 1: 요약 생성 함수를 추가한다**

```bash
# 핵심 값을 맨 앞에 둔다. 나머지는 그 값을 읽기 위한 참고값이다.
write_summary() {
    local md="$OUT/summary.md"
    {
        echo "# 빌드 캐시 측정 결과"
        echo
        echo "- 커밋 쌍: ${PAIR:-none}"
        echo "- 반복: $ITERATIONS (중앙값)"
        echo
        echo "## 핵심 값 — T_local(S3) − T_remote(S4)"
        echo
        echo "| target | S3 ms | S4 ms | 차이 ms |"
        echo "|---|---|---|---|"
        for target in ${TARGETS//,/ }; do
            local s3 s4
            s3=$(median_ms S3 "$target")
            s4=$(median_ms S4 "$target")
            if [[ -n "$s3" && -n "$s4" ]]; then
                echo "| $target | $s3 | $s4 | $((s3 - s4)) |"
            fi
        done
        echo
        echo "## 참고값"
        echo
        echo "| scenario | target | 중앙값 ms |"
        echo "|---|---|---|"
        for target in ${TARGETS//,/ }; do
            for scenario in ${SCENARIOS//,/ }; do
                local m
                m=$(median_ms "$scenario" "$target")
                [[ -n "$m" ]] && echo "| $scenario | $target | $m |"
            done
        done
        echo
        echo "## 캐시 적중률"
        echo
        echo "분모는 actionable 태스크다. included build(\`:build-logic:\`)와 SKIPPED·NO-SOURCE 를 뺀다."
        echo "그래야 Gradle 이 찍는 \`N actionable tasks\` 줄과 같은 기준이 된다."
        echo
        echo "| scenario | target | from_cache | actionable | 적중률 |"
        echo "|---|---|---|---|---|"
        for target in ${TARGETS//,/ }; do
            for scenario in ${SCENARIOS//,/ }; do
                local slug="$scenario-${target//:/_}-1"
                [[ -f "$OUT/tasks/$slug.csv" ]] || continue
                awk -F, -v s="$scenario" -v t="$target" '
                    NR>1 && $1 !~ /^:build-logic:/ && $2!="SKIPPED" && $2!="NO-SOURCE" {
                        n++; if ($2=="FROM_CACHE") hit++
                    }
                    END { if (n) printf "| %s | %s | %d | %d | %.1f%% |\n", s, t, hit, n, 100*hit/n }
                ' "$OUT/tasks/$slug.csv"
            done
        done
        echo
        echo "## S3 에서 캐시 미스로 남은 태스크"
        echo
        echo "사유는 init script 가 \`getExecutionReasons()\` 로 받은 값이다."
        echo
        echo '```'
        cat "$OUT/tasks"/S3-*.csv 2>/dev/null \
            | awk -F, 'NR>1 && $2=="EXECUTED" {sum[$1]+=$3; why[$1]=$4} END {for (t in sum) printf "%8d ms  %-60s %s\n", sum[t], t, why[t]}' \
            | sort -rn | head -30
        echo '```'
    } > "$md"
    echo "요약: $md"
}

median_ms() {
    local scenario="$1" target="$2"
    awk -F, -v s="$scenario" -v t="$target" \
        'NR>1 && $1==s && $2==t {v[n++]=$5} END {if (n==0) exit; asort(v); print v[int((n+1)/2)]}' \
        "$OUT/builds.csv" 2>/dev/null \
        || awk -F, -v s="$scenario" -v t="$target" \
            'NR>1 && $1==s && $2==t {print $5}' "$OUT/builds.csv" | sort -n | awk '{v[n++]=$1} END {if (n) print v[int((n-1)/2)]}'
}
```

`asort`는 GNU awk 전용이라 macOS 기본 awk에서 실패한다. 위의 `||` 뒤 폴백이 그 자리를 메운다.

실행 본문 끝의 `echo "결과: $OUT"` 앞에 `write_summary`를 부른다.

- [ ] **Step 2: 요약이 나오는지 확인한다**

Run:
```bash
PAIR_A=$(git rev-parse HEAD~1); PAIR_B=$(git rev-parse HEAD)
./tools/build-cache-bench/run.sh \
  --scenarios S1,S2,S3,S4 --pair "$PAIR_A:$PAIR_B" \
  --targets :core:util:jvm:compileKotlin --iterations 1
cat tools/build-cache-bench/runs/*/summary.md
```

Expected: 핵심 값 표에 `S3`·`S4`·차이가 채워지고, 참고값 표에 네 시나리오가 나오며, 적중률
표의 `S2` 행이 0%에 가깝고 `S1` 행이 그보다 훨씬 높다. 미스 태스크 목록은 시간 내림차순이고
각 줄 끝에 실행 사유가 붙는다.

- [ ] **Step 3: 교차 검증을 한다**

Run:
```bash
(cd "$(ls -d tools/build-cache-bench/runs/* | tail -1)" && \
  awk -F, 'NR>1 && $1 !~ /^:build-logic:/ {c[$2]++} END {for (o in c) print o, c[o]}' tasks/S2-*.csv)
```

그리고 같은 구성을 Gradle에서 직접 돌려 마지막 요약 줄을 본다.

```bash
./gradlew :core:util:jvm:compileKotlin --rerun-tasks --offline 2>&1 | tail -3
```

Expected: `N actionable tasks: X executed, ...`의 X와 위 `EXECUTED` 건수가 맞는다. **대조 전에
`:build-logic:` 접두 태스크를 걸러야 한다** — 그 줄은 actionable 태스크만 세는데 리스너는
included build 태스크와 lifecycle 태스크까지 받는다.

- [ ] **Step 4: README를 작성한다**

`tools/build-cache-bench/README.md`에 다음을 담는다.

- 이 하니스가 답하려는 질문 한 줄과 스펙 문서 링크.
- 선행 조건: `local.properties`(`sdk.dir`·`kakao.native.app.key`·debug 키스토어 3종),
  `app/google-services.json`. 전부 `.gitignore` 대상이라 클론마다 각자 채운다는 사실.
- 시나리오 5종 표(스펙과 같은 표).
- **경고 둘**: `clean`이 대상 트리의 빌드 출력을 지운다는 것, 그리고 `S3`·`S4`는 전용 worktree를
  만들어 돌기 때문에 측정 중 그 디렉토리를 건드리면 안 된다는 것.
- 실행 예시 두 줄(가벼운 확인용, 전체 측정용).
- 결과 읽는 법: 핵심 값은 `S3 − S4`이고 `S2 − S1`이 아니라는 것과 그 이유.
- 측정 조건: `--offline` 고정, 회차마다 데몬 재기동, IDE를 닫고 돌릴 것.
- 한계 셋: OS 이식성 미확인, 전송 시간 미반영, 머신 간 수치 비교 불가.

- [ ] **Step 5: 커밋한다**

```bash
git add tools/build-cache-bench/run.sh tools/build-cache-bench/README.md
git commit -m "feat: 측정 요약 리포트 생성과 사용 문서를 추가한다"
```

---

## 실행 후

측정을 실제로 돌리기 전에 **도입 문턱값을 먼저 정한다.** `S3 − S4`가 얼마 이상이면 리모트
캐시를 세울 값어치가 있다고 볼 것인지를 측정 후에 정하면 결과에 맞춰 기준이 움직인다.
스펙의 열린 질문 둘(커밋 쌍 선정 기준, 문턱값)을 닫고 나서 측정에 들어간다.
