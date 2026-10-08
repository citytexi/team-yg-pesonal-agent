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

## 실행

```bash
cd bot
npm start
```

`npm start` 는 `--env-file=.env` 를 상대경로로 읽으므로 반드시 `bot/` 안에서 돌린다.
Node 22 이상이 필요하다.

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
- 모델은 `claude-sonnet-5`로 고정돼 있다. 바꾸려면 `src/claude-runner.js`의 `MODEL` 상수와
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
