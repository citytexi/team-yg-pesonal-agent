# 저장소 문서 질의응답 디스코드 봇

이 저장소의 문서를 근거로 디스코드에서 질문에 답하는 읽기 전용 봇이다. 근거는 `wiki/`(정책)와
`parfait/`(구현·서버 계약), 그리고 기준선 커밋에 고정된 코드 사본 `TEAMYG-Android/` 셋이다. 설계는
[`specs/2026-09-17-wiki-discord-bot-design.md`](specs/2026-09-17-wiki-discord-bot-design.md)에 있고,
**답하는 규약은 `.claude/skills/ask/SKILL.md`에 있다** — 봇 코드에는 그 스킬을 로드하라는 한 줄만
들어 있으므로, 답변 방식을 바꿀 때는 스킬 파일을 고친다.

## 준비

1. 디스코드 개발자 포털에서 애플리케이션과 봇을 만든다.
2. Bot 설정에서 **Message Content Intent**를 켠다. 이게 없으면 멘션 본문을 못 읽는다.
3. OAuth2 URL 생성기에서 `bot` 스코프와 다음 권한을 골라 서버에 초대한다.
   View Channels, Send Messages, Send Messages in Threads, Create Public Threads,
   Read Message History.
4. `.env.example`을 `.env`로 복사하고 값을 채운다.

```bash
cd bot
npm install
cp .env.example .env
```

## 전용 클론

**봇은 작업 체크아웃과 다른 전용 클론에서 돌린다.** `REPO_ROOT`가 그 클론을 가리킨다. 이유는 둘이다.

- 봇은 `REPO_ROOT`의 작업 트리를 그대로 읽는다. 작업 체크아웃에서 돌리면 작업 중인 feature 브랜치와
  커밋하지 않은 변경을 근거로 답한다. 전용 클론은 `main`에 둔다.
- 코드 사본 `TEAMYG-Android/`는 전용 클론에서만 초기화한다. 작업 체크아웃(Obsidian vault로 여는
  클론)에서는 초기화하지 않는다(루트 `CLAUDE.md` "서브모듈 사본").

```bash
git clone <이 저장소> <전용 클론 경로>
cd <전용 클론 경로>
git submodule update --init TEAMYG-Android
cd bot && npm install
cp <기존 bot/.env> .env        # REPO_ROOT를 <전용 클론 경로>로 고친다
```

`.env`와 `data/`(세션·리포트)는 추적되지 않으므로 직접 옮긴다. 전용 클론에서는
`git config submodule.TEAMYG-Android.active false`를 설정하지 않는다(그 설정은 작업 체크아웃용이다).

## 저장소 갱신

전용 클론에서 실행한다.

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

## 실행

```bash
cd bot
npm start
```

`npm start` 는 `--env-file=.env` 를 상대경로로 읽으므로 반드시 `bot/` 안에서 돌린다.
Node 22 이상이 필요하다.

## 호출

허용 채널에서 `@봇 질문`으로 부르면 스레드를 열어 답한다. 그 스레드에서 다시 `@봇`으로 부르면 같은
맥락으로 되물음이 이어진다.

**봇은 메시지 본문에 자기 멘션이 있을 때만 반응한다.** 봇이 만든 스레드 안이어도 멘션이 없으면
반응하지 않는다. 봇의 메시지에 답장하는 것, 역할 멘션, `@everyone`은 멘션으로 치지 않는다.
스레드의 모든 메시지에 반응하던 때에는 사람들끼리 나누는 대화마다 봇이 끼어들었다.

## 말투

봇은 구어체 반말로, 질문자를 깔보며 답한다. 첫머리부터 본문까지 팩트 사이사이에 비꼼을 섞는다. 이 페르소나는
`src/claude-runner.js`의 `PERSONA_DIRECTIVE`에 있고 **봇에만** 걸린다. 사람이 직접 `ask` 스킬을 부르면
스킬의 「어투」 절대로 존댓말이 나온다. Figma 리포트 요약에도 걸리지 않는다.

말투만 바꾼다. 근거 블록, 기준 시점, "없으면 없다고 말한다"는 그대로다. **욕설과 비속어는 쓴다.**
금지는 둘이다. 외모·가족·신상은 건드리지 않고(저장소에서 읽은 실제 개인정보 포함), 혐오·차별 표현은
쓰지 않는다. 수위를 낮추거나 존댓말로 되돌리려면 그 상수의 문장을 고친다. 상수를 빈 문자열로
만들면 테스트가 실패하므로, 완전히 없앨 때는 테스트도 함께 고친다.

### 밈

봇은 답변 하나에 밈을 하나까지 섞는다. 쓸 수 있는 밈은 `src/memes.js`의 `MEMES`에 적힌 것뿐이고,
목록 밖의 밈은 쓰지 않는다. 허용 목록으로 둔 이유는 유행어 가운데 혐오 커뮤니티에서 나온 것이 많아서다.
항목은 문구(`phrase`)와 쓸 상황(`when`) 한 쌍이다. 밈은 몇 달이면 낡으므로 넣고 뺄 때는 이 목록만 고치고,
개수를 세는 테스트를 함께 맞춘다. 목록은 질문마다 시스템 프롬프트에 실리므로 길게 늘리지 않는다.

## Figma 코멘트 리포트

허용 채널에서 `@봇 figma`(또는 `@봇 /figma`)라고 부르면 그날의 Figma 코멘트 리포트를
스레드에 올린다. 본문이 **정확히** `figma` 일 때만 명령으로 읽는다. 앞머리만 보고 가르면
"figma 코멘트 정책이 뭐야" 같은 진짜 질문이 리포트 실행으로 새어 나간다.

동작은 두 단계로 갈린다.

1. `scripts/figma_comment_scheduler.py` 를 Node 가 자식 프로세스로 띄우고, 그 표준 출력을
   **한 글자도 고치지 않고** 2000자씩 쪼개 올린다. 원문을 LLM에 통과시키지 않으므로
   요약·재해석이 구조적으로 일어나지 않는다.
2. 그 리포트 본문을 `claude` 에 한 번 넘겨 "개발 필요 항목" 요약만 받아 뒤에 덧붙인다.
   이때는 `ask` 스킬이 아니라 요약 전용 지시를 쓴다.

Figma API 를 치는 주체는 파이썬이지 `claude` 가 아니다. `claude` 쪽 `Bash`·`WebFetch`
차단을 풀 이유가 없다는 뜻이다. **풀지 마라.**

설정은 전부 `.env` 에 있다. 조회할 파일 목록도 코드가 아니라 `FIGMA_FILES` 에 둔다.

```
FIGMA_TOKEN=figd_...
FIGMA_FILES=<파일키1>:디자인,<파일키2>:기획
```

파일키는 Figma 파일 URL의 `/design/<파일키>/` 자리에 있는 값이다. 라벨은 리포트에
찍히는 이름이라 아무렇게나 붙여도 된다. 라벨에 콜론이 들어가도 첫 콜론에서만 가른다.

`FIGMA_TOKEN` 이나 `FIGMA_FILES` 가 비어 있으면 명령은 설정 문제라고 답하고 프로세스를
띄우지 않는다. 리포트 txt 는 `bot/data/reports/` 에 남고 git 추적에서 제외돼 있다.

스크립트는 표준 라이브러리만 쓰므로 추가 설치가 없다. `python3` 가 없으면 `PYTHON_BIN` 으로
경로를 지정한다.

## 사주

허용 채널에서 `@봇 !사주`라고 부르면 사주 전용 스레드(이름이 `🔮 사주`로 시작)를 만들고 입력 폼을
올린다. `@봇 !사주 1990-05-15 07:30 남 서울`처럼 입력을 붙이면 폼 없이 바로 계산한다. 이후 그
스레드에서는 멘션만 하면 이어서 답하고, 대운 같은 추가 분석도 같은 세션에서 이어진다.
`!사주`가 문장 중간에 있으면 명령으로 읽지 않는다.

- 사주 스레드는 문서 질의응답과 세션 파일(`SAJU_SESSION_FILE`)이 따로다. 페르소나·밈·`ask` 스킬도
  싣지 않는다.
- 계산은 스킬의 `saju.py`가 한다. 봇이 MCP 서버(`src/saju-mcp-server.js`)로 `saju_calc` 도구
  하나만 감싸 `claude`에 준다. `claude`가 `saju.py`를 직접 실행하지 않는다.
- 스레드 판정은 **이름**으로 한다. 서버 관리자가 사주 스레드 이름을 바꾸면 그 스레드는 문서 질문
  스레드로 읽힌다. 이름을 바꾸지 않는다.

설정은 `.env`의 `SAJU_SKILL_DIR`부터다.

```
SAJU_SKILL_DIR=<스킬 경로>
```

스킬은 **저장소 밖**에 둔다. 이 저장소는 public이라 스킬 코드·절기 데이터를 커밋하지 않는다.
`SAJU_SKILL_DIR`이 비어 있으면 `!사주`는 설정 문제라고 답하고 `claude`를 띄우지 않는다. 나머지 키
(`SAJU_SESSION_FILE`·`SAJU_SANDBOX_DIR`·`SAJU_TIMEOUT_MS`·`SAJU_ENGINE_TIMEOUT_MS`)는
`.env.example`에 설명이 있다. 샌드박스는 저장소 git 트리 밖이어야 한다.

## 테스트

```bash
npm test
```

## 주의

- 이 봇은 저장소를 읽기만 한다. `claude` 호출에서 `Bash`·`Edit`·`Write`·`NotebookEdit`·
  `WebFetch`·`WebSearch`·`Agent`·`Read(./bot/**)`·`Grep(./bot/**)`와 서브모듈 경로 다섯
  (`./TEAMYG-Android/wiki/**`·`docs/**`·`.claude/**`·`.github/**`·`CLAUDE.md`)의 `Read`·`Grep` 짝 열을 더해
  열아홉을 차단한다. 이 인자를 고칠 때 `Bash`와 `Read(./bot/**)`가 빠지지 않았는지 반드시 확인한다.
- 서브모듈 경로 다섯은 비밀값이 아니라 **근거 범위**를 지키는 차단이다. 그쪽 `wiki/`·`docs/`는 이
  저장소의 `wiki/`·`parfait/`와 주제가 겹치는 사본이고, 나머지 셋은 그쪽 저장소의 에이전트 지시문이다.
- `Grep(./bot/**)`은 지금은 중복이다. 경로 규칙이 도구 이름이 아니라 읽는 대상에 걸려서
  `Read(./bot/**)`만으로도 `bot/` 아래 `Grep` 이 거부된다(2026-09-17 실측). `parfait/` 확장으로
  `Grep` 이 봇의 주 탐색 도구가 됐기 때문에 의도를 표면에 남겨 둔 것이고, 빼도 당장은 동작이
  같지만 그 판정이 바뀌면 드러나지 않게 뚫린다.
- `--restricted`는 쓰지 않는다. 스킬 로드를 막아 위키 규약이 적용되지 않는다.
- 모델은 `claude-sonnet-5-5`로 고정돼 있다. 바꾸려면 `src/claude-runner.js`의 `MODEL` 상수와
  그 테스트를 함께 고친다.
- `.env`에는 디스코드 봇 토큰과 Figma 토큰이 들어간다. 이 저장소는 public이므로 절대
  커밋하지 않는다. 두 토큰 모두 `claude-runner.js`의 `SECRET_ENV_KEYS`에 올라 있어 `claude`
  자식 프로세스에는 넘어가지 않는다. **이 목록에서 빼면 채널에서 토큰을 물어 가져갈 수 있다.**
- `claude` 는 저장소 루트에서 돌기 때문에 `bot/` 아래 파일을 읽을 수 있다. 그래서
  `--disallowed-tools` 에 `Read(./bot/**)` 가 들어 있다. **이 규칙을 빼면 팀원이 봇에게
  `.env` 를 읽어 달라고 해서 토큰을 가져갈 수 있다.**
- `--allowed-tools` 는 화이트리스트가 아니다. 목록에 없는 도구도 `--permission-mode dontAsk`
  아래에서 그대로 돈다(실측 확인). 그래서 `WebSearch` 와 `Agent` 도 명시적으로 차단한다.
- 봇은 소유자 한 명의 구독 한도를 쓴다. `DAILY_QUOTA`로 상한을 관리한다.
- 사주 세션은 `Bash`를 열지 않는다. `--tools ""`로 내장 도구를 모두 끄고 `--strict-mcp-config`로
  `saju_calc` 하나만 남긴다. 샌드박스 `cwd`와 `--setting-sources ""` 덕에 저장소 문맥·개인 설정·메모리가
  세션에 실리지 않는다(실측, 위 라이브 테스트). 이 인자를 고칠 때 `--tools ""`가 빠지지 않았는지 확인한다.
- 팀원이 입력한 생년월일시는 봇 호스트의 `~/.claude/projects/` 세션 기록에 남는다. 개인정보라는 점을
  팀원에게 알리고, 호스트 접근을 제한한다.
- 음력 입력은 봇 호스트에 `korean-lunar-calendar` 파이썬 패키지가 있어야 한다. 없으면 스킬 오류가 그대로
  전달된다.
- 사주 라이브 테스트는 `RUN_LIVE=1 SAJU_SKILL_DIR=<스킬 경로> node --test test/claude-live.test.js`로
  돌린다. 둘 중 하나라도 없으면 건너뛴다.
