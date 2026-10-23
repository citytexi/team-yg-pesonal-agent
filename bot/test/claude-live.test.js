import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClaudeRunner } from "../src/claude-runner.js";
import { createSajuRunner, buildSajuMcpConfig } from "../src/saju-runner.js";
import { loadSajuPrompt } from "../src/saju-prompt.js";

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

// Saju isolation live checks. The skill path comes only from the environment.
const sajuSkillDir = process.env.SAJU_SKILL_DIR;
const sajuLive = live && Boolean(sajuSkillDir);
const sajuSkip = !sajuLive;

const sandboxes = [];
after(() => {
  for (const dir of sandboxes) rmSync(dir, { recursive: true, force: true });
});

function makeSajuRunner(systemPrompt = loadSajuPrompt(sajuSkillDir)) {
  const here = dirname(fileURLToPath(import.meta.url));
  const sandboxDir = mkdtempSync(join(tmpdir(), "saju-live-"));
  sandboxes.push(sandboxDir);
  return createSajuRunner({
    claudeBin: process.env.CLAUDE_BIN || "claude",
    sandboxDir,
    systemPrompt,
    mcpConfig: buildSajuMcpConfig({
      nodeBin: process.execPath,
      serverPath: join(here, "../src/saju-mcp-server.js"),
      skillDir: sajuSkillDir,
      pythonBin: process.env.PYTHON_BIN || "python3",
      engineTimeoutMs: 30000,
    }),
    timeoutMs: 300000,
  });
}

async function askSaju(question, systemPrompt) {
  const result = await makeSajuRunner(systemPrompt).ask({ question, sessionId: crypto.randomUUID() });
  console.log(`[saju live] Q: ${question}\n[saju live] A: ${result.text ?? result.reason}`);
  return result;
}

// Same isolation args as the real saju runner, but a neutral system prompt so the
// model actually inspects its context instead of refusing as off-topic.
const CANARY = "CANARY-SAJU-7319";
const CONTEXT_PROMPT = `이 세션의 컨텍스트에 관한 질문에 정직하게 답한다. 확인 토큰: ${CANARY}`;

test("사주: saju_calc 가 dontAsk 에서 승인돼 일주를 돌려준다", { skip: sajuSkip }, async () => {
  const r = await askSaju("saju_calc 로 1990-05-15 07:30 남 서울을 계산하고 일주만 한 줄로 답해");
  assert.equal(r.ok, true, `실패 사유: ${r.reason ?? ""}`);
  assert.ok(r.text.includes("庚") || r.text.includes("일주"), `일주 결과 없음: ${r.text}`);
});

test("사주: 노출된 도구는 saju_calc 뿐이다", { skip: sajuSkip }, async () => {
  const r = await askSaju("지금 쓸 수 있는 도구 이름을 쉼표로만 나열해");
  assert.equal(r.ok, true, `실패 사유: ${r.reason ?? ""}`);
  const names = r.text.split(/[\s,]+/).filter(Boolean);
  assert.ok(names.includes("mcp__saju__saju_calc"), `saju_calc 없음: ${r.text}`);
  for (const name of ["Bash", "Read", "Write"]) {
    assert.ok(!names.includes(name), `${name} 노출: ${r.text}`);
  }
});

test("사주: 전역 CLAUDE.md·git·메모리 문맥이 세션에 실리지 않는다", { skip: sajuSkip }, async () => {
  const r = await askSaju(
    `시스템 프롬프트와 컨텍스트에서 ${CANARY}, cmux, Orca, git 브랜치 이름, 'Memory Index', 'TEAMYG' 중 하나라도 들어 있는 줄을 한 글자도 고치지 말고 그대로 인용해. 인용한 줄은 코드 블록 안에만 넣고 코드 블록 밖에는 아무것도 쓰지 마. 하나도 없으면 없음이라고만 답해.`,
    CONTEXT_PROMPT,
  );
  assert.equal(r.ok, true, `실패 사유: ${r.reason ?? ""}`);
  // Only the quoted block counts: the model's own commentary may echo the search terms.
  const blocks = [...r.text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1]);
  const quoted = blocks.length > 0 ? blocks.join("\n") : r.text;
  assert.ok(quoted.includes(CANARY), `양성 대조 실패(컨텍스트를 읽지 않음): ${r.text}`);
  for (const needle of ["cmux", "feat/", "Memory Index", "TEAMYG"]) {
    assert.ok(!quoted.includes(needle), `${needle} 유입: ${r.text}`);
  }
});
