import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawn as nodeSpawnForTest } from "node:child_process";
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

test("쓰기·실행·외부 도구를 항상 차단한다", () => {
  const args = runner("success").buildArgs({ question: "질문", sessionId: "uuid-1" });
  const at = args.indexOf("--disallowed-tools");
  assert.ok(at > -1);
  const blocked = args.slice(at + 1, args.indexOf("--output-format"));
  for (const tool of ["Bash", "Edit", "Write", "NotebookEdit", "WebFetch", "WebSearch", "Agent"]) {
    assert.ok(blocked.includes(tool), `${tool} 이 차단 목록에 없다`);
  }
});

test("봇 자신의 디렉토리를 읽지 못하게 막는다", () => {
  const args = runner("success").buildArgs({ question: "질문", sessionId: "uuid-1" });
  assert.ok(args.includes("Read(./bot/**)"), "bot/ 읽기 차단이 없으면 .env 가 새어 나간다");
});

test("자식 프로세스 환경에 디스코드 토큰을 넘기지 않는다", async () => {
  let captured = null;
  const spy = (bin, args, options) => {
    captured = options;
    return nodeSpawnForTest(bin, args, options);
  };
  const r = createClaudeRunner({
    claudeBin: process.execPath,
    claudeArgsPrefix: [FAKE],
    repoRoot: here,
    timeoutMs: 5000,
    env: { ...process.env, FAKE_MODE: "success", DISCORD_TOKEN: "super-secret" },
    spawn: spy,
  });
  await r.ask({ question: "질문", sessionId: "uuid-1" });
  assert.equal(captured.env.DISCORD_TOKEN, undefined);
  assert.equal(captured.env.FAKE_MODE, "success");
});

test("모델을 claude-sonnet-5 로 고정한다", () => {
  const args = runner("success").buildArgs({ question: "질문", sessionId: "uuid-1" });
  const at = args.indexOf("--model");
  assert.ok(at > -1);
  assert.equal(args[at + 1], "claude-sonnet-5");
});

test("되물음에서도 모델을 고정한다", () => {
  const args = runner("success").buildArgs({ question: "질문", sessionId: "uuid-1", resume: true });
  assert.equal(args[args.indexOf("--model") + 1], "claude-sonnet-5");
});

test("--restricted 를 절대 넣지 않는다", () => {
  const args = runner("success").buildArgs({ question: "질문", sessionId: "uuid-1" });
  assert.ok(!args.includes("--restricted"));
});

test("질문을 -- 뒤 마지막 인자로 넘긴다", () => {
  const args = runner("success").buildArgs({ question: "질문", sessionId: "uuid-1" });
  assert.equal(args.at(-2), "--");
  assert.equal(args.at(-1), "질문");
});

test("하이픈으로 시작하는 질문도 옵션으로 새지 않는다", async () => {
  const question = "--restricted 옵션은 뭐야?";
  const args = runner("echo-args").buildArgs({ question, sessionId: "uuid-1" });
  assert.equal(args.at(-1), question);
  assert.equal(args.indexOf(question), args.length - 1, "질문이 인자 목록에 한 번만, 맨 끝에 있어야 한다");

  const result = await runner("echo-args").ask({ question, sessionId: "uuid-1" });
  assert.equal(result.ok, true);
  assert.equal(JSON.parse(result.text).at(-1), question);
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

test("stdout 이 상한을 넘으면 프로세스를 죽이고 exit 으로 끝낸다", async () => {
  const result = await runner("flood", 10000).ask({ question: "질문", sessionId: "uuid-1" });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "exit");
  assert.match(result.detail, /stdout/);
});

test("자식 프로세스의 stdin 을 열어두지 않는다", async () => {
  let captured = null;
  const spy = (bin, args, options) => {
    captured = options;
    return nodeSpawnForTest(bin, args, options);
  };
  const r = createClaudeRunner({
    claudeBin: process.execPath,
    claudeArgsPrefix: [FAKE],
    repoRoot: here,
    timeoutMs: 5000,
    env: { ...process.env, FAKE_MODE: "success" },
    spawn: spy,
  });
  await r.ask({ question: "질문", sessionId: "uuid-1" });
  assert.deepEqual(captured.stdio, ["ignore", "pipe", "pipe"]);
});

test("시간이 초과되면 reason 이 timeout 이다", async () => {
  const result = await runner("hang", 300).ask({ question: "질문", sessionId: "uuid-1" });
  assert.equal(result.reason, "timeout");
});
