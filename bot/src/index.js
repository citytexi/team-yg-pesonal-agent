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

const answer = createQuestionHandler({ store, limiter, runner, randomUUID, log });
const handle = async (args) => {
  const outcome = await answer(args);
  warnIfRepoDirty(config.repoRoot);
  return outcome;
};

await startGateway({ config, handle, client: createClient(), log });
