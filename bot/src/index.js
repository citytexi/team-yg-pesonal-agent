import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { loadConfig } from "./config.js";
import { createFigmaReportRunner } from "./figma-report.js";
import { createFigmaHandler } from "./handle-figma.js";
import { createSessionStore } from "./session-store.js";
import { createRateLimiter } from "./rate-limiter.js";
import { createClaudeRunner } from "./claude-runner.js";
import { createQuestionHandler } from "./handle-question.js";
import { createClient, startGateway } from "./gateway.js";
import { repoWarnings, submoduleMissingWarning } from "./repo-check.js";

const log = (...args) => console.log(new Date().toISOString(), ...args);

function warnIfRepoDirty(repoRoot) {
  try {
    const output = execFileSync("git", ["status", "--porcelain"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    for (const warning of repoWarnings(output)) {
      log(warning, output.slice(0, 500));
    }
  } catch (error) {
    log("could not check repo state", error?.message ?? error);
  }
}

const config = loadConfig(process.env);
warnIfRepoDirty(config.repoRoot);
// Startup only. An uninitialized submodule stays that way until the host acts,
// so repeating this after every question would just be noise.
const submoduleMissing = submoduleMissingWarning(config.repoRoot);
if (submoduleMissing) log(submoduleMissing);

const store = createSessionStore({ filePath: config.sessionFile }); // exactly one per process
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

// 파이썬은 bot/ 에서 돈다. FIGMA_REPORT_DIR 의 기본값 ./data/reports 가
// 저장소 루트가 아니라 bot/data/reports 로 떨어져야 하기 때문이다.
const botRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const figmaRunner = createFigmaReportRunner({
  pythonBin: config.pythonBin,
  scriptPath: join(botRoot, "scripts", "figma_comment_scheduler.py"),
  cwd: botRoot,
  timeoutMs: config.figmaTimeoutMs,
  token: config.figmaToken,
  files: config.figmaFiles,
  reportDir: resolve(botRoot, config.figmaReportDir),
});

const answer = createQuestionHandler({ store, limiter, runner, randomUUID, log });
const figmaReport = createFigmaHandler({
  limiter,
  reportRunner: figmaRunner,
  runner,
  randomUUID,
  log,
});
const handle = async (args) => {
  const outcome = await answer(args);
  warnIfRepoDirty(config.repoRoot);
  return outcome;
};

const handleFigma = async (args) => {
  const outcome = await figmaReport(args);
  warnIfRepoDirty(config.repoRoot);
  return outcome;
};

await startGateway({ config, handle, handleFigma, client: createClient(), log });
