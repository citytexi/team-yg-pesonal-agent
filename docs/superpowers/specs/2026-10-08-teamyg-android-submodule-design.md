# TEAMYG-Android 서브모듈 도입 설계

- **작성일**: 2026-10-08
- **상태**: 설계 확정 대기 (서브에이전트 검수 1회 반영)
- **범위**: 저장소 구조(`.gitmodules`), 봇 차단 인자·시작 점검, `ask` 스킬, 기준선 점검 스킬, 안내 문서

## 1. 배경과 목적

이 저장소는 정책(`wiki/`)과 구현 문서(`parfait/`)만 가지고 있고, 실제 코드는 별도 저장소
`mash-up-kr/TEAMYG-Android`에 있다. 로컬 세션은 `wiki/personal-private/project-paths.md`에 적힌
절대경로로 코드 저장소를 열 수 있지만, **로컬 체크아웃이 없는 환경(디스코드 봇 호스트, 클라우드
세션)은 코드를 읽을 방법이 없다.** 그래서 봇은 "이 화면이 실제로 어떻게 구현되어 있는가"라는
질문에 `parfait/` 문서의 서술만으로 답하고, 문서에 없으면 "코드를 봐야 알 수 있습니다"에서 멈춘다.

목적은 그 환경에서도 코드를 읽을 수 있게 하는 것이다. 로컬 작업 방식은 바꾸지 않는다.

### 확정된 결정

| 결정 | 내용 |
|---|---|
| 용도 | 봇·원격 세션이 코드를 읽는 용도로만 쓴다. 코드 작업 대상은 기존 로컬 체크아웃 그대로다. |
| 갱신 시점 | `sync-teamyg-develop-baseline`이 기준선을 올릴 때 gitlink를 같은 커밋으로 올린다. |
| 위키 정본 | 정책은 이 저장소의 `wiki/`만 정본이다. 서브모듈 안의 `wiki/`는 읽지 않는다. |
| 구현 문서 | 서브모듈 안의 `docs/`도 읽지 않는다. 봇의 근거는 `wiki/` + `parfait/` + 코드다. |

### 뒤집는 기존 결정

`bot/specs/2026-09-17-wiki-discord-bot-design.md`의 결정 표는 실물 코드 저장소를 "근거로 열지
않는 것"으로 정했다. 근거는 둘이었다.

- **"봇이 남의 브랜치 상태에 좌우된다"**: 서브모듈은 기준선 커밋에 고정되므로 해소된다.
- **"코드 탐색으로 응답이 시간 초과된다"**: 해소되지 않았다. 3절 검증 6번으로 실측하고,
  2.3절의 "통독 금지" 규칙으로 완화한다.

### 전제가 된 사실

- `TEAMYG-Android`에는 자체 `wiki/`(추적 파일 156개)와 `docs/`(추적 파일 288개: adr 36·api 17·
  architecture 7·superpowers 210 등)가 이미 있다. 이 저장소의 `wiki/`·`parfait/`와 주제가 겹친다.
- 그쪽 `CLAUDE.md`는 `wiki/CLAUDE.md`를 위키 정본으로, `docs/`를 "이 앱의 구현 문서"로 선언한다.
- **구현 문서의 정본이 어느 쪽인지는 미해결이다**(`parfait/android/synthesis/open-questions.md`의
  OQ-P-411 ①). 이 스펙은 그 미결을 해소하지 않는다. "봇은 `parfait/`만 읽는다"는 봇의 근거 범위에
  대한 결정이고, 정본 결정이 그쪽으로 확정되면 2.2절의 `docs/**` 차단 두 줄과 2.3절의 경로 대응
  규칙을 뒤집으면 된다.
- `TEAMYG-Android`는 public이고 `.git`은 39MB다. 추적 파일에 비밀값은 없다
  (`http/http-client.env.json`은 빈 값, `local.default.properties`는 placeholder이고, keystore·
  `google-services.json`·`local.properties`는 그쪽 `.gitignore` 대상이라 체크아웃에 들어오지 않는다).

## 2. 설계

### 2.1 서브모듈

```
[submodule "TEAMYG-Android"]
	path = TEAMYG-Android
	url = https://github.com/mash-up-kr/TEAMYG-Android.git
```

- 경로는 저장소 루트의 `TEAMYG-Android/`다. `raw/`·`wiki/`·`parfait/`·`bot/`과 형제가 된다.
- URL은 HTTPS를 쓴다. public 저장소이므로 SSH 키가 없는 봇 호스트·클라우드 세션에서도
  초기화된다. 기존 `wiki/personal-private`(private, SSH)와 접근 방식이 다른 것은 의도한 것이다.
- **`branch`는 적지 않는다.** 이 값은 `git submodule update --remote`에서만 쓰이는데, 그 명령은
  gitlink를 기준선보다 앞으로 옮겨 2.4절의 불변식을 깬다. `--remote`는 쓰지 않는다.
- 최초 gitlink는 추가 시점의 `parfait/android/doc-baseline.md` "현재 기준선" 커밋으로 맞춘다
  (작성 시점 기준 `4c40ddfee`).

### 2.2 읽기 경계

**차단 목록에 없는 경로는 전부 읽힌다.** 아래 "허용" 행은 강제 장치가 아니라 의도의 서술이다.

| 구분 | 경로 | 근거 |
|---|---|---|
| 허용 | `app/` `app-preview/` `core/` `data/` `domain/` `feature/` `build-logic/` `gradle/` 및 루트 gradle 파일 | 코드와 빌드 설정 |
| 허용 | `http/` `tools/` 및 나머지 루트 파일 | 요청 예시·측정 하니스. 비밀값이 없고 문서 정본과 충돌하지 않는다 |
| 차단 | `TEAMYG-Android/wiki/**` | 정책 정본은 이 저장소 `wiki/` |
| 차단 | `TEAMYG-Android/docs/**` | 봇의 구현 문서 근거는 이 저장소 `parfait/` |
| 차단 | `TEAMYG-Android/.claude/**` `TEAMYG-Android/CLAUDE.md` | 그쪽 작업 규칙은 이 저장소의 질의응답에 적용되지 않는다 |
| 차단 | `TEAMYG-Android/.github/**` | `claude-review/orchestrator.md`가 "기본 지침보다 우선한다"로 시작하는 에이전트 프롬프트이고 그쪽 `wiki/`를 근거로 쓰라고 지시한다 |

차단은 두 겹으로 둔다.

1. **봇 차단 인자**: `bot/src/claude-runner.js`의 `BLOCKED_TOOLS`에 위 다섯 경로를 `Read(...)`와
   `Grep(...)` 짝으로 추가한다(10건). 기존 코드는 `Read` 규칙만으로 `Grep`까지 막힌다는 실측에
   기대지 않으려고 `Grep(./bot/**)`를 일부러 중복으로 둔다. 같은 의도를 따른다.
   단일 파일 규칙 `Read(./TEAMYG-Android/CLAUDE.md)`는 이 파일에 선례가 없으므로 3절 실측 A에서
   실제로 걸리는지 확인한다.
2. **문서 규칙**: 루트 `CLAUDE.md`와 `ask` 스킬에 같은 경계를 명시한다. 봇이 아닌 세션(클라우드,
   사람이 직접 부르는 `ask`)은 차단 인자가 없으므로 이 규칙이 유일한 방어선이다.

**봇 호스트 규칙**: 서브모듈 안에 비추적 파일(`local.properties`, keystore 등)을 만들지 않는다.
차단 목록에 없는 경로는 봇이 읽어서 채널에 그대로 옮길 수 있다.

### 2.3 `ask` 스킬

**추가하는 것**

- "1. 갈래를 먼저 가른다" 표에 **코드 확인** 갈래를 추가한다. 진입은 `parfait/` 문서가 가리키는
  경로·심볼을 `Grep`으로 찾는 것이다. 코드 저장소를 통독하지 않고, 문서가 답하는 질문에는 코드를
  열지 않는다.
- 의존 방향은 기존 규칙을 확장한다: **코드 → 구현 문서 → 위키** 순의 단방향이다. 코드는 구현
  현황의 근거로만 쓰고, 코드를 근거로 정책을 단정하지 않는다.
- 코드와 `parfait/` 문서가 어긋나면 둘을 나란히 적고 어긋난다고 답한다. 어느 쪽이 맞는지
  판정하지 않는다.
- 2.2절의 차단 경로를 스킬 본문에 적는다.
- **경로 대응 규칙**: 코드의 KDoc·주석 87곳이 그쪽 `docs/…`·`wiki/…` 경로를 가리킨다. 그 링크는
  따라가지 않고 이 저장소의 대응 문서를 연다.

  | 코드가 가리키는 경로 | 이 저장소에서 여는 경로 |
  |---|---|
  | `docs/adr/…` | `parfait/android/adr/…` |
  | `docs/architecture/…` | `parfait/android/architecture/…` |
  | `docs/superpowers/specs/…` | `parfait/android/specs/…` (없으면 `specs/archive/`) |
  | `docs/superpowers/plans/…` | `parfait/android/plans/…` (없으면 `plans/archive/`) |
  | `docs/api/…` | `parfait/api/…` |
  | `wiki/…` | `wiki/index.md`에서 같은 주제를 찾는다 (구조가 달라 1:1 대응이 없다) |

  대응 문서가 없으면 "코드는 그쪽 문서를 가리키지만 이 저장소에는 대응 문서가 없습니다"라고 답한다.
- **답변 형식**(6절): 코드를 근거로 쓴 답변은 `TEAMYG-Android/<경로>:<줄>`로 인용하고, 그 코드가
  `doc-baseline.md` "현재 기준선" 커밋 시점의 것임을 밝힌다.
- **미초기화 판정**: 봇은 `Bash`가 차단돼 git 상태를 볼 수 없다. `Glob`으로
  `TEAMYG-Android/settings.gradle.kts`를 찾아 없으면 서브모듈이 비어 있다고 판단하고, 코드 확인
  갈래를 건너뛴 뒤 "문서만으로 답했습니다"라고 밝힌다.

**고치는 것** — 지금 스킬에는 "코드 저장소를 열지 않는다"는 문장이 남아 있어, 그대로 두면 새
갈래와 모순되고 봇이 기존 문장을 따라 코드를 열지 않는다.

| 위치 | 현재 | 변경 |
|---|---|---|
| 3행 description | "wiki/ + parfait/", "네 갈래" | 코드와 다섯 갈래를 반영한다 |
| 8행 | "`wiki/`(정책)와 `parfait/`(구현)를 근거로" | 코드 사본(`TEAMYG-Android/`)을 근거에 더한다 |
| 100~101행 | "문서까지만 보고 코드 저장소를 열지 않으므로" | 기준선 커밋의 코드까지 본다는 한계로 고친다 |
| 122~123행 | "코드를 봐야 알 수 있습니다가 정답이다. … 코드 저장소를 열지 않으므로" | 코드 사본을 확인한 뒤에도 없으면 그렇게 답한다. 미초기화 환경에서는 기존 문장이 그대로 정답이다 |

### 2.4 갱신

**불변식: gitlink 커밋 = `doc-baseline.md` "현재 기준선" 커밋.** 기준선의 단일 출처는 계속
`doc-baseline.md`이고 gitlink는 그 투영이다. `doc-baseline.md`는 9자 단축 해시를, gitlink는 40자
전체 해시를 담으므로 비교는 앞 9자로 한다.

`sync-teamyg-develop-baseline`의 변경:

- gitlink 갱신은 **서브모듈을 초기화하지 않고** 인덱스만 고친다(2.5절). `<T>`는 스킬이 쓰는 기존
  로컬 체크아웃 placeholder다.

  ```bash
  full=$(git -C <T> rev-parse <새 기준선 해시>)
  git update-index --cacheinfo 160000,"$full",TEAMYG-Android
  ```

- **기준선을 올리는 두 경로 모두에 넣는다.** 5단계("기준선 갱신")뿐 아니라 2단계의 조기 종료
  ("delta 0건이면 기준선 해시만 갱신하고 종료 보고")에서도 gitlink를 올린다. 한쪽만 고치면 delta
  0건 회차마다 불변식이 깨진다.
- 커밋 전에 불변식을 확인한다: `git ls-files -s TEAMYG-Android`의 해시 앞 9자가 `doc-baseline.md`
  "현재 기준선"과 같아야 한다.
- `parfait/android/doc-baseline.md`의 절차 절에서 기준선 갱신은 4단계다. 그 줄에 같은 내용을 한 줄
  더하고, 절차 절의 placeholder `<TEAMYG-Android>`가 서브모듈 경로 `TEAMYG-Android/`가 아니라
  **기존 로컬 체크아웃**을 뜻한다는 주석을 붙인다(글자가 같아 오독 여지가 있다).

봇 호스트 갱신 절차(`bot/README.md`):

```bash
git pull
git submodule update --init TEAMYG-Android
```

- 경로를 명시한다. `wiki/personal-private`는 봇 호스트에서 초기화하지 않아도 된다.
- `git pull`만 하고 둘째 줄을 빠뜨리면 gitlink와 체크아웃이 어긋나 봇이 낡은 코드로 답한다. 이
  경우를 2.6절의 시작 점검이 잡는다.

### 2.5 로컬 작업

변경하지 않는다. `CLAUDE.md`와 `docs/project-context.md`에 다음을 추가한다.

- 코드 작업 대상은 계속 `project-paths.md`의 기존 체크아웃이다.
- **로컬에서는 `TEAMYG-Android` 서브모듈을 초기화하지 않는다.** 초기화하지 않은 서브모듈은 빈
  디렉토리로 남고 `git status`에도 나타나지 않는다. 이유는 셋이다.
  - 기준선 커밋에 고정된 낡은 사본을 작업 대상으로 오인하지 않게 한다.
  - 이 저장소는 루트가 Obsidian vault인데 두 저장소 사이에 파일명이 같은 md가 225개 있어,
    초기화하면 `[[위키링크]]`가 사본으로 풀릴 수 있다.
  - `parfait/script/check_links.py`를 인자 없이 돌리면 저장소 전체를 훑어 서브모듈 문서까지 검사한다.
- 서브모듈을 초기화하는 명령은 경로를 명시한다. private 서브모듈은
  `git submodule update --init wiki/personal-private`로 초기화한다. 경로 없는
  `git submodule update --init`은 둘 다 초기화한다.
- `CLAUDE.md`의 "서브모듈 내용 수정 시 절차"는 `wiki/personal-private` 전용임을 명시한다.
  `TEAMYG-Android` 서브모듈은 읽기 전용이고 그 안에서 커밋·브랜치 생성·파일 수정을 하지 않는다.
- `start-orchestration-session`이 워커에게 주는 지시에, 코드는 절대경로의 기존 체크아웃에서 읽고
  상대경로 `TEAMYG-Android/`는 쓰지 않는다는 문구를 추가한다.

### 2.6 봇 시작 점검

`bot/src/index.js`의 `warnIfRepoDirty`는 `git status --porcelain`이 비어 있지 않으면 "repo working
tree is dirty; the bot must never write"를 찍는다. 서브모듈이 생기면 호스트가 `submodule update`를
빠뜨린 경우에도 ` M TEAMYG-Android`가 나와 같은 문구가 찍히는데, 원인과 문구가 맞지 않는다.
반대로 미초기화 상태는 출력이 비어 봇이 조용히 문서만으로 답한다.

- 출력에 `TEAMYG-Android` 줄이 있으면 "서브모듈이 gitlink와 다른 커밋이다.
  `git submodule update --init TEAMYG-Android`를 실행하라"는 문구를 따로 찍는다.
- 시작 시 `TEAMYG-Android/settings.gradle.kts`가 없으면 "서브모듈이 초기화되지 않아 코드 확인
  갈래가 동작하지 않는다"는 경고를 찍는다. 봇은 계속 실행한다.

### 2.7 변경 파일

| 파일 | 변경 |
|---|---|
| `.gitmodules` | 서브모듈 항목 추가 |
| `TEAMYG-Android` (gitlink) | 신규 |
| `CLAUDE.md` | 구성 축 목록, `bot/` 축 설명(9행)의 근거 범위, 읽기 경계, 2.5절 규칙, 서브모듈 절차의 범위 |
| `README.md` | 구성 표에 서브모듈 행 |
| `docs/project-context.md` | 서브모듈과 기존 체크아웃의 역할 구분 |
| `bot/src/claude-runner.js` | `BLOCKED_TOOLS` 10건 추가 |
| `bot/src/index.js` | 2.6절 시작 점검 |
| `bot/test/claude-runner.test.js` | 차단 인자 10건 단언(기존 "봇 자신의 디렉토리" 테스트와 분리한 새 테스트) |
| `bot/test/` (시작 점검) | 서브모듈 불일치·미초기화 경고 문구 |
| `bot/README.md` | 근거 범위(3~4행), 호스트 갱신 절차, "주의" 절의 차단 개수와 목록, 비추적 파일 금지 |
| `bot/specs/2026-09-17-wiki-discord-bot-design.md` | 결정 표의 "근거로 열지 않는 것" 행과 차단 인자 예시에 이 스펙으로 대체됐다는 표시 |
| `.claude/skills/ask/SKILL.md` | 2.3절 전부 |
| `.claude/skills/sync-teamyg-develop-baseline/SKILL.md` | 2단계 조기 종료와 5단계에 gitlink 갱신, 불변식 확인 |
| `.claude/skills/start-orchestration-session/SKILL.md` | 워커 지시에 상대경로 사용 금지 |
| `.claude/skills/start-default-session/SKILL.md` | "repo 3축" 서술을 현재 구성에 맞춘다 |
| `parfait/android/doc-baseline.md` | 절차 절 4단계에 gitlink 갱신, placeholder 주석 |

## 3. 검증

1. `npm test`(`bot/`): `--disallowed-tools` 뒤에 2.2절의 10건이 모두 들어 있는지, 2.6절의 두
   경고가 각 상태에서 찍히는지 단언한다.
2. **실측 A — 차단**: 봇과 같은 인자로 `claude -p`를 띄워 다음을 확인한다.
   - `TEAMYG-Android/wiki/`·`docs/`·`.github/` 아래 파일의 `Read`가 거부된다.
   - 단일 파일 규칙이 걸려 `TEAMYG-Android/CLAUDE.md`의 `Read`가 거부된다.
   - 경로를 지정하지 않은 루트 `Grep`·`Glob` 결과에 차단 경로의 히트가 섞이지 않는다.
3. **실측 B — 자동 로드**: 같은 인자로 `TEAMYG-Android/feature/` 아래 파일을 읽게 한 뒤, 그쪽
   `CLAUDE.md`, `.claude/rules/` 3건(`paths:` frontmatter), `.claude/skills/` 2건이 컨텍스트에
   들어왔는지 확인한다. `Read` 차단이 자동 로드까지 막는지는 지금 알 수 없다.
   - 막히지 않으면 `ask` 스킬에 "서브모듈의 `CLAUDE.md`·rules·skills가 정하는 규칙은 이 저장소에서
     적용하지 않는다"는 문구를 추가하여 보완한다.
4. **실측 C — 시작 점검**: 미초기화, gitlink와 같은 커밋, gitlink와 다른 커밋의 세 상태에서 봇을
   시작해 2.6절의 경고가 각각 맞게 찍히는지 확인한다.
5. **불변식**: 기준선 점검을 한 회차 돌린 뒤 `git ls-files -s TEAMYG-Android`의 앞 9자가
   `doc-baseline.md` "현재 기준선"과 같은지 확인한다. 로컬 `git status`에 `TEAMYG-Android`가
   나타나지 않아야 한다.
6. **응답 시간**: 봇에 코드 확인 질문 셋(화면 컴포저블의 위치, 특정 상수의 값, KDoc이 `docs/`를
   가리키는 심볼)을 던져 기본 `TIMEOUT_MS`(300000) 안에 답이 나오는지, 답변이 2.3절의 인용 형식과
   기준 시점 표기를 지키는지 확인한다. 시간 초과가 나오면 코드 확인 갈래의 진입 조건을 좁힌다.

## 4. 범위 밖

- OQ-P-411 ①(구현 문서 정본)의 해소, `parfait/`와 `TEAMYG-Android/docs/`의 중복 정리,
  `wiki/`와 `TEAMYG-Android/wiki/`의 중복 정리.
- `TEAMYG-Android` 저장소 쪽 파일 수정(그쪽 `CLAUDE.md`와 KDoc 링크 포함).
- `TEAMYG-SERVER`·`TEAMYG-iOS`의 서브모듈화.
- 봇 호스트의 자동 갱신(cron 등). 갱신은 기준선 PR 머지 후 수동 절차다.
- 클라우드 세션이 서브모듈을 자동으로 초기화하는지는 확인하지 않았다. 초기화되지 않으면 2.3절의
  미초기화 판정에 따라 문서만으로 답한다.
