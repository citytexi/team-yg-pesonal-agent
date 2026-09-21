import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawn as nodeSpawnForTest } from "node:child_process";
import { createFigmaReportRunner } from "../src/figma-report.js";

const here = dirname(fileURLToPath(import.meta.url));
const FAKE = join(here, "fixtures", "fake-figma.mjs");

const FILES = [
  { key: "abc123", label: "디자인 파일" },
  { key: "def456", label: "기획 문서" },
];

function runner(mode, overrides = {}) {
  return createFigmaReportRunner({
    pythonBin: process.execPath,
    pythonArgsPrefix: [FAKE],
    scriptPath: "/script/figma_comment_scheduler.py",
    cwd: here,
    timeoutMs: 5000,
    token: "figd_test",
    files: FILES,
    reportDir: "./data/reports",
    env: { ...process.env, FAKE_MODE: mode },
    ...overrides,
  });
}

test("성공하면 표준 출력을 그대로 돌려준다", async () => {
  const result = await runner("success").run();
  assert.deepEqual(result, { ok: true, text: "리포트 본문" });
});

test("스크립트 경로를 인자로 넘긴다", async () => {
  const result = await runner("echo-env").run();
  assert.deepEqual(JSON.parse(result.text).argv, ["/script/figma_comment_scheduler.py"]);
});

test("토큰과 파일 목록을 환경변수로 넘긴다", async () => {
  const result = await runner("echo-env").run();
  const seen = JSON.parse(result.text);
  assert.equal(seen.token, "figd_test");
  assert.equal(seen.files, "abc123:디자인 파일,def456:기획 문서");
  assert.equal(seen.reportDir, "./data/reports");
});

test("파이썬 자식 프로세스에 디스코드 토큰을 넘기지 않는다", async () => {
  const result = await runner("echo-env", {
    env: { ...process.env, FAKE_MODE: "echo-env", DISCORD_TOKEN: "super-secret" },
  }).run();
  assert.equal(JSON.parse(result.text).discord, null);
});

test("토큰이 없으면 프로세스를 띄우지 않고 missing-token 으로 끝낸다", async () => {
  let spawned = 0;
  const result = await runner("success", {
    token: "",
    spawn: (...args) => {
      spawned += 1;
      return nodeSpawnForTest(...args);
    },
  }).run();
  assert.equal(result.ok, false);
  assert.equal(result.reason, "missing-token");
  assert.equal(spawned, 0);
});

test("파일 목록이 비면 프로세스를 띄우지 않고 no-files 로 끝낸다", async () => {
  let spawned = 0;
  const result = await runner("success", {
    files: [],
    spawn: (...args) => {
      spawned += 1;
      return nodeSpawnForTest(...args);
    },
  }).run();
  assert.equal(result.ok, false);
  assert.equal(result.reason, "no-files");
  assert.equal(spawned, 0);
});

test("비정상 종료는 reason 이 exit 이고 stderr 를 담는다", async () => {
  const result = await runner("exit").run();
  assert.equal(result.ok, false);
  assert.equal(result.reason, "exit");
  assert.match(result.detail, /403/);
});

test("공백뿐인 출력은 reason 이 empty 다", async () => {
  const result = await runner("empty").run();
  assert.equal(result.ok, false);
  assert.equal(result.reason, "empty");
});

test("시간이 초과되면 reason 이 timeout 이다", async () => {
  const result = await runner("hang", { timeoutMs: 300 }).run();
  assert.equal(result.reason, "timeout");
});

test("출력이 상한을 넘으면 프로세스를 죽이고 exit 으로 끝낸다", async () => {
  const result = await runner("flood", { timeoutMs: 10000 }).run();
  assert.equal(result.ok, false);
  assert.equal(result.reason, "exit");
  assert.match(result.detail, /stdout/);
});

test("자식 프로세스의 stdin 을 열어두지 않는다", async () => {
  let captured = null;
  await runner("success", {
    spawn: (bin, args, options) => {
      captured = options;
      return nodeSpawnForTest(bin, args, options);
    },
  }).run();
  assert.deepEqual(captured.stdio, ["ignore", "pipe", "pipe"]);
});
