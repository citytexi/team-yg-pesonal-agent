const REQUIRED = ["DISCORD_TOKEN", "GUILD_ID", "ALLOWED_CHANNEL_IDS", "REPO_ROOT", "CLAUDE_BIN"];

function readNumber(env, key, fallback) {
  const raw = env[key];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${key} must be a number, got: ${raw}`);
  return value;
}

// `키:라벨` 쌍을 쉼표로 잇는다. 라벨에 콜론이 들어갈 수 있어 첫 콜론에서만 가른다.
// 라벨을 생략하면 키가 그대로 라벨이 된다.
function readFigmaFiles(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const at = entry.indexOf(":");
      const key = (at === -1 ? entry : entry.slice(0, at)).trim();
      const label = (at === -1 ? "" : entry.slice(at + 1).trim()) || key;
      if (key.length === 0) {
        throw new Error(`FIGMA_FILES entry has no file key: ${entry}`);
      }
      return { key, label };
    });
}

export function loadConfig(env) {
  for (const key of REQUIRED) {
    if (!env[key]) throw new Error(`Missing required setting: ${key}`);
  }

  const allowedChannelIds = env.ALLOWED_CHANNEL_IDS.split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  if (allowedChannelIds.length === 0) {
    throw new Error("ALLOWED_CHANNEL_IDS must list at least one channel id");
  }

  return {
    discordToken: env.DISCORD_TOKEN,
    guildId: env.GUILD_ID,
    allowedChannelIds,
    repoRoot: env.REPO_ROOT,
    claudeBin: env.CLAUDE_BIN,
    sessionFile: env.SESSION_FILE || "./data/sessions.json",
    maxConcurrent: readNumber(env, "MAX_CONCURRENT", 2),
    ratePerUserPerMin: readNumber(env, "RATE_PER_USER_PER_MIN", 2),
    dailyQuota: readNumber(env, "DAILY_QUOTA", 60),
    timeoutMs: readNumber(env, "TIMEOUT_MS", 300000),
    // Figma 리포트는 선택 기능이다. 설정이 없으면 목록이 비고, 명령은 거절된다.
    figmaToken: env.FIGMA_TOKEN || "",
    figmaFiles: readFigmaFiles(env.FIGMA_FILES),
    pythonBin: env.PYTHON_BIN || "python3",
    figmaReportDir: env.FIGMA_REPORT_DIR || "./data/reports",
    figmaTimeoutMs: readNumber(env, "FIGMA_TIMEOUT_MS", 120000),
  };
}
