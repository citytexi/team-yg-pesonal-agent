import { spawn as nodeSpawn } from "node:child_process";

// Read is NOT harmless here. The working directory is the repo root, and the
// bot's own secrets live under bot/. Anyone in the channel could otherwise ask
// the bot to read bot/.env back to them.
// WebSearch and Agent stay out too: --allowed-tools is not a whitelist, so a
// tool that is merely unlisted still runs under --permission-mode dontAsk.
const BLOCKED_TOOLS = [
  "Bash",
  "Edit",
  "Write",
  "NotebookEdit",
  "WebFetch",
  "WebSearch",
  "Agent",
  "Read(./bot/**)",
  // Redundant today and kept on purpose. Measured 2026-09-17: a Grep at
  // bot/ already fails with "Permission to read ... has been denied", because
  // the path rule above applies when the file is read, whichever tool reads it.
  // This line states the intent so the answer survives a change in that ruling.
  "Grep(./bot/**)",
];

// The answering rules live in .claude/skills/ask/SKILL.md, not here. This line
// only makes sure the skill is loaded; when parfait/ is restructured again, the
// skill file is the single place that changes.
const SKILL_DIRECTIVE =
  "이 저장소 문서를 근거로 답하는 질문이다. `ask` 스킬을 로드하고 그 규약대로 답하라.";
const SECRET_ENV_KEYS = ["DISCORD_TOKEN"];
const MODEL = "claude-sonnet-5";
// A wiki answer is a few kilobytes. Anything past this is a runaway process, and
// buffering it whole is how the bot runs out of memory.
const MAX_STDOUT_BYTES = 2 * 1024 * 1024;

function withoutSecrets(source) {
  const copy = { ...source };
  for (const key of SECRET_ENV_KEYS) delete copy[key];
  return copy;
}

export function createClaudeRunner({
  claudeBin,
  repoRoot,
  timeoutMs,
  claudeArgsPrefix = [],
  env = process.env,
  spawn = nodeSpawn,
}) {
  const childEnv = withoutSecrets(env);
  function buildArgs({ question, sessionId, resume = false }) {
    return [
      ...claudeArgsPrefix,
      "-p",
      resume ? "--resume" : "--session-id",
      sessionId,
      "--model",
      MODEL,
      "--permission-mode",
      "dontAsk",
      "--append-system-prompt",
      SKILL_DIRECTIVE,
      "--disallowed-tools",
      ...BLOCKED_TOOLS,
      "--output-format",
      "json",
      "--",
      question,
    ];
  }

  function ask({ question, sessionId, resume = false }) {
    return new Promise((resolve) => {
      const child = spawn(claudeBin, buildArgs({ question, sessionId, resume }), {
        cwd: repoRoot,
        env: childEnv,
        // The prompt travels as an argument. An open stdin pipe only invites the
        // CLI to wait for EOF that never comes.
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let settled = false;

      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };

      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        finish({ ok: false, reason: "timeout", detail: `exceeded ${timeoutMs}ms` });
      }, timeoutMs);

      child.stdout.on("data", (chunk) => {
        stdout += chunk;
        if (stdout.length > MAX_STDOUT_BYTES) {
          child.kill("SIGKILL");
          finish({
            ok: false,
            reason: "exit",
            detail: `stdout exceeded ${MAX_STDOUT_BYTES} bytes`,
          });
        }
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });

      child.on("error", (error) => {
        finish({ ok: false, reason: "exit", detail: error.message });
      });

      child.on("close", (code) => {
        if (code !== 0) {
          finish({ ok: false, reason: "exit", detail: `code ${code}: ${stderr.slice(0, 500)}` });
          return;
        }

        let payload;
        try {
          payload = JSON.parse(stdout);
        } catch {
          finish({ ok: false, reason: "parse", detail: stdout.slice(0, 500) });
          return;
        }

        if (payload.is_error) {
          finish({ ok: false, reason: "error", detail: String(payload.subtype ?? "unknown") });
          return;
        }

        const text = typeof payload.result === "string" ? payload.result.trim() : "";
        if (text.length === 0) {
          finish({ ok: false, reason: "empty", detail: "result was blank" });
          return;
        }

        finish({ ok: true, text, sessionId: payload.session_id });
      });
    });
  }

  return { buildArgs, ask };
}
