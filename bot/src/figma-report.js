import { spawn as nodeSpawn } from "node:child_process";

// 이 프로세스는 claude 가 아니라 Node 가 직접 띄운다. claude 쪽에서 Bash 와
// WebFetch 를 막아 둔 이유가 여기에 있다 — Figma API 를 치는 주체는 봇이지
// 채널에서 말을 거는 사람이 아니다.
const SECRET_ENV_KEYS = ["DISCORD_TOKEN"];
// 리포트는 길어야 수십 킬로바이트다. 이 선을 넘으면 폭주로 보고 끊는다.
const MAX_STDOUT_BYTES = 2 * 1024 * 1024;

function withoutSecrets(source) {
  const copy = { ...source };
  for (const key of SECRET_ENV_KEYS) delete copy[key];
  return copy;
}

export function serializeFiles(files) {
  return files.map(({ key, label }) => `${key}:${label}`).join(",");
}

export function createFigmaReportRunner({
  pythonBin,
  scriptPath,
  cwd,
  timeoutMs,
  token,
  files,
  reportDir,
  pythonArgsPrefix = [],
  env = process.env,
  spawn = nodeSpawn,
}) {
  function run() {
    // 설정이 없으면 띄우지 않는다. 토큰 없이 부른 Figma API 는 403 을 돌려주고,
    // 그 실패는 사용자에게 설정 문제로 읽히지 않는다.
    if (!token) {
      return Promise.resolve({
        ok: false,
        reason: "missing-token",
        detail: "FIGMA_TOKEN is not set",
      });
    }
    if (files.length === 0) {
      return Promise.resolve({
        ok: false,
        reason: "no-files",
        detail: "FIGMA_FILES is empty",
      });
    }

    return new Promise((resolve) => {
      const child = spawn(pythonBin, [...pythonArgsPrefix, scriptPath], {
        cwd,
        env: {
          ...withoutSecrets(env),
          FIGMA_TOKEN: token,
          FIGMA_FILES: serializeFiles(files),
          FIGMA_REPORT_DIR: reportDir,
        },
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
        const text = stdout.trim();
        if (text.length === 0) {
          finish({ ok: false, reason: "empty", detail: "report was blank" });
          return;
        }
        finish({ ok: true, text });
      });
    });
  }

  return { run };
}
