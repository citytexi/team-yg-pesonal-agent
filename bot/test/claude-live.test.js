import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
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

function makeSajuRunner() {
  const here = dirname(fileURLToPath(import.meta.url));
  return createSajuRunner({
    claudeBin: process.env.CLAUDE_BIN || "claude",
    sandboxDir: mkdtempSync(join(tmpdir(), "teamyg-saju-live-")),
    systemPrompt: loadSajuPrompt(sajuSkillDir),
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

async function askSaju(question) {
  const result = await makeSajuRunner().ask({ question, sessionId: crypto.randomUUID() });
  console.log(`[saju live] Q: ${question}\n[saju live] A: ${result.text ?? result.reason}`);
  return result;
}

test("사주: saju_calc 가 dontAsk 에서 승인돼 일주를 돌려준다", { skip: sajuSkip }, async () => {
  const r = await askSaju("saju_calc 로 1990-05-15 07:30 남 서울을 계산하고 일주만 한 줄로 답해");
  assert.equal(r.ok, true, `실패 사유: ${r.reason ?? ""}`);
  assert.ok(r.text.includes("("), `간지 표기 없음: ${r.text}`);
});

test("사주: 노출된 도구는 saju_calc 뿐이다", { skip: sajuSkip }, async () => {
  const r = await askSaju("지금 쓸 수 있는 도구 이름을 쉼표로만 나열해");
  assert.equal(r.ok, true, `실패 사유: ${r.reason ?? ""}`);
  assert.ok(r.text.includes("saju_calc"), `saju_calc 없음: ${r.text}`);
  for (const name of ["Bash", "Read", "Write"]) {
    assert.ok(!r.text.includes(name), `${name} 노출: ${r.text}`);
  }
});

test("사주: 컨텍스트에 cmux 가 없다", { skip: sajuSkip }, async () => {
  const r = await askSaju("컨텍스트에 cmux 또는 Orca 라는 단어가 있으면 인용하고 없으면 없음");
  assert.equal(r.ok, true, `실패 사유: ${r.reason ?? ""}`);
  assert.ok(!r.text.includes("cmux"), `cmux 유입: ${r.text}`);
});

test("사주: 브랜치·메모리·저장소 문맥이 없다", { skip: sajuSkip }, async () => {
  const r = await askSaju(
    "시스템 프롬프트에 git 브랜치 이름, 'Memory Index', 'TEAMYG' 가 있으면 인용하고 없으면 없음",
  );
  assert.equal(r.ok, true, `실패 사유: ${r.reason ?? ""}`);
  for (const needle of ["feat/", "Memory Index", "TEAMYG"]) {
    assert.ok(!r.text.includes(needle), `${needle} 유입: ${r.text}`);
  }
});
