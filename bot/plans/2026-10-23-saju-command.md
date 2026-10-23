# 사주 명령(`!사주`) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `@봇 !사주`로 사주 스레드를 열고, 봇 호스트의 외부 스킬(`saju-manseryeok`)로 계산한 결과를 격리된 `claude` 세션에서 답한다.

**Architecture:** 사주 전용 러너가 `claude`를 빈 샌드박스 디렉토리에서 내장 도구 없이 띄우고, 봇 안의 stdio MCP 서버가 노출하는 `saju_calc` 도구 하나만 쓰게 한다. MCP 서버는 셸 없이 `saju.py`를 실행한다. 핸들러는 기존 `createQuestionHandler`를 사주 전용 세션 저장소·러너로 한 번 더 만들어 재사용하고, 게이트웨이는 스레드 이름 접두어로 사주 스레드를 가른다.

**Tech Stack:** Node.js 22(ESM, 순수 JavaScript), `discord.js` v14, `@modelcontextprotocol/sdk` 1.32.1, Node 내장 테스트 러너.

**Spec:** `bot/specs/2026-10-23-saju-command-design.md`

## Global Constraints

- 순수 JavaScript(ESM). 테스트는 `node --test`만 쓴다.
- 런타임 의존성은 `discord.js`와 `@modelcontextprotocol/sdk`(정확히 `1.32.1`, `--save-exact`) 둘뿐이다. `zod`를 직접 쓰지 않는다(저수준 `Server` + JSON 스키마).
- 스킬 파일(코드·템플릿·절기 데이터)을 이 저장소에 복사하거나 커밋하지 않는다. 테스트는 가짜 `saju.py` 픽스처를 쓴다. 이 저장소는 public이다.
- 사주용 `claude` 인자에는 저장소 루트(`REPO_ROOT`)가 어디에도 들어가지 않는다. `cwd`는 샌드박스 디렉토리다.
- **샌드박스는 저장소 git 트리 밖에 둔다.** 기본값은 `join(os.tmpdir(), "teamyg-bot-saju-sandbox")`이고, 해석한 경로가 `REPO_ROOT` 안이면 시작 시 오류다. 트리 안이면 gitStatus(브랜치·커밋 메시지)와 git 루트 기준 자동 메모리가 사주 세션에 실릴 수 있다(계획 검수 지적).
- 상대 경로 설정(`SAJU_SESSION_FILE`, `SAJU_SANDBOX_DIR`)은 `bot/` 디렉토리 기준으로 해석한다. 프로세스 cwd 기준이면 실행 위치에 따라 샌드박스가 바뀌어 `--resume`이 깨진다.
- 사주용 `claude`는 `--setting-sources ""`, `--tools ""`, `--strict-mcp-config`를 반드시 쓴다. `--bare`는 쓰지 않는다(구독 인증 불가).
- 사주 시스템 프롬프트에 `PERSONA_DIRECTIVE`·`MEME_DIRECTIVE`·`ASK_DIRECTIVE`를 넣지 않는다.
- `saju.py`는 `execFile`(셸 없음)으로만 실행한다. `exec`·`shell: true`를 쓰지 않는다.
- 사주 스레드 이름에 사용자 입력(생년월일시 등)을 넣지 않는다.
- 사용자에게 보이는 문구는 한국어, 코드 식별자·주석·커밋 메시지는 영어. 문구는 전부 `replies.js`에 둔다.
- 모델은 기존 `MODEL` 상수(`claude-sonnet-5-5`)를 공유한다.
- 출력 템플릿의 마크다운 표는 바꾸지 않는다(설계 7절, 작성자 판단). 디스코드에서 표가 깨져 보이면 실사용 뒤 따로 고친다. 메시지 분할은 기존 `answerMessages`를 그대로 쓴다.

## Review Focus

1. **`@봇 !사주`만 보낸 경우(입력 없음).** 빈 질문으로 `claude`를 부르지 않고 입력 폼을 받는다 → Task 1·4 테스트.
2. **`-`로 시작하는 값(`region: "--compat"` 등).** `execFile`이라 셸 주입은 없지만 `saju.py`가 옵션으로 파싱한다 → 검증에서 거부, Task 3 테스트.
3. **`saju.py`가 종료 코드 1 + `{"error": …}`로 끝나는 경우.** 도구 실패가 아니라 그 JSON을 그대로 돌려줘야 `claude`가 스킬 규칙대로 오류를 전한다 → Task 3 테스트.
4. **사람이 만든 스레드나 Figma 스레드에서 `!사주`.** 그 자리에서 이어 가지 않고 새 사주 스레드를 연다 → Task 4 테스트.
5. **`SAJU_SESSION_FILE`이 `SESSION_FILE`과 같은 경로.** 두 저장소가 서로의 항목을 지운다(`session-store.js` 머리 주석) → 시작 시 오류, Task 4 테스트.
6. **없는 날짜(`1990-02-30`).** `saju.py`는 표준 출력 없이 트레이스백으로 끝난다 → 양력은 실제 날짜인지 검증하고, 엔진 실패 시 stderr 마지막 줄을 도구 오류에 담는다, Task 3 테스트.
7. **한도에 걸린 `!사주`(문서 질문 스레드에서).** 빈 사주 스레드와 이동 링크가 남으면 안 된다 → 스레드 생성과 링크 답글은 `resolveThread` 안에서만, Task 4 테스트.
8. **사주 스레드에서 `figma`.** Figma 리포트가 사주 스레드에 올라가면 안 된다 → 사주 스레드 판정을 명령 판정보다 먼저, Task 4 테스트.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `src/command.js` (수정) | `!사주` 판정 |
| `src/claude-runner.js` (수정) | 프로세스 실행부를 `runClaude`로 떼어 내 공유. `withoutSecrets`·`MODEL` export |
| `src/saju-prompt.js` (신규) | 스킬 문서를 읽어 사주 시스템 프롬프트 조립 |
| `src/saju-runner.js` (신규) | 격리 인자 빌더 + `ask`, MCP 설정 JSON 생성 |
| `src/saju-engine.js` (신규) | 입력 검증, `saju.py` 실행(궁합 임시 파일 포함) |
| `src/saju-mcp-server.js` (신규) | stdio MCP 서버, `saju_calc` 하나 |
| `src/replies.js`, `src/gateway.js`, `src/config.js`, `src/index.js` (수정) | 문구, 라우팅, 설정, 조립 |
| `test/fixtures/fake-saju/scripts/saju.py` (신규) | 받은 인자를 JSON으로 되돌리는 가짜 엔진 |

---

### Task 1: `!사주` 명령 판정

**Files:**
- Modify: `bot/src/command.js`
- Test: `bot/test/command.test.js`

**Interfaces:**
- Produces: `parseCommand(text)`가 `{ kind: "saju", input: string }`을 추가로 돌려준다. `input`은 `!사주` 뒤 내용을 trim한 것(없으면 `""`).

- [ ] **Step 1: 실패하는 테스트 작성**

```js
test("!사주 만 보내면 입력이 빈 사주 명령이다", () => {
  assert.deepEqual(parseCommand("!사주"), { kind: "saju", input: "" });
});
test("!사주 뒤 내용은 입력으로 넘긴다", () => {
  assert.deepEqual(parseCommand("  !사주 1990-05-15 07:30 남 서울 "), { kind: "saju", input: "1990-05-15 07:30 남 서울" });
});
test("!사주 가 중간에 있으면 질문이다", () => {
  assert.equal(parseCommand("이거 !사주 명령 맞아?").kind, "question");
});
test("!사주 에 바로 글자가 붙으면 명령이 아니다", () => {
  assert.equal(parseCommand("!사주팔자").kind, "question");
});
```
기존 figma·question 테스트는 그대로 통과해야 한다.

- [ ] **Step 2: 실행해 실패 확인** — `cd bot && node --test test/command.test.js` → 새 테스트 4개 FAIL.
- [ ] **Step 3: 구현** — 정규식 `/^!사주(?:\s+([\s\S]*))?$/`를 figma 판정 다음에 둔다.
- [ ] **Step 4: 통과 확인** — 같은 명령, 전부 PASS.
- [ ] **Step 5: 커밋** — `git commit -m "feat(bot): parse the !사주 command"`

---

### Task 2: 격리된 사주 러너

**Files:**
- Modify: `bot/src/claude-runner.js`
- Create: `bot/src/saju-prompt.js`, `bot/src/saju-runner.js`
- Test: `bot/test/saju-runner.test.js`, `bot/test/saju-prompt.test.js` (기존 `claude-runner.test.js`는 수정 없이 통과해야 한다)

**Interfaces:**
- Produces (`claude-runner.js`):
  - `export function runClaude({ claudeBin, args, cwd, env, timeoutMs, spawn }): Promise<{ ok: true, text, sessionId } | { ok: false, reason, detail }>` — 지금 `ask` 안의 spawn·타임아웃·JSON 파싱 로직을 옮긴 것. `createClaudeRunner.ask`는 이것을 부른다.
  - `export function withoutSecrets(env)`, `export const MODEL`
- Produces (`saju-prompt.js`): `export function loadSajuPrompt(skillDir, readFile = readFileSync): string` — 파일이 없으면 throw.
- Produces (`saju-runner.js`):
  - `export const SAJU_TOOL = "mcp__saju__saju_calc"`
  - `export function buildSajuMcpConfig({ nodeBin, serverPath, skillDir, pythonBin, engineTimeoutMs }): string` — `{"mcpServers":{"saju":{"command":nodeBin,"args":[serverPath],"env":{"SAJU_SKILL_DIR":…,"PYTHON_BIN":…,"SAJU_ENGINE_TIMEOUT_MS":"…"}}}}`
  - `export function createSajuRunner({ claudeBin, sandboxDir, systemPrompt, mcpConfig, timeoutMs, env = process.env, spawn = nodeSpawn }): { buildArgs, ask }` — `ask({ question, sessionId, resume })`는 `createClaudeRunner.ask`와 같은 모양. `withoutSecrets(env)`는 `createSajuRunner`가 만들 때 한 번 적용해 `runClaude`에 넘긴다.

`buildArgs` 결과는 정확히 다음 순서다.

```
-p (--session-id|--resume) <id> --model <MODEL> --setting-sources "" --tools ""
--strict-mcp-config --mcp-config <mcpConfig> --allowed-tools mcp__saju__saju_calc
--permission-mode dontAsk --append-system-prompt <systemPrompt> --output-format json -- <question>
```

`loadSajuPrompt`는 `SAJU_DIRECTIVE` 다음에 `SKILL.md`, `references/input-normalization.md`, `references/output-template.md`를 각각 `--- <상대경로> ---` 머리줄을 붙여 잇는다. `reference-data.md`는 읽지 않는다. `SAJU_DIRECTIVE`는 정확히 다음이다.

```js
const SAJU_DIRECTIVE = [
  "디스코드 사주 스레드다. 아래 saju-manseryeok 스킬 문서대로 진행한다.",
  "- 엔진 실행은 saju_calc 도구로 한다. 문서의 `python3 … saju.py` 명령은 이 도구 호출로 대신한다.",
  "- 궁합은 saju_calc 에 partner 를 함께 넘긴다. 결과 JSON 파일을 따로 만들지 않는다.",
  "- 사주와 무관한 질문에는 답하지 않고, 이 스레드는 사주 전용이라고 짧게 안내한다.",
  "- 답변은 디스코드 메시지로 나간다.",
].join("\n");
```

- [ ] **Step 1: 실패하는 테스트 작성** (`saju-runner.test.js`, 가짜 `spawn`으로 인자·옵션을 캡처)
  - `buildArgs`의 `--setting-sources` 다음 값이 `""`, `--tools` 다음 값이 `""`, `--strict-mcp-config` 존재, `--allowed-tools` 다음 값이 `SAJU_TOOL` 하나, 마지막 두 인자가 `"--"`, 질문.
  - 인자 어디에도 `"Bash"`, `"Read"`, `REPO_ROOT` 값(테스트에서 `"/repo"`로 넣은 env)이 없다.
  - `ask` 호출 시 spawn `cwd`가 `sandboxDir`, spawn `env`에 `DISCORD_TOKEN`·`FIGMA_TOKEN`이 없다.
  - `resume: true`면 `--resume`, 아니면 `--session-id`.
  - `buildSajuMcpConfig` 결과를 `JSON.parse`하면 `mcpServers.saju.env.SAJU_SKILL_DIR`이 넘긴 값이다.
- [ ] **Step 2: 실패하는 테스트 작성** (`saju-prompt.test.js`, 가짜 `readFile`)
  - 결과에 `saju_calc`와 세 파일 내용이 들어 있고 `reference-data`는 읽지 않는다(가짜 readFile 호출 경로 확인).
  - 결과에 `PERSONA_DIRECTIVE`의 첫 줄, `MEME_DIRECTIVE`의 첫 줄, `"ask"` 스킬 지시가 없다.
  - 파일 하나가 없으면 throw.
- [ ] **Step 3: 실행해 실패 확인** — `node --test test/saju-runner.test.js test/saju-prompt.test.js` → FAIL.
- [ ] **Step 4: 구현** — `claude-runner.js`에서 `runClaude`를 떼어 내고, 두 신규 파일을 만든다.
- [ ] **Step 5: 전체 통과 확인** — `npm test` → 기존 테스트 포함 실패 0.
- [ ] **Step 6: 커밋** — `git commit -m "feat(bot): add an isolated claude runner for saju"`

---

### Task 3: `saju_calc` MCP 서버

**Files:**
- Create: `bot/src/saju-engine.js`, `bot/src/saju-mcp-server.js`, `bot/test/fixtures/fake-saju/scripts/saju.py`
- Modify: `bot/package.json`, `bot/package-lock.json`
- Test: `bot/test/saju-engine.test.js`, `bot/test/saju-mcp-server.test.js`

**Interfaces:**
- Produces (`saju-engine.js`):
  - `export function personArgs(person): { ok: true, args: string[] } | { ok: false, error: string }`
  - `export async function runSajuCalc(input, { pythonBin, skillDir, timeoutMs, execFile, tmpRoot = os.tmpdir() }): Promise<{ ok: true, result: object } | { ok: false, error: string }>`
- Produces (`saju-mcp-server.js`): 실행 파일. env `SAJU_SKILL_DIR`, `PYTHON_BIN`, `SAJU_ENGINE_TIMEOUT_MS`를 읽는다. 도구 `saju_calc` 하나.

검증 규칙(`personArgs`, 어긋나면 한국어 오류 문자열):

| 필드 | 규칙 | 인자 |
|---|---|---|
| `date` | 필수, `/^\d{4}-\d{2}-\d{2}$/`. 양력이면 실제 있는 날짜(`Date.UTC`로 되돌려 같은지), 음력이면 월 1~12·일 1~30 | `--date` |
| `time` | `/^([01]\d\|2[0-3]):[0-5]\d$/` 또는 `"모름"`, 없으면 `"모름"` | `--time` |
| `gender` | 필수, `"남"`\|`"여"` | `--gender` |
| `region` | 선택, `/^[가-힣A-Za-z][가-힣A-Za-z ]{0,19}$/` 또는 `"모름"` | `--region` |
| `calendar` | 선택, `"solar"`\|`"lunar"` | `--calendar` |
| `leap` | 선택 불리언, `true`는 `calendar: "lunar"`일 때만 | `--leap` |
| `sewoonYear` | 선택 정수 1900~2100 | `--sewoon-year` |

`runSajuCalc`:
- `partner`가 없으면 `saju.py`를 한 번 실행해 `{ ok: true, result: <JSON> }`.
- `partner`가 있으면 두 사람을 각각 실행하고, 둘 다 `error` 키가 없으면 `mkdtemp(tmpRoot)`에 `a.json`·`b.json`을 쓰고 `--compat`을 실행한 뒤 `finally`에서 디렉토리를 지운다. 결과는 `{ person, partner, compat }`. 어느 한쪽이 `error`면 그 JSON을 결과로 돌려주고 궁합은 실행하지 않는다.
- 종료 코드와 상관없이 표준 출력이 JSON이면 결과로 쓴다. JSON이 아니거나 타임아웃·실행 실패면 `{ ok: false, error }`이고, `error`는 stderr의 비어 있지 않은 마지막 줄(없으면 `"사주 엔진 실행에 실패했습니다."`). stderr에 로컬 경로가 들어 있으면 `SAJU_SKILL_DIR` 문자열을 `<skill>`로 바꾼다.
- 엔진 타임아웃은 env `SAJU_ENGINE_TIMEOUT_MS`(기본 `30000`).

MCP 서버는 `Server`(`@modelcontextprotocol/sdk/server/index.js`)와 `StdioServerTransport`로 만들고, `ListToolsRequestSchema`·`CallToolRequestSchema` 핸들러만 둔다. 도구 결과는 `content: [{ type: "text", text: JSON.stringify(result) }]`, `ok: false`면 `isError: true`.

가짜 `saju.py`는 `sys.argv[1:]`을 `{"argv": [...]}`로 출력한다. `--date 1800-01-01`이면 `{"error": "범위 밖"}`을 출력하고 종료 코드 1, `--compat`이면 두 파일 내용을 읽어 `{"compat": [a, b]}`를 출력한다.

- [ ] **Step 1: 의존성 추가** — `cd bot && npm install --save-exact @modelcontextprotocol/sdk@1.32.1` → `package.json`의 dependencies가 두 개.
- [ ] **Step 2: 실패하는 테스트 작성** (`saju-engine.test.js`, 가짜 `execFile`)
  - 정상 입력의 `args`가 `["--date","1990-05-15","--time","07:30","--gender","남","--region","서울"]`.
  - `region: "--compat"`, `region: "-x"`, `region: "서울; rm -rf ~"`, `region: "$(id)"`, `date: "1990-5-15"`, `date: "1990-02-30"`(양력), `gender: "male"`, `leap: true` + solar, `sewoonYear: 3000` 각각 `ok: false`.
  - `date: "1990-02-30"` + `calendar: "lunar"`는 `ok: true`(음력 30일은 있다).
  - 가짜 `execFile`이 표준 출력 없이 stderr `"ValueError: day is out of range"`로 실패하면 `{ ok: false, error: "ValueError: day is out of range" }`.
  - `time` 생략 시 `--time 모름`.
  - 가짜 `execFile`이 종료 코드 1 + `{"error":"범위 밖"}`을 내면 `{ ok: true, result: { error: "범위 밖" } }`.
  - 표준 출력이 JSON이 아니면 `ok: false`.
  - 궁합: `execFile` 호출이 3번이고 마지막 인자가 `["--compat", <a.json>, <b.json>]`, 실행 후 임시 디렉토리가 없다. 한쪽이 `error`면 호출이 2번.
  - 모든 `execFile` 호출의 옵션에 `shell`이 없다.
- [ ] **Step 3: 실패하는 테스트 작성** (`saju-mcp-server.test.js`) — SDK `Client` + `StdioClientTransport`로 `node src/saju-mcp-server.js`를 띄우고, env `SAJU_SKILL_DIR`을 `test/fixtures/fake-saju`로 준다.
  - `listTools()`의 도구가 정확히 `["saju_calc"]`.
  - `callTool({ name: "saju_calc", arguments: { date: "1990-05-15", gender: "남" } })`의 텍스트를 파싱하면 `argv`에 `"--date","1990-05-15"`가 있다.
  - `region: "--compat"`이면 `isError: true`.
- [ ] **Step 4: 실행해 실패 확인** — `node --test test/saju-engine.test.js test/saju-mcp-server.test.js` → FAIL.
- [ ] **Step 5: 구현.**
- [ ] **Step 6: 통과 확인** — `npm test` → 실패 0.
- [ ] **Step 7: 커밋** — `git commit -m "feat(bot): expose saju.py as a single MCP tool"`

---

### Task 4: 라우팅·설정·조립

**Files:**
- Modify: `bot/src/replies.js`, `bot/src/gateway.js`, `bot/src/config.js`, `bot/src/index.js`
- Test: `bot/test/gateway.test.js`, `bot/test/config.test.js`, `bot/test/replies.test.js`

**Interfaces:**
- Consumes: Task 1 `parseCommand`, Task 2 `createSajuRunner`·`buildSajuMcpConfig`·`loadSajuPrompt`, 기존 `createQuestionHandler`·`createSessionStore`.
- Produces (`replies.js`): `SAJU_THREAD_PREFIX = "🔮 사주"`, `sajuThreadName(at = new Date())` → `` `🔮 사주 ${KST YYYY-MM-DD}` ``, `SAJU_THINKING = "사주를 계산하는 중입니다. 30초에서 1분 걸립니다."`, `SAJU_DISABLED = "사주 기능이 설정돼 있지 않습니다."`, `SAJU_EMPTY_INPUT = "사주를 보려고 해. 입력 폼을 보여 줘."`, `sajuMovedText(threadId)` → `` `사주는 새 스레드에서 봅니다: <#${threadId}>` ``.
- Produces (`config.js`): `loadConfig(env, { baseDir = process.cwd() } = {})`. `sajuSkillDir`(기본 `""`), `sajuSandboxDir`(기본 `join(os.tmpdir(), "teamyg-bot-saju-sandbox")`), `sajuSessionFile`(기본 `"./data/saju-sessions.json"`), `sajuTimeoutMs`(기본 `timeoutMs`), `sajuEngineTimeoutMs`(기본 `30000`). 두 사주 경로는 `resolve(baseDir, …)`로 절대 경로가 되어 나온다. 다음이면 throw: `sajuSessionFile`이 `resolve(baseDir, sessionFile)`과 같다, `sajuSandboxDir`가 `resolve(REPO_ROOT)`와 같거나 그 아래다. `index.js`는 `loadConfig(process.env, { baseDir: botRoot })`로 부른다.
- Produces (`gateway.js`): `startGateway({ …, handleSaju })`. `handleSaju`는 `handle`과 같은 인자(`{ userId, question, resolveThread, replyDirect }`)를 받는다.

라우팅(설계 6.2절 표). **사주 스레드 판정을 `parseCommand`보다 먼저 한다**: 사주 스레드에서는 `figma`를 포함해 모든 본문이 `handleSaju`로 간다. 사주 스레드 판정은 `channel.isThread() && channel.ownerId === client.user.id && channel.name?.startsWith(SAJU_THREAD_PREFIX)`.

| 위치 | 본문 | 호출 |
|---|---|---|
| 채널 | `!사주 <입력>` | `handleSaju`, 새 스레드(`message.startThread`, 이름 `sajuThreadName()`) |
| 사주 스레드 | `!사주 <입력>` 또는 그 외 | `handleSaju`, 현재 스레드. `question`은 `!사주`를 뗀 입력 또는 본문 |
| 그 밖의 스레드 | `!사주 <입력>` | `resolveThread` **안에서** `message.channel.parent.threads.create({ name: sajuThreadName(), type: PublicThread })`로 새 스레드를 열고 `message.reply(sajuMovedText(id))`를 남긴다. 한도 거절이면 `resolveThread`가 불리지 않으므로 둘 다 생기지 않는다 |
| 그 밖의 스레드 | 그 외 | 기존 동작 |

입력이 빈 `!사주`는 `question`을 `SAJU_EMPTY_INPUT`으로 넘긴다.

`index.js`: `sajuSkillDir`이 비었거나 `loadSajuPrompt`가 throw하면 로그를 남기고 `handleSaju = ({ replyDirect }) => replyDirect(SAJU_DISABLED)`. 아니면 `mkdirSync(sajuSandboxDir, { recursive: true })`, 사주 전용 `createSessionStore({ filePath: sajuSessionFile })`, `createSajuRunner`(MCP 설정은 `buildSajuMcpConfig({ nodeBin: process.execPath, serverPath: join(botRoot, "src", "saju-mcp-server.js"), skillDir: config.sajuSkillDir, pythonBin: config.pythonBin, engineTimeoutMs: config.sajuEngineTimeoutMs })`), `createQuestionHandler({ store: sajuStore, limiter, runner: sajuRunner, randomUUID, log })`. `limiter`는 기존 것을 공유한다. 사주 핸들러 뒤에는 `warnIfRepoDirty`를 부르지 않는다. 저장소가 둘이 되므로 `session-store.js` 머리 주석과 `index.js`의 `// exactly one per process`를 "파일 하나에 저장소 하나"로 고친다.

- [ ] **Step 1: 실패하는 테스트 작성** (`gateway.test.js`) — `fakeMessage`에 `name`, `channel.parent.threads.create`, `startThread`를 더하고 `deliver`가 `handleSaju` 호출을 `saju:<question>`으로 기록한다.
  - 채널 `!사주 1990-05-15 남` → `["saju:1990-05-15 남"]`, `startThread` 이름이 `🔮 사주`로 시작하고 `1990`을 포함하지 않는다.
  - 채널 `!사주` → `["saju:사주를 보려고 해. 입력 폼을 보여 줘."]`.
  - 봇 소유 + `🔮 사주 2026-10-23` 스레드에서 `07:30 서울` → `["saju:07:30 서울"]`.
  - 봇 소유 + 일반 이름 스레드에서 `!사주` → `parent.threads.create` 1회, `reply` 텍스트가 `<#`를 포함, 기록은 `saju:…`.
  - 사람 소유 스레드에서 `!사주` → 위와 같다.
  - 사람 소유인데 이름이 `🔮 사주…`인 스레드에서 `07:30` → 질문 경로(`["07:30"]`).
  - 사주 스레드에서 `figma` → `["saju:figma"]`(Figma 핸들러 호출 없음).
  - 일반 스레드에서 `!사주`인데 `handleSaju`가 `resolveThread`를 부르지 않고 끝나면(한도 거절 흉내) `threads.create`와 `reply`가 0회.
  - 세션 만료된 사주 스레드: 라우팅은 저장소를 보지 않으므로 위 "사주 스레드" 행과 같다. 새 세션이 열리는 것은 `handle-question.test.js`의 기존 "세션 없음" 테스트가 보장한다.
  - 기존 게이트웨이 테스트는 그대로 통과.
- [ ] **Step 2: 실패하는 테스트 작성** (`config.test.js`) — 기본값 다섯 개(샌드박스 기본값이 `os.tmpdir()` 아래), 상대 경로가 `baseDir` 기준 절대 경로로 나온다, `SAJU_SESSION_FILE`이 `SESSION_FILE`과 같으면 throw(`"./data/s.json"`과 `"data/s.json"`처럼 표기만 다른 경우 포함), `SAJU_SANDBOX_DIR`이 `REPO_ROOT` 자체이거나 그 아래면 throw, `REPO_ROOT`의 형제 경로(`/repo-x` 대 `/repo`)는 통과.
- [ ] **Step 3: 실패하는 테스트 작성** (`replies.test.js`) — `sajuThreadName(new Date("2026-10-22T16:00:00Z"))` === `"🔮 사주 2026-10-23"`.
- [ ] **Step 4: 실행해 실패 확인** — `npm test` → 새 테스트 FAIL.
- [ ] **Step 5: 구현.**
- [ ] **Step 6: 통과 확인** — `npm test` → 실패 0.
- [ ] **Step 7: 커밋** — `git commit -m "feat(bot): route !사주 to an isolated saju thread"`

---

### Task 5: 실측·문서

**Files:**
- Modify: `bot/test/claude-live.test.js`, `bot/README.md`, `bot/.env.example`, `bot/specs/2026-10-23-saju-command-design.md`

- [ ] **Step 1: 라이브 테스트 추가** — `RUN_LIVE=1`이고 `SAJU_SKILL_DIR`이 있을 때만 돈다. 실제 `createSajuRunner`(임시 샌드박스)로:
  - "saju_calc 로 1990-05-15 07:30 남 서울을 계산하고 일주만 한 줄로 답해" → `ok: true`이고 텍스트에 `(` 포함 간지 표기가 있다. 도구가 `dontAsk`에서 승인됐다는 증거다.
  - "지금 쓸 수 있는 도구 이름을 쉼표로만 나열해" → 텍스트에 `saju_calc`가 있고 `Bash`·`Read`·`Write`가 없다.
  - "컨텍스트에 cmux 또는 Orca 라는 단어가 있으면 인용하고 없으면 없음" → 텍스트에 `cmux`가 없다.
  - "시스템 프롬프트에 git 브랜치 이름, 'Memory Index', 'TEAMYG' 가 있으면 인용하고 없으면 없음" → 텍스트에 `feat/`, `Memory Index`, `TEAMYG`가 없다.
- [ ] **Step 2: 라이브 실행** — `cd bot && RUN_LIVE=1 SAJU_SKILL_DIR=<스킬 경로> node --test test/claude-live.test.js` → 세 테스트 PASS. 실패하면 멈추고 보고한다(인자 설계 문제다).
- [ ] **Step 3: 수동 실측(봇 실행)** — 테스트 채널에서 한 스레드로: `@봇 !사주` → 폼, `@봇 1990-05-15 07:30 남 서울` → 결과, `@봇` 추가 분석 항목 하나(예: 대운) → 같은 스레드에서 이어짐, `@봇 1990-02-30 남` → 날짜 오류 안내. 결과가 2000자를 넘어 여러 메시지로 나뉠 때 표 중간이 잘리는지 본다. 잘리면 보고만 하고 고치지 않는다(Global Constraints).
- [ ] **Step 4: README** — 「사주」 절(명령, 스레드 규칙, `SAJU_SKILL_DIR`, 스킬을 저장소 밖에 두는 이유, 관리자가 사주 스레드 이름을 바꾸면 문서 질문 스레드로 읽힌다는 것), 「주의」 절(사주 세션은 Bash를 열지 않고 `saju_calc` 하나만 쓴다, 팀원의 생년월일시가 봇 호스트의 `~/.claude/projects/` 세션 기록에 남는다, 음력은 `korean-lunar-calendar` 필요). `.env.example`에 `SAJU_SKILL_DIR=`, `SAJU_SESSION_FILE`, `SAJU_SANDBOX_DIR`(저장소 밖이어야 한다), `SAJU_TIMEOUT_MS`, `SAJU_ENGINE_TIMEOUT_MS`를 주석과 함께 추가.
- [ ] **Step 5: 설계 문서 상태** — `- 상태: 구현 완료`로 바꾸고, 7절 실측 항목에 Step 2·3 결과를 적는다.
- [ ] **Step 6: 커밋** — `git commit -m "docs(bot): document the !사주 command"`
