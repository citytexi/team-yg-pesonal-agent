import { test } from "node:test";
import assert from "node:assert/strict";
import { createClaudeRunner } from "../src/claude-runner.js";

const live = process.env.RUN_LIVE === "1";

test("실제 claude 가 sonnet-5 로 답한다", { skip: !live }, async () => {
  const runner = createClaudeRunner({
    claudeBin: process.env.CLAUDE_BIN || "claude",
    repoRoot: process.env.REPO_ROOT || process.cwd(),
    timeoutMs: 300000,
  });
  const result = await runner.ask({
    question: "도구 쓰지 말고 숫자 1만 출력해라",
    sessionId: crypto.randomUUID(),
  });
  assert.equal(result.ok, true, `실패 사유: ${result.reason ?? ""}`);
  assert.ok(result.text.includes("1"));
});
