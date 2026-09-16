# 위키 질의응답 디스코드 봇 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 디스코드에서 멘션으로 질문을 받아, 구독 기반 `claude` CLI를 헤드리스로 돌려
이 저장소의 `wiki/`를 근거로 답하는 읽기 전용 봇을 만든다.

**Architecture:** 봇은 네 조각이다. `discord-gateway`가 디스코드 규격만 다루고,
`claude-runner`가 프로세스를 띄우며, `session-store`가 쓰레드와 세션 UUID의 대응을
파일에 보관하고, `rate-limiter`가 사용량을 센다. 위키를 읽는 규칙은 봇에 구현하지 않고
`claude`가 저장소 루트에서 실행될 때 자동으로 걸리는 `wiki/CLAUDE.md` 스키마와 `query`
스킬에 맡긴다.

**Tech Stack:** Node.js(ESM, 순수 JavaScript), `discord.js` v14, Node 내장 테스트 러너
(`node --test`). 빌드 단계 없음. 외부 런타임 의존성은 `discord.js` 하나뿐이다.

**Spec:** `bot/specs/2026-09-17-wiki-discord-bot-design.md`

## Global Constraints

- 언어는 순수 JavaScript(ESM)다. TypeScript·트랜스파일·번들러를 도입하지 않는다.
- 테스트는 Node 내장 러너만 쓴다. `jest`·`vitest`·`mocha`를 추가하지 않는다.
- 런타임 의존성은 `discord.js`만 허용한다. `dotenv`도 쓰지 않는다(Node의 `--env-file` 사용).
- 봇은 저장소를 읽기만 한다. 코드 어디에도 쓰기 도구를 허용하는 인자를 넣지 않는다.
- `claude` 호출 인자는 정확히 다음이며, 임의로 늘리거나 줄이지 않는다.
  `-p <질문> --permission-mode dontAsk --disallowed-tools Bash Edit Write NotebookEdit WebFetch --output-format json`
  첫 질문에는 `--session-id <uuid>`, 되물음에는 `--resume <uuid>`를 더한다.
- **`--restricted`를 쓰지 않는다.** 실측에서 스킬 로드를 막는 것이 확인됐다.
- `claude` 프로세스의 작업 디렉토리는 저장소 루트다. `--add-dir`은 쓰지 않는다.
- 비밀값을 커밋하지 않는다. `bot/.env`는 `.gitignore`에 넣고 `bot/.env.example`만 커밋한다.
  이 저장소는 public이다.
- 사용자에게 보이는 문구는 한국어로 쓴다. 코드 식별자·주석·커밋 메시지는 영어로 쓴다.
- 오류 문구에 로컬 절대경로나 스택을 넣지 않는다.
- 사용량 한도 기본값: 동시 실행 2, 사용자당 분당 2, 하루 60, 시간 초과 300000ms.
- 모든 시간 의존 모듈은 `now` 함수를 주입받는다. `Date.now()`를 모듈 안에서 직접 부르지 않는다.

## 파일 구조

| 경로 | 책임 |
|---|---|
| `bot/package.json` | 의존성·스크립트. ESM 선언 |
| `bot/.env.example` | 설정 키 목록과 설명 |
| `bot/README.md` | 실행·설정 방법 |
| `bot/src/config.js` | 환경변수를 읽어 검증된 설정 객체를 만든다 |
| `bot/src/message-split.js` | 긴 답변을 디스코드 2000자 단위로 나눈다 |
| `bot/src/session-store.js` | 쓰레드 ID ↔ 세션 UUID 대응을 파일에 보관한다 |
| `bot/src/rate-limiter.js` | 동시 실행·분당·일일 한도를 센다 |
| `bot/src/claude-runner.js` | `claude` 프로세스를 띄우고 답변 텍스트를 돌려준다 |
| `bot/src/gateway.js` | 디스코드 이벤트를 받아 위 조각들을 엮는다 |
| `bot/src/index.js` | 설정을 읽고 조각들을 조립해 기동한다 |
| `bot/test/*.test.js` | 위 모듈별 테스트 |
| `bot/test/fixtures/fake-claude.mjs` | `claude`를 대신하는 가짜 실행 파일 |

Task 1이 `bot/package.json`부터 `bot/src/config.js`까지를 함께 만든다. 스캐폴딩만 있는
커밋은 시험할 것이 없어 리뷰 가치가 없기 때문이다.

---

### Task 1: 프로젝트 뼈대와 설정 로더

**Files:**
- Create: `bot/package.json`
- Create: `bot/.env.example`
- Create: `bot/src/config.js`
- Modify: `.gitignore` (저장소 루트. 없으면 생성)
- Test: `bot/test/config.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: `loadConfig(env)` — 평범한 객체 `env`를 받아 다음 모양의 설정을 돌려준다.
  누락·형식 오류가 있으면 `Error`를 던진다.
  ```
  {
    discordToken: string,
    guildId: string,
    allowedChannelIds: string[],
    repoRoot: string,
    claudeBin: string,
    maxConcurrent: number,
    ratePerUserPerMin: number,
    dailyQuota: number,
    timeoutMs: number,
    sessionFile: string,
  }
  ```

- [ ] **Step 1: `bot/package.json`을 만든다**

```json
{
  "name": "wiki-discord-bot",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "test": "node --test test/",
    "start": "node --env-file=.env src/index.js"
  },
  "dependencies": {
    "discord.js": "^14.16.3"
  }
}
```

- [ ] **Step 2: `bot/.env.example`을 만든다**

```
# 디스코드 개발자 포털에서 발급한 봇 토큰
DISCORD_TOKEN=
# 응답할 길드(서버) ID
GUILD_ID=
# 응답할 채널 ID. 쉼표로 구분
ALLOWED_CHANNEL_IDS=
# claude 를 실행할 저장소 루트 절대경로
REPO_ROOT=
# claude 실행 파일 절대경로. `which claude` 로 확인
CLAUDE_BIN=/opt/homebrew/bin/claude
# 세션 대응표를 저장할 파일 경로
SESSION_FILE=./data/sessions.json
# 동시에 띄울 claude 프로세스 수
MAX_CONCURRENT=2
# 사용자 한 명의 분당 질문 수
RATE_PER_USER_PER_MIN=2
# 하루 총 질문 수
DAILY_QUOTA=60
# claude 프로세스 시간 초과(밀리초)
TIMEOUT_MS=300000
```

- [ ] **Step 3: 저장소 루트 `.gitignore`에 항목을 더한다**

파일이 이미 있으면 아래 네 줄을 끝에 덧붙인다. 없으면 이 내용으로 새로 만든다.

```
bot/.env
bot/node_modules/
bot/data/
```

- [ ] **Step 4: 실패하는 테스트를 쓴다**

`bot/test/config.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";

const base = {
  DISCORD_TOKEN: "token",
  GUILD_ID: "111",
  ALLOWED_CHANNEL_IDS: "222,333",
  REPO_ROOT: "/repo",
  CLAUDE_BIN: "/bin/claude",
};

test("필수 키가 모두 있으면 설정을 만든다", () => {
  const config = loadConfig(base);
  assert.equal(config.discordToken, "token");
  assert.equal(config.guildId, "111");
  assert.deepEqual(config.allowedChannelIds, ["222", "333"]);
  assert.equal(config.repoRoot, "/repo");
});

test("기본값을 채운다", () => {
  const config = loadConfig(base);
  assert.equal(config.maxConcurrent, 2);
  assert.equal(config.ratePerUserPerMin, 2);
  assert.equal(config.dailyQuota, 60);
  assert.equal(config.timeoutMs, 300000);
  assert.equal(config.sessionFile, "./data/sessions.json");
});

test("숫자 설정을 덮어쓸 수 있다", () => {
  const config = loadConfig({ ...base, DAILY_QUOTA: "10", TIMEOUT_MS: "1000" });
  assert.equal(config.dailyQuota, 10);
  assert.equal(config.timeoutMs, 1000);
});

test("채널 목록의 공백을 없애고 빈 항목을 버린다", () => {
  const config = loadConfig({ ...base, ALLOWED_CHANNEL_IDS: " 222 , ,333 " });
  assert.deepEqual(config.allowedChannelIds, ["222", "333"]);
});

test("필수 키가 없으면 그 이름을 담아 던진다", () => {
  const { DISCORD_TOKEN, ...missing } = base;
  assert.throws(() => loadConfig(missing), /DISCORD_TOKEN/);
});

test("채널 목록이 비면 던진다", () => {
  assert.throws(() => loadConfig({ ...base, ALLOWED_CHANNEL_IDS: "" }), /ALLOWED_CHANNEL_IDS/);
});

test("숫자가 아닌 값을 주면 그 키를 담아 던진다", () => {
  assert.throws(() => loadConfig({ ...base, DAILY_QUOTA: "many" }), /DAILY_QUOTA/);
});
```

- [ ] **Step 5: 테스트가 실패하는 것을 확인한다**

Run: `cd bot && npm install && npm test`
Expected: FAIL. `Cannot find module '../src/config.js'`

- [ ] **Step 6: `bot/src/config.js`를 쓴다**

```js
const REQUIRED = ["DISCORD_TOKEN", "GUILD_ID", "ALLOWED_CHANNEL_IDS", "REPO_ROOT", "CLAUDE_BIN"];

function readNumber(env, key, fallback) {
  const raw = env[key];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${key} must be a number, got: ${raw}`);
  return value;
}

export function loadConfig(env) {
  for (const key of REQUIRED) {
    if (!env[key]) throw new Error(`Missing required setting: ${key}`);
  }

  const allowedChannelIds = env.ALLOWED_CHANNEL_IDS.split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  if (allowedChannelIds.length === 0) {
    throw new Error("ALLOWED_CHANNEL_IDS must list at least one channel id");
  }

  return {
    discordToken: env.DISCORD_TOKEN,
    guildId: env.GUILD_ID,
    allowedChannelIds,
    repoRoot: env.REPO_ROOT,
    claudeBin: env.CLAUDE_BIN,
    sessionFile: env.SESSION_FILE || "./data/sessions.json",
    maxConcurrent: readNumber(env, "MAX_CONCURRENT", 2),
    ratePerUserPerMin: readNumber(env, "RATE_PER_USER_PER_MIN", 2),
    dailyQuota: readNumber(env, "DAILY_QUOTA", 60),
    timeoutMs: readNumber(env, "TIMEOUT_MS", 300000),
  };
}
```

- [ ] **Step 7: 테스트가 통과하는 것을 확인한다**

Run: `cd bot && npm test`
Expected: PASS. 7건 통과

- [ ] **Step 8: 커밋한다**

```bash
git add bot/package.json bot/package-lock.json bot/.env.example bot/src/config.js bot/test/config.test.js .gitignore
git commit -m "feat(bot): add project scaffolding and config loader"
```

---

### Task 2: 메시지 분할

**Files:**
- Create: `bot/src/message-split.js`
- Test: `bot/test/message-split.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: `splitMessage(text, limit = 2000) -> string[]`
  - 입력이 `limit` 이하면 원문 한 개를 담은 배열을 돌려준다.
  - 어떤 조각도 `limit`을 넘지 않는다.
  - 코드 펜스(```` ``` ````) 안에서 잘릴 때 앞 조각을 닫고 뒤 조각에서 같은 언어로 다시 연다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`bot/test/message-split.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { splitMessage } from "../src/message-split.js";

test("한도 이하는 그대로 한 조각이다", () => {
  assert.deepEqual(splitMessage("짧은 답변", 2000), ["짧은 답변"]);
});

test("정확히 한도 길이는 나누지 않는다", () => {
  const text = "가".repeat(2000);
  assert.deepEqual(splitMessage(text, 2000), [text]);
});

test("한도를 넘으면 나눈다", () => {
  const text = ("가".repeat(99) + "\n").repeat(30);
  const chunks = splitMessage(text, 2000);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) assert.ok(chunk.length <= 2000);
});

test("줄 경계에서 나눈다", () => {
  const lines = Array.from({ length: 10 }, (_, i) => `line${i}`.padEnd(30, "-"));
  const chunks = splitMessage(lines.join("\n"), 100);
  for (const chunk of chunks) {
    for (const line of chunk.split("\n")) {
      assert.ok(/^line\d-+$/.test(line), `잘린 줄: ${line}`);
    }
  }
});

test("코드 펜스가 걸치면 닫고 다시 연다", () => {
  const body = Array.from({ length: 10 }, (_, i) => `const x${i} = ${i};`).join("\n");
  const text = "설명\n\n```js\n" + body + "\n```";
  const chunks = splitMessage(text, 80);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    const fences = (chunk.match(/^```/gm) || []).length;
    assert.equal(fences % 2, 0, `펜스가 홀수인 조각: ${chunk}`);
  }
  assert.ok(chunks[1].startsWith("```js"), "뒤 조각이 같은 언어로 다시 열려야 한다");
});

test("개행 없는 긴 한 줄도 한도를 지킨다", () => {
  const chunks = splitMessage("a".repeat(5000), 2000);
  for (const chunk of chunks) assert.ok(chunk.length <= 2000);
  assert.equal(chunks.join("").replace(/\n/g, "").length, 5000);
});

test("빈 문자열은 빈 배열이다", () => {
  assert.deepEqual(splitMessage("", 2000), []);
});
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `cd bot && npm test -- --test-name-pattern="조각|나눈|펜스|한도|빈 문자열"`
또는 전체 실행: `cd bot && npm test`
Expected: FAIL. `Cannot find module '../src/message-split.js'`

- [ ] **Step 3: `bot/src/message-split.js`를 쓴다**

`FENCE_RESERVE`는 닫는 펜스 줄(```` ``` ```` + 개행)이 들어갈 자리를 미리 비워 두기 위한
값이다. 이 여유가 없으면 펜스를 닫는 순간 조각이 한도를 넘는다.

```js
const FENCE_RESERVE = 8;

function hardWrap(line, max) {
  if (line.length <= max) return [line];
  const parts = [];
  for (let i = 0; i < line.length; i += max) parts.push(line.slice(i, i + max));
  return parts;
}

export function splitMessage(text, limit = 2000) {
  if (text.length === 0) return [];
  if (text.length <= limit) return [text];

  const budget = limit - FENCE_RESERVE;
  const chunks = [];
  let current = [];
  let currentLength = 0;
  let openFenceLang = null;

  const startChunk = () => {
    current = openFenceLang === null ? [] : ["```" + openFenceLang];
    currentLength = current.length === 0 ? 0 : current[0].length + 1;
  };

  const flush = () => {
    if (current.length === 0) return;
    const body = openFenceLang === null ? current.join("\n") : current.join("\n") + "\n```";
    if (body.trim().length > 0) chunks.push(body);
    startChunk();
  };

  for (const rawLine of text.split("\n")) {
    for (const line of hardWrap(rawLine, budget)) {
      if (currentLength + line.length + 1 > budget && current.length > 0) flush();
      current.push(line);
      currentLength += line.length + 1;

      const fence = line.match(/^```(\S*)/);
      if (fence) openFenceLang = openFenceLang === null ? fence[1] : null;
    }
  }

  const tail = current.join("\n");
  if (tail.trim().length > 0) chunks.push(tail);
  return chunks;
}
```

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `cd bot && npm test`
Expected: PASS. Task 1의 7건에 더해 7건이 더 통과

- [ ] **Step 5: 커밋한다**

```bash
git add bot/src/message-split.js bot/test/message-split.test.js
git commit -m "feat(bot): split long answers at Discord's 2000-char limit"
```

---

### Task 3: 세션 보관소

**Files:**
- Create: `bot/src/session-store.js`
- Test: `bot/test/session-store.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: `createSessionStore({ filePath, now, ttlMs }) -> store`
  - `now`의 기본값은 `() => Date.now()`, `ttlMs`의 기본값은 7일(`604800000`)이다.
  - `store.get(threadId) -> string | null` — 만료됐거나 없으면 `null`
  - `store.set(threadId, sessionId) -> void` — 즉시 파일에 쓴다
  - `store.remove(threadId) -> void`
  - 파일이 없거나 JSON이 깨졌으면 빈 상태로 시작하고 예외를 던지지 않는다.
  - 파일이 놓일 디렉토리가 없으면 만든다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`bot/test/session-store.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSessionStore } from "../src/session-store.js";

function tempFile(name = "sessions.json") {
  const dir = mkdtempSync(join(tmpdir(), "session-store-"));
  return { dir, path: join(dir, name) };
}

test("없는 쓰레드는 null 이다", () => {
  const { dir, path } = tempFile();
  const store = createSessionStore({ filePath: path });
  assert.equal(store.get("thread-1"), null);
  rmSync(dir, { recursive: true, force: true });
});

test("저장한 값을 돌려준다", () => {
  const { dir, path } = tempFile();
  const store = createSessionStore({ filePath: path });
  store.set("thread-1", "uuid-1");
  assert.equal(store.get("thread-1"), "uuid-1");
  rmSync(dir, { recursive: true, force: true });
});

test("새 인스턴스에서도 값이 남는다", () => {
  const { dir, path } = tempFile();
  createSessionStore({ filePath: path }).set("thread-1", "uuid-1");
  assert.equal(createSessionStore({ filePath: path }).get("thread-1"), "uuid-1");
  rmSync(dir, { recursive: true, force: true });
});

test("ttl 이 지나면 null 이다", () => {
  const { dir, path } = tempFile();
  let clock = 1000;
  const store = createSessionStore({ filePath: path, now: () => clock, ttlMs: 500 });
  store.set("thread-1", "uuid-1");
  clock = 1499;
  assert.equal(store.get("thread-1"), "uuid-1");
  clock = 1501;
  assert.equal(store.get("thread-1"), null);
  rmSync(dir, { recursive: true, force: true });
});

test("remove 는 값을 지운다", () => {
  const { dir, path } = tempFile();
  const store = createSessionStore({ filePath: path });
  store.set("thread-1", "uuid-1");
  store.remove("thread-1");
  assert.equal(store.get("thread-1"), null);
  rmSync(dir, { recursive: true, force: true });
});

test("깨진 JSON 파일이면 빈 상태로 시작한다", () => {
  const { dir, path } = tempFile();
  writeFileSync(path, "{ not json");
  const store = createSessionStore({ filePath: path });
  assert.equal(store.get("thread-1"), null);
  store.set("thread-1", "uuid-1");
  assert.equal(store.get("thread-1"), "uuid-1");
  rmSync(dir, { recursive: true, force: true });
});

test("디렉토리가 없으면 만든다", () => {
  const { dir, path } = tempFile();
  const nested = join(dir, "a", "b", "sessions.json");
  const store = createSessionStore({ filePath: nested });
  store.set("thread-1", "uuid-1");
  assert.equal(createSessionStore({ filePath: nested }).get("thread-1"), "uuid-1");
  rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `cd bot && npm test`
Expected: FAIL. `Cannot find module '../src/session-store.js'`

- [ ] **Step 3: `bot/src/session-store.js`를 쓴다**

```js
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function readAll(filePath) {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    return {};
  } catch {
    return {};
  }
}

export function createSessionStore({ filePath, now = () => Date.now(), ttlMs = WEEK_MS }) {
  let entries = readAll(filePath);

  const persist = () => {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(entries, null, 2), "utf8");
  };

  return {
    get(threadId) {
      const entry = entries[threadId];
      if (!entry || typeof entry.sessionId !== "string") return null;
      if (now() - entry.updatedAt > ttlMs) {
        delete entries[threadId];
        persist();
        return null;
      }
      return entry.sessionId;
    },

    set(threadId, sessionId) {
      entries[threadId] = { sessionId, updatedAt: now() };
      persist();
    },

    remove(threadId) {
      delete entries[threadId];
      persist();
    },
  };
}
```

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `cd bot && npm test`
Expected: PASS. 누적 21건 통과

- [ ] **Step 5: 커밋한다**

```bash
git add bot/src/session-store.js bot/test/session-store.test.js
git commit -m "feat(bot): persist thread-to-session mapping with a TTL"
```

---

### Task 4: 사용량 제한

**Files:**
- Create: `bot/src/rate-limiter.js`
- Test: `bot/test/rate-limiter.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: `createRateLimiter({ maxConcurrent, perUserPerMin, dailyQuota, now }) -> limiter`
  - `limiter.acquire(userId) -> { ok: true, release: () => void } | { ok: false, reason: "daily" | "user" | "concurrent" }`
  - 검사 순서는 일일 → 사용자 → 동시 실행이다. 앞선 검사에서 거절되면 뒤 검사는 하지 않는다.
  - 일일 카운터는 `now()`의 현지 날짜(`YYYY-MM-DD`)가 바뀌면 초기화된다.
  - `release()`를 두 번 불러도 동시 실행 수가 음수로 내려가지 않는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`bot/test/rate-limiter.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../src/rate-limiter.js";

const DAY = 24 * 60 * 60 * 1000;

function build(overrides = {}) {
  const state = { clock: Date.parse("2026-09-17T09:00:00Z") };
  const limiter = createRateLimiter({
    maxConcurrent: 2,
    perUserPerMin: 2,
    dailyQuota: 60,
    now: () => state.clock,
    ...overrides,
  });
  return { limiter, state };
}

test("첫 요청은 허용된다", () => {
  const { limiter } = build();
  const result = limiter.acquire("user-1");
  assert.equal(result.ok, true);
});

test("사용자 분당 한도를 넘으면 reason 이 user 다", () => {
  const { limiter } = build();
  limiter.acquire("user-1").release();
  limiter.acquire("user-1").release();
  assert.deepEqual(limiter.acquire("user-1"), { ok: false, reason: "user" });
});

test("분당 한도는 다른 사용자에게 옮지 않는다", () => {
  const { limiter } = build();
  limiter.acquire("user-1").release();
  limiter.acquire("user-1").release();
  assert.equal(limiter.acquire("user-2").ok, true);
});

test("1분이 지나면 사용자 한도가 풀린다", () => {
  const { limiter, state } = build();
  limiter.acquire("user-1").release();
  limiter.acquire("user-1").release();
  state.clock += 60001;
  assert.equal(limiter.acquire("user-1").ok, true);
});

test("동시 실행 한도를 넘으면 reason 이 concurrent 다", () => {
  const { limiter } = build({ perUserPerMin: 100 });
  const first = limiter.acquire("user-1");
  limiter.acquire("user-2");
  assert.deepEqual(limiter.acquire("user-3"), { ok: false, reason: "concurrent" });
  first.release();
  assert.equal(limiter.acquire("user-3").ok, true);
});

test("일일 한도를 넘으면 reason 이 daily 다", () => {
  const { limiter, state } = build({ dailyQuota: 2, perUserPerMin: 100 });
  limiter.acquire("user-1").release();
  limiter.acquire("user-1").release();
  assert.deepEqual(limiter.acquire("user-1"), { ok: false, reason: "daily" });
  state.clock += DAY;
  assert.equal(limiter.acquire("user-1").ok, true);
});

test("일일 한도는 사용자 한도보다 먼저 판정된다", () => {
  const { limiter } = build({ dailyQuota: 1, perUserPerMin: 1 });
  limiter.acquire("user-1").release();
  assert.deepEqual(limiter.acquire("user-1"), { ok: false, reason: "daily" });
});

test("release 를 두 번 불러도 자리가 늘지 않는다", () => {
  const { limiter } = build({ maxConcurrent: 1, perUserPerMin: 100 });
  const first = limiter.acquire("user-1");
  first.release();
  first.release();
  assert.equal(limiter.acquire("user-2").ok, true);
  assert.deepEqual(limiter.acquire("user-3"), { ok: false, reason: "concurrent" });
});

test("거절된 요청은 어떤 카운터도 올리지 않는다", () => {
  const { limiter } = build({ maxConcurrent: 1, perUserPerMin: 100, dailyQuota: 3 });
  limiter.acquire("user-1");
  assert.equal(limiter.acquire("user-2").ok, false);
  assert.equal(limiter.acquire("user-2").ok, false);
  assert.equal(limiter.used().daily, 1);
});
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `cd bot && npm test`
Expected: FAIL. `Cannot find module '../src/rate-limiter.js'`

- [ ] **Step 3: `bot/src/rate-limiter.js`를 쓴다**

`used()`는 테스트와 로그를 위한 조회용이다. 거절된 요청이 카운터를 올리지 않는지
확인하는 데 쓴다.

```js
const MINUTE_MS = 60 * 1000;

function localDayKey(timestamp) {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function createRateLimiter({ maxConcurrent, perUserPerMin, dailyQuota, now = () => Date.now() }) {
  let running = 0;
  let dayKey = localDayKey(now());
  let dailyCount = 0;
  const userHits = new Map();

  return {
    acquire(userId) {
      const at = now();

      const today = localDayKey(at);
      if (today !== dayKey) {
        dayKey = today;
        dailyCount = 0;
      }
      if (dailyCount >= dailyQuota) return { ok: false, reason: "daily" };

      const hits = (userHits.get(userId) || []).filter((hit) => at - hit < MINUTE_MS);
      if (hits.length >= perUserPerMin) {
        userHits.set(userId, hits);
        return { ok: false, reason: "user" };
      }

      if (running >= maxConcurrent) {
        userHits.set(userId, hits);
        return { ok: false, reason: "concurrent" };
      }

      hits.push(at);
      userHits.set(userId, hits);
      dailyCount += 1;
      running += 1;

      let released = false;
      return {
        ok: true,
        release() {
          if (released) return;
          released = true;
          running -= 1;
        },
      };
    },

    used() {
      return { daily: dailyCount, running };
    },
  };
}
```

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `cd bot && npm test`
Expected: PASS. 누적 30건 통과

- [ ] **Step 5: 커밋한다**

```bash
git add bot/src/rate-limiter.js bot/test/rate-limiter.test.js
git commit -m "feat(bot): cap concurrent, per-user, and daily usage"
```

---

### Task 5: claude 실행기

**Files:**
- Create: `bot/src/claude-runner.js`
- Create: `bot/test/fixtures/fake-claude.mjs`
- Test: `bot/test/claude-runner.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: `createClaudeRunner({ claudeBin, repoRoot, timeoutMs, spawn }) -> runner`
  - `spawn`의 기본값은 `node:child_process`의 `spawn`이다.
  - `runner.buildArgs({ question, sessionId, resume }) -> string[]`
  - `runner.ask({ question, sessionId, resume }) -> Promise<Result>`
  - `Result`는 `{ ok: true, text: string, sessionId: string }` 또는
    `{ ok: false, reason: "timeout" | "exit" | "parse" | "empty" | "error", detail: string }`이다.
  - `detail`은 파일 로그용이며 디스코드에 그대로 올리지 않는다.

- [ ] **Step 1: 가짜 `claude`를 만든다**

`bot/test/fixtures/fake-claude.mjs`. 환경변수 `FAKE_MODE`로 동작을 고른다.

```js
#!/usr/bin/env node
const mode = process.env.FAKE_MODE || "success";
const args = process.argv.slice(2);

if (mode === "hang") {
  setTimeout(() => {}, 60000);
} else if (mode === "exit") {
  process.stderr.write("boom\n");
  process.exit(2);
} else if (mode === "garbage") {
  process.stdout.write("not json at all");
} else if (mode === "error-flag") {
  process.stdout.write(JSON.stringify({ is_error: true, subtype: "error_during_execution", result: "", session_id: "s-err" }));
} else if (mode === "empty") {
  process.stdout.write(JSON.stringify({ is_error: false, subtype: "success", result: "   ", session_id: "s-empty" }));
} else if (mode === "echo-args") {
  process.stdout.write(JSON.stringify({ is_error: false, subtype: "success", result: JSON.stringify(args), session_id: "s-echo" }));
} else {
  process.stdout.write(JSON.stringify({ is_error: false, subtype: "success", result: "답변 본문", session_id: "s-ok" }));
}
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`bot/test/claude-runner.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClaudeRunner } from "../src/claude-runner.js";

const here = dirname(fileURLToPath(import.meta.url));
const FAKE = join(here, "fixtures", "fake-claude.mjs");

function runner(mode, timeoutMs = 5000) {
  return createClaudeRunner({
    claudeBin: process.execPath,
    claudeArgsPrefix: [FAKE],
    repoRoot: here,
    timeoutMs,
    env: { ...process.env, FAKE_MODE: mode },
  });
}

test("첫 질문 인자에 --session-id 가 들어간다", () => {
  const args = runner("success").buildArgs({ question: "질문", sessionId: "uuid-1" });
  assert.ok(args.includes("--session-id"));
  assert.equal(args[args.indexOf("--session-id") + 1], "uuid-1");
  assert.ok(!args.includes("--resume"));
});

test("되물음 인자에 --resume 이 들어간다", () => {
  const args = runner("success").buildArgs({ question: "질문", sessionId: "uuid-1", resume: true });
  assert.ok(args.includes("--resume"));
  assert.equal(args[args.indexOf("--resume") + 1], "uuid-1");
  assert.ok(!args.includes("--session-id"));
});

test("쓰기 도구를 항상 차단한다", () => {
  const args = runner("success").buildArgs({ question: "질문", sessionId: "uuid-1" });
  const at = args.indexOf("--disallowed-tools");
  assert.ok(at > -1);
  const blocked = args.slice(at + 1, at + 6);
  assert.deepEqual(blocked, ["Bash", "Edit", "Write", "NotebookEdit", "WebFetch"]);
});

test("--restricted 를 절대 넣지 않는다", () => {
  const args = runner("success").buildArgs({ question: "질문", sessionId: "uuid-1" });
  assert.ok(!args.includes("--restricted"));
});

test("성공하면 본문과 세션 ID를 돌려준다", async () => {
  const result = await runner("success").ask({ question: "질문", sessionId: "uuid-1" });
  assert.deepEqual(result, { ok: true, text: "답변 본문", sessionId: "s-ok" });
});

test("비정상 종료는 reason 이 exit 다", async () => {
  const result = await runner("exit").ask({ question: "질문", sessionId: "uuid-1" });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "exit");
});

test("JSON 이 아니면 reason 이 parse 다", async () => {
  const result = await runner("garbage").ask({ question: "질문", sessionId: "uuid-1" });
  assert.equal(result.reason, "parse");
});

test("is_error 가 true 면 reason 이 error 다", async () => {
  const result = await runner("error-flag").ask({ question: "질문", sessionId: "uuid-1" });
  assert.equal(result.reason, "error");
});

test("공백뿐인 답변은 reason 이 empty 다", async () => {
  const result = await runner("empty").ask({ question: "질문", sessionId: "uuid-1" });
  assert.equal(result.reason, "empty");
});

test("시간이 초과되면 reason 이 timeout 이다", async () => {
  const result = await runner("hang", 300).ask({ question: "질문", sessionId: "uuid-1" });
  assert.equal(result.reason, "timeout");
});
```

- [ ] **Step 3: 테스트가 실패하는 것을 확인한다**

Run: `cd bot && npm test`
Expected: FAIL. `Cannot find module '../src/claude-runner.js'`

- [ ] **Step 4: `bot/src/claude-runner.js`를 쓴다**

`claudeArgsPrefix`는 시험에서 `node fake-claude.mjs` 형태로 부르기 위한 자리다.
실제 운영에서는 비어 있다.

```js
import { spawn as nodeSpawn } from "node:child_process";

const BLOCKED_TOOLS = ["Bash", "Edit", "Write", "NotebookEdit", "WebFetch"];

export function createClaudeRunner({
  claudeBin,
  repoRoot,
  timeoutMs,
  claudeArgsPrefix = [],
  env = process.env,
  spawn = nodeSpawn,
}) {
  function buildArgs({ question, sessionId, resume = false }) {
    return [
      ...claudeArgsPrefix,
      "-p",
      question,
      resume ? "--resume" : "--session-id",
      sessionId,
      "--permission-mode",
      "dontAsk",
      "--disallowed-tools",
      ...BLOCKED_TOOLS,
      "--output-format",
      "json",
    ];
  }

  function ask({ question, sessionId, resume = false }) {
    return new Promise((resolve) => {
      const child = spawn(claudeBin, buildArgs({ question, sessionId, resume }), {
        cwd: repoRoot,
        env,
      });

      let stdout = "";
      let stderr = "";
      let settled = false;

      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };

      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        finish({ ok: false, reason: "timeout", detail: `exceeded ${timeoutMs}ms` });
      }, timeoutMs);

      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });

      child.on("error", (error) => {
        finish({ ok: false, reason: "exit", detail: error.message });
      });

      child.on("close", (code) => {
        if (code !== 0) {
          finish({ ok: false, reason: "exit", detail: `code ${code}: ${stderr.slice(0, 500)}` });
          return;
        }

        let payload;
        try {
          payload = JSON.parse(stdout);
        } catch {
          finish({ ok: false, reason: "parse", detail: stdout.slice(0, 500) });
          return;
        }

        if (payload.is_error) {
          finish({ ok: false, reason: "error", detail: String(payload.subtype ?? "unknown") });
          return;
        }

        const text = typeof payload.result === "string" ? payload.result.trim() : "";
        if (text.length === 0) {
          finish({ ok: false, reason: "empty", detail: "result was blank" });
          return;
        }

        finish({ ok: true, text, sessionId: payload.session_id });
      });
    });
  }

  return { buildArgs, ask };
}
```

- [ ] **Step 5: 테스트가 통과하는 것을 확인한다**

Run: `cd bot && npm test`
Expected: PASS. 누적 40건 통과

- [ ] **Step 6: 커밋한다**

```bash
git add bot/src/claude-runner.js bot/test/claude-runner.test.js bot/test/fixtures/fake-claude.mjs
git commit -m "feat(bot): run claude headlessly with write tools disabled"
```

---

### Task 6: 응답 조립

디스코드 API를 건드리지 않는 순수 부분을 먼저 떼어낸다. 게이트웨이를 얇게 유지하기
위해서다.

**Files:**
- Create: `bot/src/replies.js`
- Test: `bot/test/replies.test.js`

**Interfaces:**
- Consumes: `splitMessage` (Task 2)
- Produces:
  - `threadName(question) -> string` — 80자로 자르고 개행을 공백으로 바꾼다. 빈 질문은 `"위키 질문"`.
  - `rejectionText(reason) -> string` — `"daily" | "user" | "concurrent"`에 대응하는 한국어 문구
  - `failureText(reason) -> string` — `"timeout" | "exit" | "parse" | "error" | "empty"`에 대응하는 한국어 문구
  - `answerMessages(text, { resumeFailed }) -> string[]` — 분할된 조각들. `resumeFailed`가
    참이면 첫 조각 앞에 맥락 끊김 안내를 붙인다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`bot/test/replies.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { threadName, rejectionText, failureText, answerMessages } from "../src/replies.js";

test("쓰레드 이름은 80자를 넘지 않는다", () => {
  assert.ok(threadName("가".repeat(200)).length <= 80);
});

test("쓰레드 이름의 개행을 공백으로 바꾼다", () => {
  assert.equal(threadName("첫 줄\n둘째 줄"), "첫 줄 둘째 줄");
});

test("빈 질문에도 이름이 있다", () => {
  assert.equal(threadName("   "), "위키 질문");
});

test("거절 사유마다 다른 문구를 쓴다", () => {
  const texts = ["daily", "user", "concurrent"].map(rejectionText);
  assert.equal(new Set(texts).size, 3);
  for (const text of texts) assert.ok(text.length > 0);
});

test("실패 사유마다 문구가 있다", () => {
  for (const reason of ["timeout", "exit", "parse", "error", "empty"]) {
    assert.ok(failureText(reason).length > 0);
  }
});

test("모르는 사유에도 문구를 준다", () => {
  assert.ok(failureText("unknown-reason").length > 0);
});

test("실패 문구에 경로나 스택을 넣지 않는다", () => {
  for (const reason of ["timeout", "exit", "parse", "error", "empty"]) {
    const text = failureText(reason);
    assert.ok(!text.includes("/"), `경로처럼 보이는 문구: ${text}`);
    assert.ok(!text.includes("Error:"), `스택처럼 보이는 문구: ${text}`);
  }
});

test("맥락이 끊기면 첫 조각에 안내를 붙인다", () => {
  const messages = answerMessages("답변", { resumeFailed: true });
  assert.ok(messages[0].includes("새로 시작"));
  assert.ok(messages[0].includes("답변"));
});

test("정상 답변에는 안내를 붙이지 않는다", () => {
  assert.deepEqual(answerMessages("답변", { resumeFailed: false }), ["답변"]);
});

test("긴 답변을 나눈다", () => {
  const messages = answerMessages(("가".repeat(99) + "\n").repeat(40), { resumeFailed: false });
  assert.ok(messages.length > 1);
  for (const message of messages) assert.ok(message.length <= 2000);
});
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `cd bot && npm test`
Expected: FAIL. `Cannot find module '../src/replies.js'`

- [ ] **Step 3: `bot/src/replies.js`를 쓴다**

```js
import { splitMessage } from "./message-split.js";

const THREAD_NAME_LIMIT = 80;
const RESUME_NOTICE = "이전 맥락이 끊겨 새로 시작합니다.";

const REJECTIONS = {
  daily: "오늘 질문 한도를 다 썼습니다. 내일 다시 물어봐 주세요.",
  user: "질문이 너무 빠릅니다. 잠시 뒤에 다시 물어봐 주세요.",
  concurrent: "지금 처리 중인 질문이 많습니다. 잠시 뒤에 다시 물어봐 주세요.",
};

const FAILURES = {
  timeout: "시간이 초과됐습니다. 질문을 좁혀서 다시 물어봐 주세요.",
  exit: "답변을 만들지 못했습니다. 잠시 뒤에 다시 물어봐 주세요.",
  parse: "답변을 읽지 못했습니다. 잠시 뒤에 다시 물어봐 주세요.",
  error: "답변 도중 문제가 생겼습니다. 잠시 뒤에 다시 물어봐 주세요.",
  empty: "답변이 비어 있었습니다. 질문을 바꿔서 다시 물어봐 주세요.",
};

const FALLBACK_FAILURE = "답변에 실패했습니다. 잠시 뒤에 다시 물어봐 주세요.";

export function threadName(question) {
  const flat = question.replace(/\s+/g, " ").trim();
  if (flat.length === 0) return "위키 질문";
  return flat.slice(0, THREAD_NAME_LIMIT);
}

export function rejectionText(reason) {
  return REJECTIONS[reason] ?? FALLBACK_FAILURE;
}

export function failureText(reason) {
  return FAILURES[reason] ?? FALLBACK_FAILURE;
}

export function answerMessages(text, { resumeFailed = false } = {}) {
  const body = resumeFailed ? `${RESUME_NOTICE}\n\n${text}` : text;
  return splitMessage(body, 2000);
}
```

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `cd bot && npm test`
Expected: PASS. 누적 50건 통과

- [ ] **Step 5: 커밋한다**

```bash
git add bot/src/replies.js bot/test/replies.test.js
git commit -m "feat(bot): build user-facing Korean reply text"
```

---

### Task 7: 질문 처리 흐름

디스코드 클라이언트를 모르는 순수 흐름이다. 쓰레드에 글을 올리는 일은 주입받은
`postMessages` 함수에 맡긴다. 이렇게 하면 흐름 전체를 discord.js 없이 시험할 수 있다.

**Files:**
- Create: `bot/src/handle-question.js`
- Test: `bot/test/handle-question.test.js`

**Interfaces:**
- Consumes: `createSessionStore` (Task 3), `createRateLimiter` (Task 4),
  `createClaudeRunner` (Task 5), `rejectionText`·`failureText`·`answerMessages` (Task 6)
- Produces: `createQuestionHandler({ store, limiter, runner, randomUUID, log }) -> handle`
  - `handle({ threadId, userId, question, postMessages }) -> Promise<Outcome>`
  - `postMessages(messages: string[]) -> Promise<void>`
  - `Outcome`은 `{ status: "answered" }`, `{ status: "rejected", reason }`,
    `{ status: "failed", reason }` 중 하나다.
  - 되물음에서 `--resume`이 실패하면 세션을 지우고 새 UUID로 한 번만 다시 시도한다.
    재시도도 실패하면 `failed`로 끝낸다.
  - 시간 초과(`timeout`)면 세션을 지운다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`bot/test/handle-question.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createQuestionHandler } from "../src/handle-question.js";

function harness({ askResults, existingSession = null }) {
  const posted = [];
  const calls = [];
  const sessions = new Map();
  if (existingSession) sessions.set("thread-1", existingSession);

  const store = {
    get: (id) => sessions.get(id) ?? null,
    set: (id, value) => sessions.set(id, value),
    remove: (id) => sessions.delete(id),
  };

  let uuidCounter = 0;
  const handle = createQuestionHandler({
    store,
    limiter: { acquire: () => ({ ok: true, release() {} }) },
    runner: {
      ask(args) {
        calls.push(args);
        return Promise.resolve(askResults[calls.length - 1]);
      },
    },
    randomUUID: () => `new-uuid-${++uuidCounter}`,
    log: () => {},
  });

  const postMessages = async (messages) => {
    posted.push(...messages);
  };

  return { handle, posted, calls, sessions, postMessages };
}

test("첫 질문은 새 세션으로 묻고 답을 올린다", async () => {
  const h = harness({ askResults: [{ ok: true, text: "답변", sessionId: "s-1" }] });
  const outcome = await h.handle({
    threadId: "thread-1",
    userId: "user-1",
    question: "질문",
    postMessages: h.postMessages,
  });

  assert.deepEqual(outcome, { status: "answered" });
  assert.equal(h.calls[0].resume, false);
  assert.equal(h.calls[0].sessionId, "new-uuid-1");
  assert.deepEqual(h.posted, ["답변"]);
  assert.equal(h.sessions.get("thread-1"), "s-1");
});

test("세션이 있으면 resume 으로 묻는다", async () => {
  const h = harness({
    askResults: [{ ok: true, text: "답변", sessionId: "s-1" }],
    existingSession: "s-1",
  });
  await h.handle({
    threadId: "thread-1",
    userId: "user-1",
    question: "되물음",
    postMessages: h.postMessages,
  });

  assert.equal(h.calls[0].resume, true);
  assert.equal(h.calls[0].sessionId, "s-1");
});

test("resume 이 실패하면 새 세션으로 한 번 다시 묻는다", async () => {
  const h = harness({
    askResults: [
      { ok: false, reason: "exit", detail: "no such session" },
      { ok: true, text: "답변", sessionId: "s-2" },
    ],
    existingSession: "s-1",
  });
  const outcome = await h.handle({
    threadId: "thread-1",
    userId: "user-1",
    question: "되물음",
    postMessages: h.postMessages,
  });

  assert.deepEqual(outcome, { status: "answered" });
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].resume, false);
  assert.ok(h.posted[0].includes("새로 시작"));
  assert.equal(h.sessions.get("thread-1"), "s-2");
});

test("재시도도 실패하면 실패로 끝낸다", async () => {
  const h = harness({
    askResults: [
      { ok: false, reason: "exit", detail: "x" },
      { ok: false, reason: "exit", detail: "y" },
    ],
    existingSession: "s-1",
  });
  const outcome = await h.handle({
    threadId: "thread-1",
    userId: "user-1",
    question: "되물음",
    postMessages: h.postMessages,
  });

  assert.deepEqual(outcome, { status: "failed", reason: "exit" });
  assert.equal(h.calls.length, 2);
  assert.equal(h.posted.length, 1);
});

test("첫 질문 실패는 재시도하지 않는다", async () => {
  const h = harness({ askResults: [{ ok: false, reason: "exit", detail: "x" }] });
  const outcome = await h.handle({
    threadId: "thread-1",
    userId: "user-1",
    question: "질문",
    postMessages: h.postMessages,
  });

  assert.deepEqual(outcome, { status: "failed", reason: "exit" });
  assert.equal(h.calls.length, 1);
});

test("시간 초과면 세션을 지운다", async () => {
  const h = harness({
    askResults: [{ ok: false, reason: "timeout", detail: "x" }],
    existingSession: "s-1",
  });
  const outcome = await h.handle({
    threadId: "thread-1",
    userId: "user-1",
    question: "되물음",
    postMessages: h.postMessages,
  });

  assert.deepEqual(outcome, { status: "failed", reason: "timeout" });
  assert.equal(h.sessions.has("thread-1"), false);
  assert.equal(h.calls.length, 1);
});

test("한도에 걸리면 묻지 않고 거절한다", async () => {
  const h = harness({ askResults: [] });
  const handle = createQuestionHandler({
    store: { get: () => null, set() {}, remove() {} },
    limiter: { acquire: () => ({ ok: false, reason: "daily" }) },
    runner: {
      ask() {
        throw new Error("호출되면 안 된다");
      },
    },
    randomUUID: () => "u",
    log: () => {},
  });

  const posted = [];
  const outcome = await handle({
    threadId: "thread-1",
    userId: "user-1",
    question: "질문",
    postMessages: async (messages) => posted.push(...messages),
  });

  assert.deepEqual(outcome, { status: "rejected", reason: "daily" });
  assert.equal(posted.length, 1);
  assert.ok(posted[0].includes("한도"));
});

test("답이 나오든 실패하든 자리를 반납한다", async () => {
  let released = 0;
  const handle = createQuestionHandler({
    store: { get: () => null, set() {}, remove() {} },
    limiter: {
      acquire: () => ({
        ok: true,
        release() {
          released += 1;
        },
      }),
    },
    runner: { ask: async () => ({ ok: false, reason: "exit", detail: "x" }) },
    randomUUID: () => "u",
    log: () => {},
  });

  await handle({
    threadId: "thread-1",
    userId: "user-1",
    question: "질문",
    postMessages: async () => {},
  });
  assert.equal(released, 1);
});
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `cd bot && npm test`
Expected: FAIL. `Cannot find module '../src/handle-question.js'`

- [ ] **Step 3: `bot/src/handle-question.js`를 쓴다**

```js
import { rejectionText, failureText, answerMessages } from "./replies.js";

export function createQuestionHandler({ store, limiter, runner, randomUUID, log }) {
  return async function handle({ threadId, userId, question, postMessages }) {
    const slot = limiter.acquire(userId);
    if (!slot.ok) {
      await postMessages([rejectionText(slot.reason)]);
      return { status: "rejected", reason: slot.reason };
    }

    try {
      const existing = store.get(threadId);
      const resume = existing !== null;
      const sessionId = existing ?? randomUUID();

      let result = await runner.ask({ question, sessionId, resume });
      let resumeFailed = false;

      if (!result.ok && result.reason === "timeout") {
        store.remove(threadId);
        log("claude timed out", { threadId, detail: result.detail });
        await postMessages([failureText(result.reason)]);
        return { status: "failed", reason: result.reason };
      }

      if (!result.ok && resume) {
        log("resume failed, starting a new session", { threadId, detail: result.detail });
        store.remove(threadId);
        resumeFailed = true;
        result = await runner.ask({ question, sessionId: randomUUID(), resume: false });
      }

      if (!result.ok) {
        log("claude failed", { threadId, reason: result.reason, detail: result.detail });
        await postMessages([failureText(result.reason)]);
        return { status: "failed", reason: result.reason };
      }

      store.set(threadId, result.sessionId);
      await postMessages(answerMessages(result.text, { resumeFailed }));
      return { status: "answered" };
    } finally {
      slot.release();
    }
  };
}
```

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `cd bot && npm test`
Expected: PASS. 누적 58건 통과

- [ ] **Step 5: 커밋한다**

```bash
git add bot/src/handle-question.js bot/test/handle-question.test.js
git commit -m "feat(bot): orchestrate ask, retry, and reply for one question"
```

---

### Task 8: 디스코드 게이트웨이와 기동

여기서만 `discord.js`를 만진다. 판단 로직은 앞 태스크들에 있으므로 이 파일은 얇다.
자동 시험 대상이 아니며, 실제 디스코드 서버에서 수동으로 확인한다.

**Files:**
- Create: `bot/src/gateway.js`
- Create: `bot/src/index.js`
- Create: `bot/README.md`
- Modify: `CLAUDE.md` (저장소 루트)

**Interfaces:**
- Consumes: `createQuestionHandler` (Task 7), `loadConfig` (Task 1),
  `createSessionStore` (Task 3), `createRateLimiter` (Task 4), `createClaudeRunner` (Task 5),
  `threadName` (Task 6)
- Produces: `startGateway({ config, handle, client }) -> Promise<void>`

- [ ] **Step 1: `bot/src/gateway.js`를 쓴다**

```js
import { Client, GatewayIntentBits, Events, ChannelType } from "discord.js";
import { threadName } from "./replies.js";

const THINKING = "찾는 중입니다. 30초에서 2분 걸립니다.";

function isAllowedChannel(message, config) {
  const parentId = message.channel.isThread() ? message.channel.parentId : message.channel.id;
  return config.allowedChannelIds.includes(parentId);
}

export function createClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });
}

export async function startGateway({ config, handle, client, log = console.log }) {
  client.on(Events.MessageCreate, async (message) => {
    try {
      if (message.author.bot) return;
      if (message.guildId !== config.guildId) return;
      if (!isAllowedChannel(message, config)) return;

      const inThread = message.channel.isThread();
      const mentioned = message.mentions.users.has(client.user.id);
      if (!inThread && !mentioned) return;
      if (inThread && message.channel.ownerId !== client.user.id) return;

      const question = message.content.replace(/<@!?\d+>/g, "").trim();
      if (question.length === 0) return;

      const thread = inThread
        ? message.channel
        : await message.startThread({
            name: threadName(question),
            type: ChannelType.PublicThread,
          });

      await thread.sendTyping();
      const placeholder = await thread.send(THINKING);

      let first = true;
      await handle({
        threadId: thread.id,
        userId: message.author.id,
        question,
        postMessages: async (messages) => {
          for (const text of messages) {
            if (first) {
              await placeholder.edit(text);
              first = false;
            } else {
              await thread.send(text);
            }
          }
        },
      });
    } catch (error) {
      log("gateway error", error?.message ?? error);
    }
  });

  client.once(Events.ClientReady, (ready) => {
    log(`logged in as ${ready.user.tag}`);
  });

  await client.login(config.discordToken);
}
```

- [ ] **Step 2: `bot/src/index.js`를 쓴다**

`git status --porcelain`으로 작업 트리를 확인하는 자리를 여기에 둔다. 답변마다 확인하면
느리므로, 기동할 때 한 번 찍고 이후에는 답변이 끝날 때마다 확인한다.

```js
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { loadConfig } from "./config.js";
import { createSessionStore } from "./session-store.js";
import { createRateLimiter } from "./rate-limiter.js";
import { createClaudeRunner } from "./claude-runner.js";
import { createQuestionHandler } from "./handle-question.js";
import { createClient, startGateway } from "./gateway.js";

const log = (...args) => console.log(new Date().toISOString(), ...args);

function warnIfRepoDirty(repoRoot) {
  try {
    const output = execFileSync("git", ["status", "--porcelain"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    if (output.trim().length > 0) {
      log("WARNING: repo working tree is dirty; the bot must never write", output.slice(0, 500));
    }
  } catch (error) {
    log("could not check repo state", error?.message ?? error);
  }
}

const config = loadConfig(process.env);
warnIfRepoDirty(config.repoRoot);

const store = createSessionStore({ filePath: config.sessionFile });
const limiter = createRateLimiter({
  maxConcurrent: config.maxConcurrent,
  perUserPerMin: config.ratePerUserPerMin,
  dailyQuota: config.dailyQuota,
});
const runner = createClaudeRunner({
  claudeBin: config.claudeBin,
  repoRoot: config.repoRoot,
  timeoutMs: config.timeoutMs,
});

const answer = createQuestionHandler({ store, limiter, runner, randomUUID, log });
const handle = async (args) => {
  const outcome = await answer(args);
  warnIfRepoDirty(config.repoRoot);
  return outcome;
};

await startGateway({ config, handle, client: createClient(), log });
```

- [ ] **Step 3: `bot/README.md`를 쓴다**

````markdown
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
- `.env`에는 봇 토큰이 들어간다. 이 저장소는 public이므로 절대 커밋하지 않는다.
- 봇은 소유자 한 명의 구독 한도를 쓴다. `DAILY_QUOTA`로 상한을 관리한다.
````

- [ ] **Step 4: 루트 `CLAUDE.md`에 네 번째 축을 더한다**

파일 앞부분의 세 축 목록을 다음으로 바꾼다.

```markdown
이 저장소는 네 축으로 구성된다(모두 저장소 루트의 형제 디렉토리):
- **`raw/`** — 정책 원본 소스(불변, 읽기 전용).
- **`wiki/`** — LLM이 `raw/`를 ingest해 운영·유지하는 **정책 지식 위키**.
- **`parfait/`** — TJYG-Android **구현 문서**(ADR·architecture·specs·plans). 위키 스키마 미적용.
- **`bot/`** — `wiki/`를 근거로 디스코드에서 답하는 **읽기 전용 질의응답 봇**. 위키 스키마 미적용.
```

- [ ] **Step 5: 전체 테스트를 돌린다**

Run: `cd bot && npm test`
Expected: PASS. 누적 58건 통과. Task 8은 새 테스트를 더하지 않는다.

- [ ] **Step 6: 기동만 확인한다**

`.env`에 임시로 잘못된 토큰을 넣고 돌려, 설정 검증을 지나 로그인 단계까지 가는지 본다.

Run: `cd bot && npm start`
Expected: 설정 오류 없이 진행하다가 디스코드 로그인에서 실패한다. `Missing required setting`
같은 메시지가 뜨면 `.env`가 덜 채워진 것이다.

- [ ] **Step 7: 커밋한다**

```bash
git add bot/src/gateway.js bot/src/index.js bot/README.md CLAUDE.md
git commit -m "feat(bot): wire Discord gateway and process entry point"
```

---

### Task 9: 실제 디스코드에서 수동 확인

자동 시험이 닿지 않는 층을 사람이 확인한다. 이 태스크는 코드를 바꾸지 않는다.
발견한 문제는 고쳐서 이 태스크 안에서 커밋한다.

**Files:**
- Modify: 확인 중 문제가 드러난 파일

- [ ] **Step 1: 실제 토큰으로 봇을 띄운다**

Run: `cd bot && npm start`
Expected: `logged in as <봇이름>` 로그가 뜬다.

- [ ] **Step 2: 허용 채널에서 멘션한다**

`@봇 G-001 토핑 인셋이 얼마야?`라고 보낸다.
Expected: 쓰레드가 열리고 "찾는 중입니다" 메시지가 뜬 뒤, 답변으로 바뀐다.
답변 끝에 근거 페이지 이름이 붙는지 본다.

- [ ] **Step 3: 같은 쓰레드에서 되물음한다**

멘션 없이 `그럼 저개수일 때는?`이라고 보낸다.
Expected: 앞 질문의 맥락을 이어받아 답한다.

- [ ] **Step 4: 허용하지 않은 채널에서 멘션한다**

Expected: 아무 반응이 없다.

- [ ] **Step 5: 분당 한도를 넘겨 본다**

같은 사용자가 연달아 세 번 묻는다.
Expected: 세 번째에 "질문이 너무 빠릅니다" 문구가 나온다.

- [ ] **Step 6: 긴 답변을 유도한다**

`위키 전체 구조를 길게 설명해줘`라고 묻는다.
Expected: 2000자를 넘으면 여러 메시지로 나뉘고, 코드블록이 깨지지 않는다.

- [ ] **Step 7: 작업 트리가 깨끗한지 확인한다**

Run: `git status --porcelain`
Expected: 비어 있다. 봇 로그에 dirty 경고가 없어야 한다.

- [ ] **Step 8: 확인 중 고친 것이 있으면 커밋한다**

```bash
git add -A bot/
git commit -m "fix(bot): address issues found in manual Discord verification"
```

---

## 자체 점검 결과

스펙 대조에서 확인한 사항이다.

| 스펙 절 | 구현 태스크 |
|---|---|
| 5.1 `discord-gateway` | Task 8 |
| 5.2 `claude-runner` | Task 5 |
| 5.3 `session-store` | Task 3 |
| 5.4 `rate-limiter` | Task 4 |
| 6 호출 규격 | Task 5 (`buildArgs` 테스트가 인자를 고정한다) |
| 7 데이터 흐름 | Task 7(판단) + Task 8(디스코드) |
| 8 답변 형식 · 길이 분할 | Task 2 + Task 6 |
| 9.1 쓰기 차단 | Task 5(`--disallowed-tools`) + Task 8(`warnIfRepoDirty`) |
| 9.2 접근 제한 | Task 8(`isAllowedChannel`, `guildId` 확인) |
| 9.3 사용량 제한 | Task 4 + Task 7 |
| 10 오류 처리 | Task 6(문구) + Task 7(분기) |
| 11 테스트 전략 | Task 2~7이 자동, Task 9가 수동 |
| 12 설정 | Task 1 |

스펙 8절의 근거 표기 형식은 봇 코드가 아니라 `claude`의 답변에 달려 있다. 코드로 강제할
수 없으므로 Task 9 Step 2에서 눈으로 확인한다. 형식이 나오지 않으면 스펙 13절이 적은
대로 `wiki/CLAUDE.md`의 query 워크플로를 고친다.

스펙 10절의 "봇 재시작 시 미완 쓰레드에 끊김을 알림"은 계획에서 뺐다. 진행 중이던
질문을 알려면 작업 큐를 파일에 남겨야 하고, 이는 스펙이 같은 절에서 "구조가 커진다"는
이유로 거부한 것이다. 유실을 조용히 받아들이는 쪽으로 좁힌다. 스펙에 이 축소를 반영해야
한다.
