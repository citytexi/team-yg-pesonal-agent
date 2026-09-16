import { spawn as nodeSpawn } from "node:child_process";

const BLOCKED_TOOLS = ["Bash", "Edit", "Write", "NotebookEdit", "WebFetch"];
const MODEL = "claude-sonnet-5";

export function createClaudeRunner({
  claudeBin,
  repoRoot,
  timeoutMs,
  claudeArgsPrefix = [],
  env = process.env,
  spawn = nodeSpawn,
}) {
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
        env,
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
