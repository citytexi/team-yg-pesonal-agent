import { spawn as nodeSpawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { MODEL, runClaude, withoutSecrets } from "./claude-runner.js";

export const SAJU_TOOL = "mcp__saju__saju_calc";

export function buildSajuMcpConfig({ nodeBin, serverPath, skillDir, pythonBin, engineTimeoutMs }) {
  return JSON.stringify({
    mcpServers: {
      saju: {
        command: nodeBin,
        args: [serverPath],
        env: {
          SAJU_SKILL_DIR: skillDir,
          PYTHON_BIN: pythonBin,
          SAJU_ENGINE_TIMEOUT_MS: String(engineTimeoutMs),
        },
      },
    },
  });
}

// Runs claude fully isolated: an empty sandbox cwd, no built-in tools, no user
// or project settings, and saju_calc as the only reachable tool.
export function createSajuRunner({
  claudeBin,
  sandboxDir,
  systemPrompt,
  mcpConfig,
  timeoutMs,
  env = process.env,
  spawn = nodeSpawn,
}) {
  const childEnv = withoutSecrets(env);

  function buildArgs({ question, sessionId, resume = false }) {
    return [
      "-p",
      resume ? "--resume" : "--session-id",
      sessionId,
      "--model",
      MODEL,
      "--setting-sources",
      "",
      "--tools",
      "",
      "--strict-mcp-config",
      "--mcp-config",
      mcpConfig,
      "--allowed-tools",
      SAJU_TOOL,
      "--permission-mode",
      "dontAsk",
      "--append-system-prompt",
      systemPrompt,
      "--output-format",
      "json",
      "--",
      question,
    ];
  }

  function ask({ question, sessionId, resume = false }) {
    // OS temp cleanup can remove the sandbox while the bot runs. Same path, so
    // the --resume history location does not change.
    mkdirSync(sandboxDir, { recursive: true });
    return runClaude({
      claudeBin,
      args: buildArgs({ question, sessionId, resume }),
      cwd: sandboxDir,
      env: childEnv,
      timeoutMs,
      spawn,
    });
  }

  return { buildArgs, ask };
}
