# 위키 질의응답 디스코드 봇

이 저장소의 `wiki/`를 근거로 디스코드에서 질문에 답하는 읽기 전용 봇이다.
설계는 [`specs/2026-09-17-wiki-discord-bot-design.md`](specs/2026-09-17-wiki-discord-bot-design.md)에 있다.

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

## 실행

```bash
npm start
```

## 테스트

```bash
npm test
```

## 주의

- 이 봇은 저장소를 읽기만 한다. `claude` 호출에서 `Bash`·`Edit`·`Write`·`NotebookEdit`·
  `WebFetch`를 차단한다. 이 인자를 고칠 때 `Bash`가 빠지지 않았는지 반드시 확인한다.
- `--restricted`는 쓰지 않는다. 스킬 로드를 막아 위키 규약이 적용되지 않는다.
- 모델은 `claude-sonnet-5`로 고정돼 있다. 바꾸려면 `src/claude-runner.js`의 `MODEL` 상수와
  그 테스트를 함께 고친다.
- `.env`에는 봇 토큰이 들어간다. 이 저장소는 public이므로 절대 커밋하지 않는다.
- 봇은 소유자 한 명의 구독 한도를 쓴다. `DAILY_QUOTA`로 상한을 관리한다.
