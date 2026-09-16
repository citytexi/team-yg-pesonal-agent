import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";

const base = {
  DISCORD_TOKEN: "token",
  GUILD_ID: "111",
  ALLOWED_CHANNEL_IDS: "222,333",
  REPO_ROOT: "/repo",
  CLAUDE_BIN: "/bin/claude",
};

test("필수 키가 모두 있으면 설정을 만든다", () => {
  const config = loadConfig(base);
  assert.equal(config.discordToken, "token");
  assert.equal(config.guildId, "111");
  assert.deepEqual(config.allowedChannelIds, ["222", "333"]);
  assert.equal(config.repoRoot, "/repo");
});

test("기본값을 채운다", () => {
  const config = loadConfig(base);
  assert.equal(config.maxConcurrent, 2);
  assert.equal(config.ratePerUserPerMin, 2);
  assert.equal(config.dailyQuota, 60);
  assert.equal(config.timeoutMs, 300000);
  assert.equal(config.sessionFile, "./data/sessions.json");
});

test("숫자 설정을 덮어쓸 수 있다", () => {
  const config = loadConfig({ ...base, DAILY_QUOTA: "10", TIMEOUT_MS: "1000" });
  assert.equal(config.dailyQuota, 10);
  assert.equal(config.timeoutMs, 1000);
});

test("채널 목록의 공백을 없애고 빈 항목을 버린다", () => {
  const config = loadConfig({ ...base, ALLOWED_CHANNEL_IDS: " 222 , ,333 " });
  assert.deepEqual(config.allowedChannelIds, ["222", "333"]);
});

test("필수 키가 없으면 그 이름을 담아 던진다", () => {
  const { DISCORD_TOKEN, ...missing } = base;
  assert.throws(() => loadConfig(missing), /DISCORD_TOKEN/);
});

test("채널 목록이 비면 던진다", () => {
  assert.throws(() => loadConfig({ ...base, ALLOWED_CHANNEL_IDS: "" }), /ALLOWED_CHANNEL_IDS/);
});

test("숫자가 아닌 값을 주면 그 키를 담아 던진다", () => {
  assert.throws(() => loadConfig({ ...base, DAILY_QUOTA: "many" }), /DAILY_QUOTA/);
});
