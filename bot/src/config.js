const REQUIRED = ["DISCORD_TOKEN", "GUILD_ID", "ALLOWED_CHANNEL_IDS", "REPO_ROOT", "CLAUDE_BIN"];

function readNumber(env, key, fallback) {
  const raw = env[key];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${key} must be a number, got: ${raw}`);
  return value;
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
  };
}
