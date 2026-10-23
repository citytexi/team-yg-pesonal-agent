import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { loadConfig } from "./config.js";
import { createFigmaReportRunner } from "./figma-report.js";
import { createFigmaHandler } from "./handle-figma.js";
import { createSessionStore } from "./session-store.js";
import { createRateLimiter } from "./rate-limiter.js";
import { createClaudeRunner } from "./claude-runner.js";
import { createQuestionHandler } from "./handle-question.js";
import { createClient, startGateway } from "./gateway.js";
import { createSajuRunner, buildSajuMcpConfig } from "./saju-runner.js";
import { loadSajuPrompt } from "./saju-prompt.js";
import { redactDetail } from "./redact-log.js";
import { SAJU_DISABLED } from "./replies.js";
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

// Python runs from bot/ so FIGMA_REPORT_DIR's default ./data/reports lands in
// bot/data/reports, not the repo root. Saju paths resolve against it too.
const botRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const config = loadConfig(process.env, { baseDir: botRoot });
warnIfRepoDirty(config.repoRoot);
// Startup only. An uninitialized submodule stays that way until the host acts,
// so repeating this after every question would just be noise.
const submoduleMissing = submoduleMissingWarning(config.repoRoot);
if (submoduleMissing) log(submoduleMissing);

const store = createSessionStore({ filePath: config.sessionFile }); // one store per file
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

function buildSajuHandler() {
  const disabled = ({ replyDirect }) => replyDirect(SAJU_DISABLED);
  if (!config.sajuSkillDir) {
    log("saju disabled: SAJU_SKILL_DIR is not set");
    return disabled;
  }
  let systemPrompt;
  try {
    systemPrompt = loadSajuPrompt(config.sajuSkillDir);
  } catch (error) {
    log("saju disabled: could not load the skill prompt", error?.message ?? error);
    return disabled;
  }
  try {
    mkdirSync(config.sajuSandboxDir, { recursive: true });
    const sajuStore = createSessionStore({ filePath: config.sajuSessionFile });
    const sajuRunner = createSajuRunner({
      claudeBin: config.claudeBin,
      sandboxDir: config.sajuSandboxDir,
      systemPrompt,
      mcpConfig: buildSajuMcpConfig({
        nodeBin: process.execPath,
        serverPath: join(botRoot, "src", "saju-mcp-server.js"),
        skillDir: config.sajuSkillDir,
        pythonBin: config.pythonBin,
        engineTimeoutMs: config.sajuEngineTimeoutMs,
      }),
      timeoutMs: config.sajuTimeoutMs,
    });
    // The limiter is shared with the other handlers. No warnIfRepoDirty here:
    // saju never touches the repo. The log wrapper redacts failure details,
    // which can echo birth data.
    return createQuestionHandler({
      store: sajuStore,
      limiter,
      runner: sajuRunner,
      randomUUID,
      log: redactDetail(log),
    });
  } catch (error) {
    log("saju disabled: setup failed", error?.message ?? error);
    return disabled;
  }
}
const handleSaju = buildSajuHandler();

await startGateway({ config, handle, handleFigma, handleSaju, client: createClient(), log });
