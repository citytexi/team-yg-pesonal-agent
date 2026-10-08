# TEAMYG-Android 서브모듈 도입 설계

- **작성일**: 2026-10-08
- **상태**: 설계 확정 대기
- **범위**: 저장소 구조(`.gitmodules`), 봇 차단 인자, `ask` 스킬, 기준선 점검 스킬, 안내 문서

## 1. 배경과 목적

이 저장소는 정책(`wiki/`)과 구현 문서(`parfait/`)만 가지고 있고, 실제 코드는 별도 저장소
`mash-up-kr/TEAMYG-Android`에 있다. 로컬 세션은 `wiki/personal-private/project-paths.md`에 적힌
절대경로로 코드 저장소를 열 수 있지만, **로컬 체크아웃이 없는 환경(디스코드 봇 호스트, 클라우드
세션)은 코드를 읽을 방법이 없다.** 그래서 봇은 "이 화면이 실제로 어떻게 구현되어 있는가"라는
질문에 `parfait/` 문서의 서술만으로 답한다.

목적은 그 환경에서도 코드를 읽을 수 있게 하는 것이다. 로컬 작업 방식은 바꾸지 않는다.

### 확정된 결정

| 결정 | 내용 |
|---|---|
| 용도 | 봇·원격 세션이 코드를 읽는 용도로만 쓴다. 코드 작업 대상은 기존 로컬 체크아웃 그대로다. |
| 갱신 시점 | `sync-teamyg-develop-baseline`이 기준선을 올릴 때 gitlink를 같은 해시로 올린다. |
| 위키 정본 | 정책은 이 저장소의 `wiki/`만 정본이다. 서브모듈 안의 `wiki/`는 읽지 않는다. |

### 전제가 된 사실

- `TEAMYG-Android`에는 자체 `wiki/`(추적 파일 156개)와 `docs/`(adr 36·api 17·architecture 7·
  superpowers 210개 등)가 이미 있다. 이 저장소의 `wiki/`·`parfait/`와 주제가 겹친다.
- 그쪽 `CLAUDE.md`는 "`wiki/CLAUDE.md`가 정본"이라고 선언한다. 서브모듈 안의 파일을 열 때 이
  문서가 로드되면 위 "위키 정본" 결정과 충돌한다.
- `TEAMYG-Android`는 public이고 `.git`은 39MB다. 공개 범위와 용량 양쪽에서 서브모듈 추가에
  걸림돌이 없다.

## 2. 설계

### 2.1 서브모듈

```
[submodule "TEAMYG-Android"]
	path = TEAMYG-Android
	url = https://github.com/mash-up-kr/TEAMYG-Android.git
	branch = develop
```

- 경로는 저장소 루트의 `TEAMYG-Android/`다. `raw/`·`wiki/`·`parfait/`·`bot/`과 형제가 된다.
- URL은 HTTPS를 쓴다. public 저장소이므로 SSH 키가 없는 봇 호스트·클라우드 세션에서도
  초기화된다. 기존 `wiki/personal-private`(private, SSH)와 접근 방식이 다른 것은 의도한 것이다.
- 최초 gitlink는 추가 시점의 `parfait/android/doc-baseline.md` "현재 기준선" 해시로 맞춘다
  (작성 시점 기준 `4c40ddfee`).

### 2.2 읽기 경계

| 구분 | 경로 | 근거 |
|---|---|---|
| 허용 | `app/` `app-preview/` `core/` `data/` `domain/` `feature/` `build-logic/` `gradle/` 및 루트 gradle 파일 | 코드와 빌드 설정 |
| 차단 | `TEAMYG-Android/wiki/**` | 정책 정본은 이 저장소 `wiki/` |
| 차단 | `TEAMYG-Android/docs/**` | 구현 문서 정본은 이 저장소 `parfait/` |
| 차단 | `TEAMYG-Android/.claude/**` `TEAMYG-Android/CLAUDE.md` | 그쪽 작업 규칙은 이 저장소의 질의응답에 적용되지 않는다 |

차단은 두 겹으로 둔다.

1. **봇 차단 인자**: `bot/src/claude-runner.js`의 `BLOCKED_TOOLS`에 다음 넷을 추가한다.
   `Read(./TEAMYG-Android/wiki/**)`, `Read(./TEAMYG-Android/docs/**)`,
   `Read(./TEAMYG-Android/.claude/**)`, `Read(./TEAMYG-Android/CLAUDE.md)`.
   경로 규칙은 읽는 대상에 걸리므로 `Grep`·`Glob`에도 같이 적용된다(2026-09-17 실측, 같은 파일의
   주석 참고).
2. **문서 규칙**: 루트 `CLAUDE.md`에 같은 경계를 명시한다. 봇이 아닌 세션(클라우드, 사람이 직접
   부르는 `ask`)은 차단 인자가 없으므로 이 규칙이 유일한 방어선이다.

### 2.3 `ask` 스킬

- "1. 갈래를 먼저 가른다" 표에 **코드 확인** 갈래를 추가한다. 진입은 `parfait/` 문서가 가리키는
  경로·심볼을 `Grep`으로 찾는 것이다. 코드 저장소를 통독하지 않는다.
- 의존 방향은 기존 규칙을 확장한다: **코드 → 구현 문서 → 위키** 순의 단방향이다. 코드는 구현
  현황의 근거로만 쓰고, 코드를 근거로 정책을 단정하지 않는다.
- 코드와 `parfait/` 문서가 어긋나면 둘을 나란히 적고 어긋난다고 답한다. 어느 쪽이 맞는지
  판정하지 않는다. gitlink와 문서 기준선이 같은 해시이므로(2.4), 어긋남은 문서 드리프트를 뜻한다.
- 2.2의 차단 경로를 스킬 본문에도 적는다.
- 서브모듈이 초기화되지 않은 환경(`TEAMYG-Android/`가 빈 디렉토리)에서는 코드 확인 갈래를
  건너뛰고, 문서만으로 답했다는 사실을 답변에 밝힌다.

### 2.4 갱신

- `sync-teamyg-develop-baseline` 5단계("기준선 갱신")에 한 줄을 더한다. `doc-baseline.md`를 새
  해시로 올린 뒤 서브모듈을 같은 해시로 체크아웃하고 `git add TEAMYG-Android`로 gitlink를
  기준선 PR에 포함한다.
- 불변식: **gitlink 해시 = `doc-baseline.md` "현재 기준선" 해시.** 기준선의 단일 출처는 계속
  `doc-baseline.md`이고 gitlink는 그 투영이다.
- 봇 호스트 갱신 절차를 `bot/README.md`에 추가한다:
  `git pull` 후 `git submodule update --init TEAMYG-Android`.
  `wiki/personal-private`는 봇 호스트에서 초기화하지 않아도 되므로 경로를 명시한다.

### 2.5 로컬 작업

변경하지 않는다. `CLAUDE.md`와 `docs/project-context.md`에 다음을 추가한다.

- 코드 작업 대상은 계속 `project-paths.md`의 기존 체크아웃이다.
- 서브모듈 안에서는 커밋·브랜치 생성·파일 수정을 하지 않는다. 읽기 전용 참조 사본이다.
- 로컬에서 서브모듈을 초기화하지 않아도 된다.

### 2.6 변경 파일

| 파일 | 변경 |
|---|---|
| `.gitmodules` | 서브모듈 항목 추가 |
| `TEAMYG-Android` (gitlink) | 신규 |
| `CLAUDE.md` | 구성 축 목록에 서브모듈 추가, 읽기 경계, 로컬 작업 규칙 |
| `docs/project-context.md` | 서브모듈과 기존 체크아웃의 역할 구분 |
| `bot/src/claude-runner.js` | `BLOCKED_TOOLS` 4건 추가 |
| `bot/test/claude-runner.test.js` | 차단 인자 4건 단언 |
| `bot/README.md` | 호스트 갱신 절차, "주의" 절의 차단 목록 |
| `.claude/skills/ask/SKILL.md` | 코드 확인 갈래, 차단 경로, 미초기화 처리 |
| `.claude/skills/sync-teamyg-develop-baseline/SKILL.md` | 5단계에 gitlink 갱신 |
| `parfait/android/doc-baseline.md` | 절차 절에 gitlink 갱신 한 줄 |

## 3. 검증

1. `npm test`(`bot/`): `--disallowed-tools` 뒤에 2.2의 넷이 모두 들어 있는지 단언한다.
2. **실측 A — 차단**: 봇과 같은 인자로 `claude -p`를 띄워 `TEAMYG-Android/wiki/` 아래 파일을
   읽으라고 요청하고, 거부되는지 확인한다. `Grep`으로도 같은 요청을 한다.
3. **실측 B — `CLAUDE.md` 자동 로드**: 같은 인자로 `TEAMYG-Android/feature/` 아래 파일을 읽게 한
   뒤, 그쪽 `CLAUDE.md`의 내용이 컨텍스트에 들어왔는지 확인한다. `Read` 차단이 자동 로드까지
   막는지는 지금 알 수 없다.
   - 막히지 않으면 `ask` 스킬에 "서브모듈 `CLAUDE.md`의 위키·문서 규칙은 이 저장소에서
     적용하지 않는다"는 문구를 추가하여 보완한다.
4. **실측 C — 시작 경고**: `bot/src/index.js`의 `warnIfRepoDirty`가 서브모듈 초기화 상태에서
   경고를 내지 않는지 확인한다(gitlink와 체크아웃 해시가 같으면 `git status --porcelain`은 비어야 한다).
5. 봇에 코드 확인 질문 하나("C-106 화면 컴포저블이 어느 파일에 있어")를 던져 경로를 인용한 답이
   나오는지 확인한다.

## 4. 범위 밖

- `parfait/`와 `TEAMYG-Android/docs/`의 중복 정리, `wiki/`와 `TEAMYG-Android/wiki/`의 중복 정리.
- `TEAMYG-Android` 저장소 쪽 파일 수정(그쪽 `CLAUDE.md` 포함).
- `TEAMYG-SERVER`·`TEAMYG-iOS`의 서브모듈화.
- 봇 호스트의 자동 갱신(cron 등). 갱신은 기준선 PR 머지 후 수동 절차다.
