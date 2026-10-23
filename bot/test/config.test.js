import { test } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

test("Figma 설정이 없으면 빈 목록과 기본값을 준다", () => {
  const config = loadConfig(base);
  assert.deepEqual(config.figmaFiles, []);
  assert.equal(config.figmaToken, "");
  assert.equal(config.pythonBin, "python3");
  assert.equal(config.figmaReportDir, "./data/reports");
  assert.equal(config.figmaTimeoutMs, 120000);
});

test("FIGMA_FILES 를 키와 라벨 쌍으로 읽는다", () => {
  const config = loadConfig({
    ...base,
    FIGMA_FILES: "abc123:디자인 파일,def456:기획 문서",
  });
  assert.deepEqual(config.figmaFiles, [
    { key: "abc123", label: "디자인 파일" },
    { key: "def456", label: "기획 문서" },
  ]);
});

test("FIGMA_FILES 의 공백을 없애고 빈 항목을 버린다", () => {
  const config = loadConfig({ ...base, FIGMA_FILES: " abc123 : 라벨 A , ,def456:라벨 B " });
  assert.deepEqual(config.figmaFiles, [
    { key: "abc123", label: "라벨 A" },
    { key: "def456", label: "라벨 B" },
  ]);
});

test("라벨에 콜론이 있어도 첫 콜론에서만 가른다", () => {
  const config = loadConfig({ ...base, FIGMA_FILES: "abc123:기획: 2차" });
  assert.deepEqual(config.figmaFiles, [{ key: "abc123", label: "기획: 2차" }]);
});

test("라벨을 생략하면 키를 라벨로 쓴다", () => {
  const config = loadConfig({ ...base, FIGMA_FILES: "abc123" });
  assert.deepEqual(config.figmaFiles, [{ key: "abc123", label: "abc123" }]);
});

test("키가 없는 항목은 그 값을 담아 던진다", () => {
  assert.throws(() => loadConfig({ ...base, FIGMA_FILES: ":라벨만 있음" }), /FIGMA_FILES/);
});

test("사주 기본값을 채운다", () => {
  const config = loadConfig(base, { baseDir: "/bot" });
  assert.equal(config.sajuSkillDir, "");
  assert.equal(config.sajuSandboxDir, join(tmpdir(), "teamyg-bot-saju-sandbox"));
  assert.equal(config.sajuSessionFile, "/bot/data/saju-sessions.json");
  assert.equal(config.sajuTimeoutMs, config.timeoutMs);
  assert.equal(config.sajuEngineTimeoutMs, 30000);
});

test("사주 타임아웃 기본값은 TIMEOUT_MS를 따른다", () => {
  assert.equal(loadConfig({ ...base, TIMEOUT_MS: "1000" }).sajuTimeoutMs, 1000);
});

test("사주 상대 경로는 baseDir 기준 절대 경로가 된다", () => {
  const config = loadConfig(
    { ...base, SAJU_SESSION_FILE: "data/x.json", SAJU_SANDBOX_DIR: "sandbox" },
    { baseDir: "/bot" },
  );
  assert.equal(config.sajuSessionFile, "/bot/data/x.json");
  assert.equal(config.sajuSandboxDir, "/bot/sandbox");
});

test("SAJU_SESSION_FILE이 SESSION_FILE과 같으면 표기가 달라도 던진다", () => {
  assert.throws(
    () => loadConfig({ ...base, SESSION_FILE: "./data/s.json", SAJU_SESSION_FILE: "data/s.json" }, { baseDir: "/bot" }),
    /SAJU_SESSION_FILE/,
  );
});

test("SAJU_SANDBOX_DIR이 REPO_ROOT이거나 그 아래면 던진다", () => {
  assert.throws(() => loadConfig({ ...base, SAJU_SANDBOX_DIR: "/repo" }), /SAJU_SANDBOX_DIR/);
  assert.throws(() => loadConfig({ ...base, SAJU_SANDBOX_DIR: "/repo/bot/sandbox" }), /SAJU_SANDBOX_DIR/);
});

test("REPO_ROOT의 형제 경로는 샌드박스로 쓸 수 있다", () => {
  assert.equal(loadConfig({ ...base, SAJU_SANDBOX_DIR: "/repo-x" }).sajuSandboxDir, "/repo-x");
});

test("사주 숫자 설정을 덮어쓸 수 있다", () => {
  const config = loadConfig({ ...base, SAJU_TIMEOUT_MS: "5", SAJU_ENGINE_TIMEOUT_MS: "7", SAJU_SKILL_DIR: "/skill" });
  assert.equal(config.sajuTimeoutMs, 5);
  assert.equal(config.sajuEngineTimeoutMs, 7);
  assert.equal(config.sajuSkillDir, "/skill");
});
