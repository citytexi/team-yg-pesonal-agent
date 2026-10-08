# TEAMYG-Android 서브모듈 도입 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로컬 체크아웃이 없는 봇·원격 세션이 `TEAMYG-Android` 코드를 읽을 수 있도록, 코드 저장소를 기준선 커밋에 고정된 읽기 전용 서브모듈로 추가한다.

**Architecture:** gitlink는 `parfait/android/doc-baseline.md` "현재 기준선"의 투영이며, 기준선 점검 스킬이 인덱스만 고쳐 올린다. 로컬에서는 서브모듈을 초기화하지 않고 봇 호스트에서만 초기화한다. 서브모듈 안의 `wiki/`·`docs/`·`.claude/`·`.github/`·`CLAUDE.md`는 봇 차단 인자와 문서 규칙 두 겹으로 막는다.

**Tech Stack:** git submodule, Node 22(`node:test`), `claude` CLI 헤드리스, 마크다운 스킬 문서.

**Spec:** `docs/superpowers/specs/2026-10-08-teamyg-android-submodule-design.md`

## Global Constraints

- **`git push`·`gh pr create`·`gh pr merge`는 실행하지 않는다.** 사용자 확인이 있어야 한다. `git commit`은 확인 없이 한다.
- 작업 브랜치는 `feat/teamyg-android-submodule`이다. 현재 브랜치 `docs/teamyg-android-submodule-spec`에서 분기한다. `main`에 직접 커밋하지 않는다.
- **이 저장소의 본 체크아웃에서 `TEAMYG-Android` 서브모듈을 초기화하지 않는다.** 본 체크아웃의 `.git/config`에는 `submodule.active = .`가 있어서 `--init`이 없어도 경로 없는 `git submodule update`가 새 서브모듈을 클론한다. 그래서 본 체크아웃에서는 `git submodule add`, **경로 없는 `git submodule update` 전부(`--init` 유무와 무관)**, `git submodule update --remote`, `--recurse-submodules`가 붙은 `pull`·`checkout`을 쓰지 않는다. 초기화가 필요한 검증은 세션 스크래치패드의 클론 `<S>`에서 한다.
- **`<S>`를 대상으로 하는 명령은 전부 `git -C <S> …` 또는 `( cd <S> && … )` 형태로 쓴다.** 본 체크아웃의 `TEAMYG-Android/`는 빈 디렉토리라서 `git -C TEAMYG-Android …`가 상위 저장소(이 저장소)를 대상으로 삼는다. cwd에 기대는 상대경로 명령을 쓰면 본 체크아웃의 HEAD가 옮겨지거나 서브모듈이 초기화된다.
- `git add -A`와 `git commit -a`를 쓰지 않는다. 커밋할 파일은 경로로 지정한다.
- `TEAMYG-Android` 저장소(기존 로컬 체크아웃 `<T>` 포함)의 파일을 수정하지 않는다. 그 저장소에는 `git rev-parse`와 `git fetch origin develop`만 실행한다.
- 셸 변수와 셸 함수는 Bash 호출 사이에 유지되지 않는다. 각 코드블록은 한 번의 호출 안에서 필요한 값을 다시 구한다.
- 서브모듈 경로는 정확히 `TEAMYG-Android`, URL은 정확히 `https://github.com/mash-up-kr/TEAMYG-Android.git`이다. `.gitmodules`에 `branch`를 적지 않는다.
- 차단 경로는 정확히 다섯이다: `./TEAMYG-Android/wiki/**`, `./TEAMYG-Android/docs/**`, `./TEAMYG-Android/.claude/**`, `./TEAMYG-Android/.github/**`, `./TEAMYG-Android/CLAUDE.md`. 각각 `Read(...)`와 `Grep(...)` 짝으로 넣어 10건이다.
- 미초기화 판정 파일은 `TEAMYG-Android/settings.gradle.kts`다.
- 불변식: gitlink 해시의 앞 9자 = `doc-baseline.md` "현재 기준선" 해시.
- 로컬 절대경로(username 포함)를 추적 파일에 적지 않는다. 기존 로컬 체크아웃은 `<T>`, 스크래치패드 클론은 `<S>`로 적고, `<T>`의 실제 값은 `wiki/personal-private/project-paths.md`에서 읽는다. `claude`의 답변 원문에 절대경로가 들어 있으면 그 부분을 `<S>`·`<T>`로 바꿔 적는다.
- 문서는 기존 문체(개조식 평서문 `~한다`)를 따르고, `bot/` 코드의 주석은 주변 주석의 언어와 밀도를 따른다.
- 커밋 메시지는 기존 관례(`docs: …한다`, `feat(bot): …한다`)를 따르고 끝에 `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`를 붙인다.

## Review Focus

1. `git status --porcelain`에 경로가 `TEAMYG-Android`를 **포함만** 하는 다른 파일(예: ` M docs/TEAMYG-Android-notes.md`)이 있을 때, 서브모듈 불일치 경고가 아니라 일반 dirty 경고가 나와야 한다. → Task 2
2. 서브모듈 줄과 다른 dirty 줄이 함께 있을 때, 두 경고가 모두 나와야 한다(하나가 다른 하나를 가리지 않는다). → Task 2
3. `TEAMYG-Android/` 디렉토리는 있지만 비어 있는 상태(미초기화의 실제 모습)에서 미초기화 경고가 나와야 한다. 디렉토리 존재만으로 초기화됐다고 판단하지 않는다. → Task 2
4. 새 차단 인자 10건이 `--disallowed-tools`와 `--output-format` **사이**에 들어가야 한다. 가변 인자라서 위치가 어긋나면 차단이 아니라 다른 플래그의 값으로 읽힌다. → Task 1
5. 기준선 점검의 delta 0건 조기 종료 경로에서도 gitlink가 올라가야 한다. 테스트할 코드가 없는 문서 절차이므로 Task 5의 검증 단계가 두 경로를 각각 확인한다. → Task 5

---

### Task 0: 브랜치 준비

- [ ] **Step 1: 브랜치를 만든다**

```bash
git checkout docs/teamyg-android-submodule-spec
git checkout -b feat/teamyg-android-submodule
```

- [ ] **Step 2: 기준선 테스트를 돌린다**

Run: `(cd bot && npm test)`
Expected: 전부 PASS. 실패가 있으면 멈추고 보고한다(이 계획이 만든 실패와 구분해야 한다).

- [ ] **Step 3: 링크 검사의 기준값을 기록한다**

Run: `python3 parfait/script/check_links.py parfait bot docs CLAUDE.md README.md`
Expected: "깨진 링크 0건". 이 스크립트는 읽기 전용이다. 0건이 아니면 그 목록을 기록해 두고, Task 6 Step 6에서 같은 목록인지 비교한다.

---

### Task 1: 봇 차단 인자

**Files:**
- Modify: `bot/src/claude-runner.js:8-22` (`BLOCKED_TOOLS`)
- Test: `bot/test/claude-runner.test.js`

**Interfaces:**
- Produces: `buildArgs()`가 돌려주는 배열에서 `--disallowed-tools` 뒤, `--output-format` 앞에 10건이 들어 있다. Task 6의 `bot/README.md`가 이 개수(기존 9 + 10 = 19)를 인용한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`bot/test/claude-runner.test.js`의 "봇 자신의 디렉토리를 읽지 못하게 막는다" 테스트 바로 아래에 별도 테스트로 추가한다.

```js
test("서브모듈의 문서·규칙 경로를 읽지 못하게 막는다", () => {
  const args = runner("success").buildArgs({ question: "질문", sessionId: "uuid-1" });
  const blocked = args.slice(args.indexOf("--disallowed-tools") + 1, args.indexOf("--output-format"));
  const paths = ["wiki/**", "docs/**", ".claude/**", ".github/**", "CLAUDE.md"];
  for (const path of paths) {
    for (const tool of ["Read", "Grep"]) {
      const rule = `${tool}(./TEAMYG-Android/${path})`;
      assert.ok(blocked.includes(rule), `${rule} 이 차단 목록에 없다`);
    }
  }
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd bot && node --test test/claude-runner.test.js`
Expected: FAIL — `Read(./TEAMYG-Android/wiki/**) 이 차단 목록에 없다`

- [ ] **Step 3: `BLOCKED_TOOLS`에 10건을 추가한다**

`Grep(./bot/**)` 뒤에 넣는다. 주석 한 덩어리로 이유를 적는다: 서브모듈은 코드만 읽히려는 것이고, 그 안의 `wiki/`·`docs/`는 이 저장소의 `wiki/`·`parfait/`와 주제가 겹치는 사본이며, `.claude/`·`.github/`·`CLAUDE.md`는 그쪽 저장소의 에이전트 지시문이다. `Grep` 짝은 `Grep(./bot/**)`와 같은 이유로 둔다.

- [ ] **Step 4: 통과를 확인한다**

Run: `cd bot && npm test`
Expected: 전부 PASS

- [ ] **Step 5: 커밋한다**

```bash
git add bot/src/claude-runner.js bot/test/claude-runner.test.js
git commit -m "feat(bot): 서브모듈의 문서·규칙 경로를 차단 인자에 추가한다"
```

---

### Task 2: 봇 시작 점검

`bot/src/index.js`는 최상위에서 게이트웨이를 띄우므로 테스트에서 import할 수 없다. 판정 로직을 새 모듈로 빼고 `index.js`는 호출만 한다.

**Files:**
- Create: `bot/src/repo-check.js`
- Create: `bot/test/repo-check.test.js`
- Modify: `bot/src/index.js:16-31`

**Interfaces:**
- Produces:
  - `export const SUBMODULE_PATH = "TEAMYG-Android"`
  - `export const DIRTY_WARNING = "WARNING: repo working tree is dirty; the bot must never write"`
  - `export const SUBMODULE_MISMATCH_WARNING = "WARNING: TEAMYG-Android submodule is not at the pinned commit; run: git submodule update --init TEAMYG-Android"`
  - `export const SUBMODULE_MISSING_WARNING = "WARNING: TEAMYG-Android submodule is not initialized; code lookups are disabled. run: git submodule update --init TEAMYG-Android"`
  - `export function repoWarnings(porcelain: string): string[]` — `git status --porcelain` 출력을 받아 경고 문구 배열을 돌려준다. 순수 함수다.
  - `export function submoduleMissingWarning(repoRoot: string, exists?: (path: string) => boolean): string | null` — `exists`의 기본값은 `node:fs`의 `existsSync`다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import {
  DIRTY_WARNING,
  SUBMODULE_MISMATCH_WARNING,
  SUBMODULE_MISSING_WARNING,
  repoWarnings,
  submoduleMissingWarning,
} from "../src/repo-check.js";

test("깨끗한 저장소는 경고가 없다", () => {
  assert.deepEqual(repoWarnings(""), []);
  assert.deepEqual(repoWarnings("\n"), []);
});

test("서브모듈만 어긋나면 서브모듈 경고만 낸다", () => {
  assert.deepEqual(repoWarnings(" M TEAMYG-Android\n"), [SUBMODULE_MISMATCH_WARNING]);
});

test("다른 파일이 바뀌면 dirty 경고를 낸다", () => {
  assert.deepEqual(repoWarnings(" M wiki/index.md\n"), [DIRTY_WARNING]);
});

test("경로에 이름이 들어 있을 뿐인 파일은 서브모듈로 보지 않는다", () => {
  assert.deepEqual(repoWarnings(" M docs/TEAMYG-Android-notes.md\n"), [DIRTY_WARNING]);
  assert.deepEqual(repoWarnings("?? TEAMYG-Android.md\n"), [DIRTY_WARNING]);
});

test("둘이 함께 있으면 두 경고를 모두 낸다", () => {
  assert.deepEqual(
    repoWarnings(" M TEAMYG-Android\n M wiki/index.md\n").sort(),
    [DIRTY_WARNING, SUBMODULE_MISMATCH_WARNING].sort(),
  );
});

test("판정 파일이 없으면 미초기화 경고를 낸다", () => {
  const seen = [];
  const warning = submoduleMissingWarning("/repo", (path) => {
    seen.push(path);
    return false; // 디렉토리는 있어도 비어 있는 상태
  });
  assert.equal(warning, SUBMODULE_MISSING_WARNING);
  assert.deepEqual(seen, [join("/repo", "TEAMYG-Android", "settings.gradle.kts")]);
});

test("판정 파일이 있으면 경고가 없다", () => {
  assert.equal(submoduleMissingWarning("/repo", () => true), null);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd bot && node --test test/repo-check.test.js`
Expected: FAIL — `Cannot find module '../src/repo-check.js'`

- [ ] **Step 3: `bot/src/repo-check.js`를 구현한다**

porcelain v1의 한 줄은 상태 두 글자 + 공백 + 경로다. 경로(`line.slice(3)`)가 `SUBMODULE_PATH`와 **정확히 같을 때만** 서브모듈 줄로 본다. 빈 줄은 건너뛴다. 같은 종류의 경고는 한 번만 넣는다.

- [ ] **Step 4: 통과를 확인한다**

Run: `cd bot && node --test test/repo-check.test.js`
Expected: 7건 PASS

- [ ] **Step 5: `index.js`를 새 모듈로 잇는다**

- `warnIfRepoDirty`는 `git status --porcelain` 실행과 `catch`를 그대로 두고, 판정만 `repoWarnings(output)`에 맡긴다. 돌아온 경고마다 `log(warning, output.slice(0, 500))`를 찍는다.
- 30~31행의 시작 구간에서 `warnIfRepoDirty(config.repoRoot)` 다음에 `submoduleMissingWarning(config.repoRoot)`를 한 번 호출하고, 값이 있으면 `log`로 찍는다. 봇은 계속 실행한다. 질문마다 도는 68·74행에는 넣지 않는다.

- [ ] **Step 6: 전체 테스트와 구문을 확인한다**

Run: `cd bot && npm test && node --check src/index.js`
Expected: 전부 PASS, `--check`는 출력 없이 종료 코드 0

- [ ] **Step 7: 커밋한다**

```bash
git add bot/src/repo-check.js bot/test/repo-check.test.js bot/src/index.js
git commit -m "feat(bot): 서브모듈 불일치와 미초기화를 시작 점검에서 알린다"
```

---

### Task 3: 서브모듈 등록

`git submodule add`는 본 체크아웃에 클론을 만들므로 쓰지 않는다. `.gitmodules`를 직접 쓰고 인덱스에 gitlink만 넣는다.

**Files:**
- Modify: `.gitmodules`
- Create: `TEAMYG-Android` (gitlink, 인덱스 전용)

**Interfaces:**
- Produces: 인덱스의 `160000 <40자 해시> 0	TEAMYG-Android`. Task 5의 스킬 절차와 Task 7의 실측이 이 gitlink를 쓴다.

- [ ] **Step 1: 기준선 해시를 읽고 전체 해시로 푼다**

`parfait/android/doc-baseline.md`의 "현재 기준선" 절에서 `**커밋**` 값(9자)을 읽는다. 스펙 작성 시점 값은 `4c40ddfee`이지만 **실행 시점의 값을 쓴다.** `<T>`는 `wiki/personal-private/project-paths.md`의 `TEAMYG-Android` 경로다.

```bash
full=$(git -C <T> rev-parse <기준선 9자>^{commit})
echo "$full"
```

Expected: 40자 해시 한 줄. `unknown revision`이면 `git -C <T> fetch origin develop` 뒤 다시 실행한다(fetch는 그 저장소의 작업 트리와 브랜치를 바꾸지 않는다). Step 3이 같은 호출 안에서 `$full`을 다시 구하므로 여기서는 값만 확인한다.

- [ ] **Step 2: `.gitmodules`에 항목을 추가한다**

기존 `wiki/personal-private` 항목 뒤에 붙인다. 들여쓰기는 탭이다.

```
[submodule "TEAMYG-Android"]
	path = TEAMYG-Android
	url = https://github.com/mash-up-kr/TEAMYG-Android.git
```

- [ ] **Step 3: 로컬 설정으로 자동 초기화를 막고, gitlink를 인덱스에 넣는다**

```bash
git config submodule.TEAMYG-Android.active false
mkdir TEAMYG-Android
full=$(git -C <T> rev-parse <기준선 9자>^{commit})
git update-index --add --cacheinfo 160000,"$full",TEAMYG-Android
git add .gitmodules
```

- `submodule.TEAMYG-Android.active false`는 `.git/config`에 들어가는 **추적되지 않는 로컬 설정**이다. 이 값이 있으면 경로 없는 `git submodule update`가 `TEAMYG-Android`를 건너뛴다. 클론마다 따로 설정해야 하므로 Task 6이 `CLAUDE.md`에 적는다.
- `mkdir`를 빠뜨리면 git이 gitlink를 삭제된 것으로 보아 `git status`가 `AD TEAMYG-Android`를 낸다. 빈 디렉토리가 미초기화 서브모듈의 정상적인 모습이다. 이후 브랜치를 오갈 때는 git이 이 디렉토리를 스스로 만들고 지운다.

- [ ] **Step 4: 본 체크아웃 상태를 확인한다**

```bash
git ls-files -s TEAMYG-Android
git submodule status TEAMYG-Android
git status --porcelain
```

Expected:
- 첫 줄은 `160000 <full> 0	TEAMYG-Android`이고 해시 앞 9자가 기준선과 같다.
- 둘째 줄은 `-<full> TEAMYG-Android`다(앞의 `-`는 미초기화를 뜻한다).
- 셋째는 스테이징된 두 항목(`M  .gitmodules`, `A  TEAMYG-Android`)만 보인다. 둘째 칸이 비어 있어야 한다. `AD`나 ` D`가 보이면 `TEAMYG-Android` 디렉토리가 없는 것이다.

- [ ] **Step 5: 커밋한다**

```bash
git commit -m "feat: TEAMYG-Android를 기준선 커밋에 고정한 읽기 전용 서브모듈로 등록한다"
git status --porcelain
```

Expected: 커밋 뒤 `git status --porcelain`의 출력이 비어 있다.

- [ ] **Step 6: 스크래치패드 클론에서 초기화가 되는지 확인한다**

`<S>`는 세션 스크래치패드 아래의 `submodule-probe` 디렉토리다. 이 클론은 Task 7에서 다시 쓴다.

```bash
git clone --quiet --branch feat/teamyg-android-submodule "$(git rev-parse --show-toplevel)" <S>
git -C <S> submodule update --init TEAMYG-Android
git -C <S>/TEAMYG-Android rev-parse HEAD
test -f <S>/TEAMYG-Android/settings.gradle.kts && echo INITIALIZED
git -C <S> status --porcelain
```

Expected: 해시가 Step 1의 40자 해시와 같고, `INITIALIZED`가 찍히고, 마지막 명령의 출력이 비어 있다. `wiki/personal-private`는 초기화하지 않았으므로 SSH 키를 요구하지 않는다. 이 단계가 실제 HTTPS URL과 기준선 커밋의 원격 도달 가능성을 처음으로 확인한다. 클론이 실패하면 멈추고 오류 원문을 보고한다.

마지막으로 본 체크아웃이 그대로인지 확인한다: `git submodule status TEAMYG-Android`의 출력이 여전히 `-`로 시작해야 한다.

---

### Task 4: `ask` 스킬

**Files:**
- Modify: `.claude/skills/ask/SKILL.md` (3행, 8행, 16~31행, 74~101행, 119~123행. 줄 번호는 수정 전 기준이며 앞 단계의 삽입으로 밀린다. 각 단계는 인용한 문장으로 위치를 찾는다)

**Interfaces:**
- Consumes: Global Constraints의 차단 경로 다섯과 판정 파일.
- Produces: 스킬 본문의 "코드 확인" 갈래. Task 7의 실측 B가 실패하면 이 파일에 보완 문구를 한 줄 더한다.

- [ ] **Step 1: 머리말을 고친다**

- 3행 `description`: "이 저장소의 문서(wiki/ + parfait/)와 코드 사본(TEAMYG-Android/)을 근거로", "정책·서버 계약·구현 현황·구조 결정·코드 확인 다섯 갈래".
- 8행: "`wiki/`(정책)와 `parfait/`(구현), 그리고 기준선 커밋에 고정된 코드 사본 `TEAMYG-Android/`를 근거로 질문에 답한다."

- [ ] **Step 2: 갈래 표에 한 줄을 더하고 의존 방향을 고친다**

표 마지막에 추가한다.

```
| 코드 확인 | "C-106 배치 화면 컴포저블 어느 파일이야" | `parfait/` 문서가 가리키는 경로·심볼을 `Grep`으로 `TEAMYG-Android/`에서 찾는다 |
```

29~31행의 의존 방향 문단을 "**코드 → 구현 문서 → 위키** 순의 단방향"으로 고치고 다음을 더한다.

- 코드는 구현 현황의 근거로만 쓴다. 코드를 근거로 정책을 단정하지 않는다.
- 코드와 `parfait/` 문서가 어긋나면 둘을 나란히 적고 어긋난다고 말한다. 어느 쪽이 맞는지 판정하지 않는다.
- 문서가 답하는 질문에는 코드를 열지 않는다.

- [ ] **Step 3: "코드 사본을 읽는 법" 절을 새로 넣는다**

"## 2. parfait는 통독하지 않는다" 절의 끝, "## 3. archive는 폐기가 아니다" 앞에 넣는다. 제목은 `## 3. 코드 사본은 찾아서 읽는다`이고, 뒤의 절 번호를 하나씩 민다(기존 3~8절이 4~9절이 된다). 이 스킬의 절 번호를 가리키는 다른 문서는 없다. 절의 내용은 넷이다.

1. **통독하지 않는다.** `Grep`·`Glob`으로 심볼과 파일을 찾아 필요한 구간만 읽는다.
2. **읽지 않는 경로**: `TEAMYG-Android/wiki/`, `TEAMYG-Android/docs/`, `TEAMYG-Android/.claude/`, `TEAMYG-Android/.github/`, `TEAMYG-Android/CLAUDE.md`. **다섯을 한 줄에 하나씩 목록으로 적는다.** 정책은 이 저장소 `wiki/`, 구현 문서는 `parfait/`만 근거로 쓴다. 봇에서는 차단 인자로도 막혀 있다.
3. **경로 대응 규칙**: 스펙 2.3절의 표 여섯 줄을 그대로 옮긴다. 대응 문서가 없으면 "코드는 그쪽 문서를 가리키지만 이 저장소에는 대응 문서가 없습니다"라고 답한다.
4. **미초기화 판정**: `Glob`으로 `TEAMYG-Android/settings.gradle.kts`를 찾는다. 없으면 코드 확인 갈래를 건너뛰고 "문서만으로 답했습니다"라고 밝힌다.

- [ ] **Step 4: 답변 형식을 고친다**

- 근거 예시 블록에 한 줄을 더한다: `· TEAMYG-Android/feature/…/SomeScreen.kt:42 (기준선 커밋의 코드)`. 경로는 실제 파일을 하나 골라 저장소 상대경로로 적는다(`git -C <S>/TEAMYG-Android ls-files 'feature/*Screen.kt'`에서 고른다).
- "parfait를 근거로 쓴 답변에는 기준 시점을 붙인다"를 "parfait나 코드를 근거로 쓴 답변에는"으로 넓힌다.
- **문장 단위로 바꾼다.** "Android 쪽은 `parfait/android/doc-baseline.md`의 "현재 기준선" 하나뿐이다."는 그대로 둔다. 그 뒤의 "이 저장소는 문서까지만 보고 코드 저장소를 열지 않으므로, **이 한 줄이 그 한계를 사람에게 알리는 장치다.**" 한 문장만 다음으로 바꾼다: "코드 사본도 이 해시의 커밋에 고정돼 있으므로, 코드를 근거로 쓴 답변도 같은 기준 시점을 붙인다. **이 한 줄이 그 한계를 사람에게 알리는 장치다.**" 이어지는 "기준선 이후 서버나 앱이 바뀌었으면 답변은 그것을 모른다."는 그대로 둔다.

- [ ] **Step 5: "없으면 없다고 말한다"를 고친다**

**문장 단위로 바꾼다.** 굵은 문장 "**"아마 이미 되어 있을 겁니다" 같은 문장을 쓰지 않는다.**"는 그대로 둔다. 그 뒤의 두 문장("근거로 댈 문서가 없으면 … 가 정답이다."와 "이 스킬은 코드 저장소를 열지 않으므로 그것이 정직한 한계선이다.")을 다음으로 바꾼다: "근거로 댈 문서가 없으면 코드 사본을 확인하고, 거기에도 없으면 '문서와 기준선 코드 어디에도 없습니다'가 정답이다. 코드 사본이 초기화되지 않은 환경에서는 '문서에 없습니다. 코드를 봐야 알 수 있습니다'가 정직한 한계선이다."

- [ ] **Step 6: 남은 모순 문장이 없는지 확인한다**

```bash
grep -n "열지 않" .claude/skills/ask/SKILL.md
grep -n "네 갈래\|세 갈래" .claude/skills/ask/SKILL.md
grep -c "TEAMYG-Android" .claude/skills/ask/SKILL.md
```

Expected: 첫 명령은 "문서가 답하는 질문에는 코드를 열지 않는다" 한 줄만 나온다. 둘째는 `"이 기능 가능해?"` 문단의 "세 갈래를 밟은 뒤"만 나온다(조합 질문의 서술이라 그대로 둔다). 셋째는 10 이상이다(머리말 둘, 갈래 표 하나, 차단 경로 다섯, 판정 파일 하나, 근거 예시 하나).

- [ ] **Step 7: 커밋한다**

```bash
git add .claude/skills/ask/SKILL.md
git commit -m "docs(ask): 코드 확인 갈래와 서브모듈 읽기 경계를 추가한다"
```

---

### Task 5: 기준선 점검 절차

**Files:**
- Modify: `.claude/skills/sync-teamyg-develop-baseline/SKILL.md:13,23,33`
- Modify: `parfait/android/doc-baseline.md` ("## 점검 절차" 절의 머리 문장과 4단계)

**Interfaces:**
- Consumes: Task 3이 만든 gitlink.
- Produces: 기준선을 올리는 모든 경로가 따르는 gitlink 갱신 절차.

- [ ] **Step 1: 스킬의 "핵심 규율"에 한 줄을 더한다**

13행 다음에 추가한다: "**서브모듈 `TEAMYG-Android/`는 `<T>`가 아니다.** 기준선 커밋에 고정된 봇 전용 사본이고 로컬에서는 초기화하지 않는다. 점검은 `<T>`에서 하고, gitlink는 인덱스만 고쳐 올린다."

- [ ] **Step 2: gitlink 갱신 절차를 넣고 두 경로에서 참조한다**

"## 단계" 목록 뒤, "## 경계" 앞에 다음 절을 넣는다.

````markdown
### gitlink 갱신 (기준선을 올릴 때마다)

불변식: gitlink 해시의 앞 9자 = `doc-baseline.md` "현재 기준선" 해시.

```bash
full=$(git -C <T> rev-parse <새 기준선 해시>^{commit})
git update-index --cacheinfo 160000,"$full",TEAMYG-Android
git ls-files -s TEAMYG-Android   # 해시 앞 9자가 새 기준선과 같아야 한다
```

`git submodule update --remote`는 쓰지 않는다(gitlink가 기준선을 앞지른다).
````

- 23행: "delta 0건이면 기준선 해시만 갱신하고 **아래 gitlink 갱신을 한 뒤** 종료 보고."
- 33행 끝에 추가: "**아래 gitlink 갱신을 한다.**"

- [ ] **Step 3: `doc-baseline.md` 절차 절을 고친다**

- 머리 문장("로컬 경로는 개인정보라 … 참고(아래 `<TEAMYG-Android>`)") 뒤에 추가한다: "`<TEAMYG-Android>`는 **기존 로컬 체크아웃의 절대경로**다. 저장소 루트의 서브모듈 경로 `TEAMYG-Android/`가 아니다."
- 4단계 끝에 추가한다: "같은 커밋으로 서브모듈 gitlink를 올린다 — `git update-index --cacheinfo 160000,$(git -C <TEAMYG-Android> rev-parse <새 기준선>^{commit}),TEAMYG-Android`. gitlink 해시의 앞 9자가 위 "현재 기준선"과 같아야 한다."

이 파일은 468KB다. 절 제목을 `grep -n "## 점검 절차"`로 찾아 그 구간만 읽고 고친다.

- [ ] **Step 4: 두 경로가 모두 절차를 가리키는지 확인한다**

```bash
grep -n "gitlink" .claude/skills/sync-teamyg-develop-baseline/SKILL.md
grep -n "gitlink" parfait/android/doc-baseline.md
```

Expected: 스킬에서 최소 넷(규율 한 줄, 조기 종료 줄, 5단계 줄, 새 절)이 나온다. `doc-baseline.md`에서 4단계 한 줄이 나온다.

- [ ] **Step 5: 절차가 실제로 도는지 현재 기준선으로 확인한다**

```bash
full=$(git -C <T> rev-parse <현재 기준선 9자>^{commit})
git update-index --cacheinfo 160000,"$full",TEAMYG-Android
git status --porcelain -- TEAMYG-Android
```

Expected: 출력이 비어 있다(이미 같은 해시이므로 인덱스가 바뀌지 않는다). `--add` 없이도 실패하지 않는다는 것이 확인된다.

- [ ] **Step 6: 커밋한다**

```bash
git add .claude/skills/sync-teamyg-develop-baseline/SKILL.md parfait/android/doc-baseline.md
git commit -m "docs: 기준선 점검의 두 종료 경로에 gitlink 갱신을 추가한다"
```

---

### Task 6: 안내 문서

**Files:**
- Modify: `CLAUDE.md` (3~9행, "프로젝트 컨텍스트", "Public repo 주의")
- Modify: `README.md` (구성 표)
- Modify: `docs/project-context.md`
- Modify: `bot/README.md` (3~4행, "주의" 절, 새 "저장소 갱신" 절)
- Modify: `bot/specs/2026-09-17-wiki-discord-bot-design.md` (결정 표, 100행 예시)
- Modify: `.claude/skills/start-orchestration-session/SKILL.md:104-106`
- Modify: `.claude/skills/start-default-session/SKILL.md:13,17`

**Interfaces:**
- Consumes: Task 1의 차단 19건, Task 2의 경고 문구, Task 3의 서브모듈 경로.

- [ ] **Step 1: `CLAUDE.md`**

- 3행 "네 축"을 "다섯 축"으로 고치고 목록에 추가한다: "**`TEAMYG-Android/`** — 코드 저장소의 **읽기 전용 서브모듈**. `parfait/android/doc-baseline.md`의 기준선 커밋에 고정돼 있고, 로컬 체크아웃이 없는 봇·원격 세션이 코드를 읽는 용도다. **로컬에서는 초기화하지 않는다.**"
- 9행 `bot/` 설명의 근거를 "`wiki/`(정책)·`parfait/`(구현·서버 계약)·`TEAMYG-Android/`(기준선 코드)"로 고친다.
- "프로젝트 컨텍스트 (필수)" 절의 마지막 줄(`자세한 내용은 [docs/project-context.md](docs/project-context.md).`) **앞**에 "### 서브모듈 사본" 소절을 넣는다. 내용은 다섯이다.
  - 코드 작업 대상은 계속 `project-paths.md`의 기존 체크아웃이다. 서브모듈은 작업 대상이 아니다.
  - 서브모듈 안에서 커밋·브랜치 생성·파일 수정을 하지 않는다.
  - 서브모듈 안의 `wiki/`·`docs/`·`.claude/`·`.github/`·`CLAUDE.md`는 읽지 않는다. 정책은 이 저장소 `wiki/`, 구현 문서는 `parfait/`만 근거로 쓴다.
  - 서브모듈 명령은 경로를 명시한다(`git submodule update --init wiki/personal-private`). **경로 없는 `git submodule update`는 `--init`이 없어도 쓰지 않고, `--recurse-submodules`도 쓰지 않는다.**
  - 클론마다 한 번 `git config submodule.TEAMYG-Android.active false`를 실행한다. 추적되지 않는 로컬 설정이고, 이 값이 있으면 경로 없는 `git submodule update`가 이 서브모듈을 건너뛴다.
- "Public repo 주의" 절의 "서브모듈 내용 수정 시 절차"를 "`wiki/personal-private` 서브모듈 내용 수정 시 절차"로 고치고, `TEAMYG-Android` 서브모듈은 읽기 전용이며 gitlink는 `sync-teamyg-develop-baseline`만 올린다는 한 줄을 더한다.

- [ ] **Step 2: `README.md`와 `docs/project-context.md`**

- `README.md` 구성 표에 두 행을 더한다: `bot/`(디스코드 질의응답 봇, 기존 누락분)과 `TEAMYG-Android/`(코드 저장소의 읽기 전용 서브모듈, 기준선 커밋 고정, 봇·원격 세션용).
- `docs/project-context.md`의 "repo 두 개로 분리" 절 뒤에 "## 서브모듈 사본과 작업 체크아웃" 절을 넣는다. 표 두 행으로 구분한다: 기존 로컬 체크아웃(코드 작업 대상, 절대경로는 private 파일, 그쪽 `CLAUDE.md`가 적용됨)과 서브모듈 `TEAMYG-Android/`(읽기 전용, 기준선 커밋, 로컬 미초기화, 그쪽 `CLAUDE.md`·`wiki/`·`docs/`를 읽지 않음).
- 새 절의 표 아래에 로컬에서 초기화하지 않는 이유 셋을 적는다: 기준선 커밋의 낡은 사본을 작업 대상으로 오인하지 않게 한다 / 이 저장소는 루트가 Obsidian vault이고 두 저장소에 파일명이 같은 md가 225개 있어 위키링크가 사본으로 풀릴 수 있다 / `parfait/script/check_links.py`를 인자 없이 돌리면 서브모듈 문서까지 검사한다.
- 같은 파일의 "그 repo 규칙은 해당 디렉토리에서 파일을 열면 자동 로드된다" 문장에 "이는 기존 체크아웃에 대한 서술이다. 서브모듈 사본에서는 그 규칙을 적용하지 않는다"를 덧붙인다.

- [ ] **Step 3: `bot/README.md`**

- 3~4행: "근거는 `wiki/`(정책)와 `parfait/`(구현·서버 계약), 그리고 기준선 커밋에 고정된 코드 사본 `TEAMYG-Android/` 셋이다."
- "## 실행" 앞에 "## 저장소 갱신" 절을 넣는다.

  ````markdown
  ## 저장소 갱신

  ```bash
  git pull
  git submodule update --init TEAMYG-Android
  ```

  둘째 줄을 빠뜨리면 서브모듈이 gitlink와 다른 커밋에 남아 봇이 낡은 코드로 답한다. 시작 로그에
  `TEAMYG-Android submodule is not at the pinned commit`이 찍히면 이 경우다. 서브모듈을 한 번도
  초기화하지 않았으면 `not initialized`가 찍히고 봇은 문서만으로 답한다.

  서브모듈 안에 비추적 파일이나 수정된 파일이 있어도 같은 `not at the pinned commit` 경고가 찍힌다.
  `git status`가 두 경우를 같은 줄로 내기 때문이다.

  경로를 반드시 적는다. `wiki/personal-private`는 봇 호스트에서 초기화하지 않아도 된다.
  **서브모듈 안에 `local.properties`·keystore 같은 비추적 파일을 만들지 않는다.** 차단 목록에
  없는 경로는 봇이 읽어 채널에 옮길 수 있다.
  ````

- "주의" 절 75~77행: "아홉을 차단한다"를 "열아홉을 차단한다"로 고치고, 서브모듈 차단 다섯 경로의 `Read`·`Grep` 짝 10건을 목록에 더한다. 이 다섯은 비밀값이 아니라 **근거 범위**를 지키는 차단이라는 설명을 한 문장 붙인다.

- [ ] **Step 4: `bot/specs/2026-09-17-wiki-discord-bot-design.md`**

원문을 지우지 않고 대체 표시를 붙인다.

- 결정 표의 "근거로 열지 않는 것" 행 근거 칸 끝에 추가한다: "**(2026-10-08 대체)** `TEAMYG-Android`는 기준선 커밋에 고정한 서브모듈로 연다 — (스펙 링크). `TEAMYG-SERVER`는 여전히 열지 않는다." 여기서 "(스펙 링크)"는 링크 텍스트가 `docs/superpowers/specs/2026-10-08-teamyg-android-submodule-design.md`이고 대상이 `../../docs/superpowers/specs/2026-10-08-teamyg-android-submodule-design.md`인 마크다운 링크다(`bot/specs/`에서 저장소 루트로 올라가는 상대경로).
- 100행의 `--disallowed-tools` 예시 코드블록 아래에 한 줄을 더한다: "현재 차단 목록은 `bot/src/claude-runner.js`의 `BLOCKED_TOOLS`가 정본이다(2026-10-08 서브모듈 차단 10건 추가)."

- [ ] **Step 5: 세션 스킬 두 건**

- `start-orchestration-session/SKILL.md` 106행의 "절대경로로 읽는다는 문장을 task spec에 함께 넣는다" 뒤에 추가한다: "team-yg repo 루트의 상대경로 `TEAMYG-Android/`는 기준선 커밋에 고정된 봇 전용 서브모듈이고 로컬에서는 비어 있다. 워커가 그 경로를 읽지 않게 task spec에 함께 적는다."
- `start-default-session/SKILL.md`의 세 곳을 고친다. 3행(description)의 "repo 3축 구조"는 "repo 구성"으로, 13행의 "repo 3축(raw/wiki/parfait)"은 "repo 구성(raw/wiki/parfait/bot + 읽기 전용 서브모듈 TEAMYG-Android)"으로, 17행의 "repo 3축 요약"은 "repo 구성 요약"으로 고친다.

- [ ] **Step 6: 링크와 서술을 확인한다**

```bash
python3 parfait/script/check_links.py parfait bot docs CLAUDE.md README.md
grep -n "아홉" bot/README.md
grep -n "네 축\|3축" CLAUDE.md .claude/skills/start-default-session/SKILL.md
test -f docs/superpowers/specs/2026-10-08-teamyg-android-submodule-design.md && echo LINK_TARGET_OK
```

Expected: 링크 검사가 Task 0 Step 3의 기준값과 같다(이 계획이 깨진 링크를 더하지 않았다). 둘째 명령은 "열아홉을 차단한다"가 든 한 줄만 나온다. 셋째 명령은 출력이 없다. 넷째는 `LINK_TARGET_OK`다.

- [ ] **Step 7: 커밋한다**

```bash
git add CLAUDE.md README.md docs/project-context.md bot/README.md \
  bot/specs/2026-09-17-wiki-discord-bot-design.md \
  .claude/skills/start-orchestration-session/SKILL.md \
  .claude/skills/start-default-session/SKILL.md
git commit -m "docs: 서브모듈 사본과 작업 체크아웃의 역할 구분을 안내 문서에 반영한다"
```

---

### Task 7: 실측

`claude -p`를 실제로 띄운다. **사용자의 구독 한도를 쓰므로 질문은 아래에 적힌 것만 던진다(실측 A 3회 + 실측 B 1회 + 응답 시간 3회 = 7회, 실측 B가 "로드됨"이면 재확인 1회를 더해 8회).** 모든 실행은 Task 3 Step 6의 스크래치패드 클론 `<S>`에서 한다. **이 태스크의 모든 명령은 `<S>`를 명시한다**(Global Constraints). 디스코드를 거치는 종단 확인은 봇 호스트에 배포한 뒤 사용자가 한다.

**Files:**
- Modify: `docs/superpowers/specs/2026-10-08-teamyg-android-submodule-design.md` (끝에 "## 5. 실측 결과" 절 추가)
- Modify(조건부): `.claude/skills/ask/SKILL.md`

**Interfaces:**
- Consumes: Task 1의 `createClaudeRunner`, Task 2의 `repoWarnings`·`submoduleMissingWarning`, Task 4의 스킬.

- [ ] **Step 1: 클론을 브랜치 끝으로 올린다**

```bash
git -C <S> rev-parse --show-toplevel
git -C <S> pull --quiet
git -C <S> submodule update --init TEAMYG-Android
git -C <S> status --porcelain
```

Expected: 첫 줄이 스크래치패드 아래의 `submodule-probe` 경로다(본 체크아웃 경로가 나오면 멈춘다). 마지막 출력이 비어 있다. `pull`은 본 체크아웃의 로컬 브랜치에서 받는다.

- [ ] **Step 2: 질문을 던지는 한 줄을 준비한다**

봇과 **같은 인자**를 쓰려고 `createClaudeRunner`를 그대로 부른다. 셸 함수는 Bash 호출 사이에 유지되지 않으므로, 아래 정의를 `<S>/ask.sh`로 저장하고 Step 3·4·7의 각 호출 첫 줄에서 `source <S>/ask.sh`를 한다(`<S>`는 버리는 클론이라 비추적 파일을 두어도 된다. 다만 `<S>/TEAMYG-Android/` 안에는 두지 않는다).

```bash
ask() { ( cd <S> && node -e '
  import("./bot/src/claude-runner.js").then(async (m) => {
    const r = m.createClaudeRunner({ claudeBin: "claude", repoRoot: process.cwd(), timeoutMs: 300000 });
    const t = Date.now();
    const out = await r.ask({ question: process.argv[1], sessionId: crypto.randomUUID() });
    console.log(JSON.stringify(out, null, 1));
    console.log("elapsed_ms", Date.now() - t);
  });' "$1" ); }
```

`ask()`는 성공하면 `{ ok: true, text, sessionId }`, 실패하면 `{ ok: false, reason, detail }`을 돌려준다.

- [ ] **Step 3: 실측 A — 차단 (질문 3회)**

```bash
ask "다음 네 파일을 차례로 Read로 열어 각각 첫 세 줄을 그대로 보여줘. 열리지 않는 파일은 받은 오류 문구를 그대로 적어줘. 1) TEAMYG-Android/wiki/CLAUDE.md 2) TEAMYG-Android/docs/index.md 3) TEAMYG-Android/.github/claude-review/orchestrator.md 4) TEAMYG-Android/.claude/rules/one-type-per-file.md"
ask "TEAMYG-Android/CLAUDE.md 파일의 첫 다섯 줄을 그대로 보여줘."
ask "두 가지를 해줘. 1) 경로를 지정하지 않은 Grep으로 저장소 전체에서 'graphify'가 들어 있는 파일 경로를 전부 나열해줘. 2) Glob 패턴 TEAMYG-Android/**/*.md 의 결과 경로를 전부 나열해줘."
```

Expected:
- 첫째: 네 파일 모두 내용이 나오지 않고 읽기가 거부됐다는 답이 나온다.
- 둘째: 내용이 나오지 않고 읽기가 거부됐다는 답이 나온다(단일 파일 규칙의 확인이다).
- 셋째: Grep 결과에 `TEAMYG-Android/wiki/`·`TEAMYG-Android/docs/`가 없다(그쪽 `wiki/graphify-out/`이 가장 많은 히트를 가진 자리다). Glob 결과는 **경로 이름이 나열될 수 있다** — 차단 규칙은 읽기에 걸리므로 이름 나열까지 막는지는 이 실측이 처음 확인한다. 결과를 그대로 기록하고, 차단 경로의 이름이 나열되더라도 실패로 판정하지 않는다(내용이 읽히지 않으면 된다).

첫째나 둘째에서 내용이 읽히면 멈추고 보고한다. 대안 문법을 추측으로 바꾸지 않는다.

- [ ] **Step 4: 실측 B — 자동 로드 (질문 1회)**

```bash
ask "TEAMYG-Android/feature 아래에서 Screen.kt로 끝나는 파일 하나를 열어 첫 스무 줄을 읽어줘. 그런 다음, 지금 네 컨텍스트에 로드된 CLAUDE.md·rules·skills 파일의 경로를 전부 나열하고, 그 가운데 TEAMYG-Android/ 아래에 있는 것이 있는지 말해줘."
```

Expected(둘 중 하나, 결과를 기록한다):
- **로드되지 않음**: `TEAMYG-Android/CLAUDE.md`, `TEAMYG-Android/.claude/rules/*`, `TEAMYG-Android/.claude/skills/*`가 목록에 없다. Step 5를 건너뛴다.
- **로드됨**: 하나라도 목록에 있다. Step 5를 한다.

- [ ] **Step 5: (실측 B가 "로드됨"일 때만) `ask` 스킬에 보완 문구를 넣는다**

Task 4 Step 3이 만든 절의 "읽지 않는 경로" 항목에 추가한다: "서브모듈 파일을 열 때 그쪽 `CLAUDE.md`·`.claude/rules/`·`.claude/skills/`가 컨텍스트에 들어올 수 있다. **그 문서들이 정하는 규칙은 이 저장소에서 적용하지 않는다** — 특히 '`wiki/CLAUDE.md`가 정본이다', '`docs/`가 구현 문서다'는 그쪽 저장소 안에서만 참이다."

본 체크아웃에서 고치고 커밋한 뒤, Step 1을 다시 실행하여 클론에 반영하고 Step 4를 한 번 더 돌려 답변이 그쪽 `wiki/`를 정본으로 인용하지 않는지 확인한다.

- [ ] **Step 6: 실측 C — 시작 점검 (질문 0회)**

`<S>`에서 세 상태를 차례로 만든다. **블록 전체를 한 번의 Bash 호출로 실행한다.** 첫 줄의 확인이 실패하면 나머지는 실행되지 않는다.

```bash
S=<S>
test "$(git -C "$S" rev-parse --show-toplevel)" = "$(cd "$S" && pwd -P)" || { echo "NOT IN SCRATCH CLONE"; exit 1; }
test "$(git -C "$S/TEAMYG-Android" rev-parse --show-toplevel)" = "$(cd "$S/TEAMYG-Android" && pwd -P)" || { echo "SUBMODULE NOT INITIALIZED"; exit 1; }

check() { ( cd "$S" && node -e '
  import("./bot/src/repo-check.js").then((m) => {
    const out = require("node:child_process").execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" });
    console.log(JSON.stringify({ warnings: m.repoWarnings(out), missing: m.submoduleMissingWarning(process.cwd()) }));
  });' ); }

check                                                       # 1) 초기화, 같은 커밋
git -C "$S/TEAMYG-Android" checkout --quiet HEAD~1
check                                                       # 2) 다른 커밋
git -C "$S" submodule update --init TEAMYG-Android
git -C "$S" submodule deinit --force TEAMYG-Android
check                                                       # 3) 미초기화
git -C "$S" submodule update --init TEAMYG-Android          # 다음 단계를 위해 복구
```

Expected:
1. `{"warnings":[],"missing":null}`
2. `warnings`에 `SUBMODULE_MISMATCH_WARNING` 하나, `missing`은 `null`
3. `warnings`는 `[]`, `missing`은 `SUBMODULE_MISSING_WARNING`

- [ ] **Step 7: 응답 시간과 답변 형식 (질문 3회)**

```bash
ask "C-106 토핑 배치 화면의 컴포저블이 어느 파일에 있어?"
ask "앱의 minSdk와 targetSdk 값이 얼마야? 코드 기준으로 알려줘."
ask "NetworkModule이 참조하는 설계 문서가 뭐야?"
```

Expected(세 질문 모두):
- `elapsed_ms`가 300000 미만이다.
- 답변이 `TEAMYG-Android/<경로>` 형식으로 코드를 인용하고 "기준 시점" 블록에 기준선 해시를 적는다.
- 셋째 질문의 답변이 그쪽 `docs/…` 경로를 근거로 인용하지 않고, `parfait/android/…`의 대응 문서를 인용하거나 대응 문서가 없다고 말한다.

시간 초과가 나오면 값을 기록하고 멈춘다. 진입 조건을 좁히는 것은 스펙 변경이므로 사용자에게 보고한다.

- [ ] **Step 8: 결과를 스펙에 기록한다**

스펙 끝에 "## 5. 실측 결과 (YYYY-MM-DD)" 절을 넣는다. 표의 열은 항목 / 기대 / 실제 / 판정이고, 행은 실측 A 셋·실측 B·실측 C 셋·응답 시간 셋이다. `elapsed_ms`는 실제 값을 적는다. 스펙 머리의 "상태"를 "구현 완료, 실측 반영"으로 고친다.

**절대경로를 적지 않는다.** `<S>`와 `<T>`의 실제 경로에는 username이 들어 있다. 답변 원문을 인용할 때 절대경로가 있으면 `<S>`·`<T>`로 바꾼다. 실측 B의 "로드된 파일 경로 나열" 답변이 특히 그렇다. 기록한 뒤 `grep -n "/Users/\|/private/tmp" docs/superpowers/specs/2026-10-08-teamyg-android-submodule-design.md`의 출력이 비어 있는지 확인한다.

스펙 3절 검증 5번("기준선 점검을 한 회차 돌린 뒤")은 이 계획에서 실행하지 않는다. 다음 기준선 점검 회차가 첫 실행이 되므로, 실측 결과 절에 "불변식은 다음 `sync-teamyg-develop-baseline` 회차에서 처음 검증된다"고 적는다.

- [ ] **Step 9: 전체 테스트와 본 체크아웃 상태를 확인한다**

```bash
(cd bot && npm test)
git status --porcelain
git ls-files -s TEAMYG-Android
```

Expected: 테스트 전부 PASS. 둘째 출력에 `TEAMYG-Android`가 없다(본 체크아웃은 미초기화 상태 그대로다). 셋째의 해시 앞 9자가 `doc-baseline.md` "현재 기준선"과 같다.

- [ ] **Step 10: 커밋하고 스크래치패드 클론을 지운다**

```bash
git add docs/superpowers/specs/2026-10-08-teamyg-android-submodule-design.md .claude/skills/ask/SKILL.md
git commit -m "docs: 서브모듈 차단·자동 로드·응답 시간 실측 결과를 스펙에 기록한다"
```

그다음 `<S>`의 경로를 출력하여 세션 스크래치패드 아래의 `submodule-probe`인지 **먼저 확인한 뒤**, 별도 호출로 지운다.

```bash
echo <S>          # 먼저 실행하여 경로를 눈으로 확인한다
rm -rf <S>        # 확인한 뒤 별도 호출로 실행한다
```

- [ ] **Step 11: 사용자에게 보고한다**

실측 표, 커밋 목록(`git log --oneline main..HEAD`), 남은 수동 작업(push·PR 승인, 봇 호스트에서 `git pull` + `git submodule update --init TEAMYG-Android` + 재시작, 디스코드 종단 확인)을 보고한다. push와 PR은 승인을 받은 뒤에 한다.
