import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createSajuRunner, buildSajuMcpConfig, SAJU_TOOL } from "../src/saju-runner.js";

function make(overrides = {}) {
  const calls = [];
  const spawn = (bin, args, options) => {
    calls.push({ bin, args, options });
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};
    setImmediate(() => {
      child.stdout.emit("data", JSON.stringify({ result: "풀이", session_id: "sid-1" }));
      child.emit("close", 0);
    });
    return child;
  };
  const runner = createSajuRunner({
    claudeBin: "claude",
    sandboxDir: "/tmp/sandbox",
    systemPrompt: "SYSTEM",
    mcpConfig: '{"mcpServers":{}}',
    timeoutMs: 5000,
    env: { PATH: "/bin", DISCORD_TOKEN: "d", FIGMA_TOKEN: "f", REPO_ROOT: "/repo" },
    spawn,
    ...overrides,
  });
  return { runner, calls };
}

test("격리 플래그가 빈 문자열 값과 함께 들어간다", () => {
  const args = make().runner.buildArgs({ question: "질문", sessionId: "u1" });
  assert.equal(args[args.indexOf("--setting-sources") + 1], "");
  assert.equal(args[args.indexOf("--tools") + 1], "");
  assert.ok(args.includes("--strict-mcp-config"));
  assert.equal(args[args.indexOf("--allowed-tools") + 1], SAJU_TOOL);
  assert.equal(args[args.indexOf("--allowed-tools") + 2], "--permission-mode");
  assert.deepEqual(args.slice(-2), ["--", "질문"]);
});

test("인자 순서가 정해진 그대로다", () => {
  const args = make().runner.buildArgs({ question: "q", sessionId: "u1" });
  assert.deepEqual(args, [
    "-p", "--session-id", "u1", "--model", "claude-sonnet-5-5",
    "--setting-sources", "", "--tools", "",
    "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
    "--allowed-tools", SAJU_TOOL, "--permission-mode", "dontAsk",
    "--append-system-prompt", "SYSTEM", "--output-format", "json", "--", "q",
  ]);
});

test("인자에 Bash·Read·저장소 루트가 없다", () => {
  const args = make().runner.buildArgs({ question: "질문", sessionId: "u1" });
  assert.ok(!args.includes("Bash"));
  assert.ok(!args.includes("Read"));
  assert.ok(!args.some((arg) => arg.includes("/repo")));
});

test("resume 이면 --resume, 아니면 --session-id", () => {
  const { runner } = make();
  const first = runner.buildArgs({ question: "q", sessionId: "u1" });
  assert.ok(first.includes("--session-id") && !first.includes("--resume"));
  const again = runner.buildArgs({ question: "q", sessionId: "u1", resume: true });
  assert.ok(again.includes("--resume") && !again.includes("--session-id"));
});

test("ask 는 샌드박스 cwd 와 비밀이 빠진 env 로 spawn 한다", async () => {
  const { runner, calls } = make();
  const result = await runner.ask({ question: "질문", sessionId: "u1" });
  assert.deepEqual(result, { ok: true, text: "풀이", sessionId: "sid-1" });
  assert.equal(calls[0].options.cwd, "/tmp/sandbox");
  assert.ok(!("DISCORD_TOKEN" in calls[0].options.env));
  assert.ok(!("FIGMA_TOKEN" in calls[0].options.env));
});

test("buildSajuMcpConfig 는 사주 서버 하나를 만든다", () => {
  const parsed = JSON.parse(
    buildSajuMcpConfig({
      nodeBin: "node",
      serverPath: "/srv/mcp.js",
      skillDir: "/skill",
      pythonBin: "python3",
      engineTimeoutMs: 20000,
    }),
  );
  const server = parsed.mcpServers.saju;
  assert.equal(server.command, "node");
  assert.deepEqual(server.args, ["/srv/mcp.js"]);
  assert.equal(server.env.SAJU_SKILL_DIR, "/skill");
  assert.equal(server.env.PYTHON_BIN, "python3");
  assert.equal(server.env.SAJU_ENGINE_TIMEOUT_MS, "20000");
});
