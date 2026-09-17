import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSessionStore } from "../src/session-store.js";

function tempFile(name = "sessions.json") {
  const dir = mkdtempSync(join(tmpdir(), "session-store-"));
  return { dir, path: join(dir, name) };
}

test("없는 쓰레드는 null 이다", () => {
  const { dir, path } = tempFile();
  const store = createSessionStore({ filePath: path });
  assert.equal(store.get("thread-1"), null);
  rmSync(dir, { recursive: true, force: true });
});

test("저장한 값을 돌려준다", () => {
  const { dir, path } = tempFile();
  const store = createSessionStore({ filePath: path });
  store.set("thread-1", "uuid-1");
  assert.equal(store.get("thread-1"), "uuid-1");
  rmSync(dir, { recursive: true, force: true });
});

test("새 인스턴스에서도 값이 남는다", () => {
  const { dir, path } = tempFile();
  createSessionStore({ filePath: path }).set("thread-1", "uuid-1");
  assert.equal(createSessionStore({ filePath: path }).get("thread-1"), "uuid-1");
  rmSync(dir, { recursive: true, force: true });
});

test("ttl 이 지나면 null 이다", () => {
  const { dir, path } = tempFile();
  let clock = 1000;
  const store = createSessionStore({ filePath: path, now: () => clock, ttlMs: 500 });
  store.set("thread-1", "uuid-1");
  clock = 1499;
  assert.equal(store.get("thread-1"), "uuid-1");
  clock = 1501;
  assert.equal(store.get("thread-1"), null);
  rmSync(dir, { recursive: true, force: true });
});

test("remove 는 값을 지운다", () => {
  const { dir, path } = tempFile();
  const store = createSessionStore({ filePath: path });
  store.set("thread-1", "uuid-1");
  store.remove("thread-1");
  assert.equal(store.get("thread-1"), null);
  rmSync(dir, { recursive: true, force: true });
});

test("updatedAt 이 없는 항목은 버린다", () => {
  const { dir, path } = tempFile();
  writeFileSync(path, JSON.stringify({ "thread-1": { sessionId: "uuid-1" } }));
  const store = createSessionStore({ filePath: path });
  assert.equal(store.get("thread-1"), null);
  rmSync(dir, { recursive: true, force: true });
});

test("깨진 JSON 파일이면 빈 상태로 시작한다", () => {
  const { dir, path } = tempFile();
  writeFileSync(path, "{ not json");
  const store = createSessionStore({ filePath: path });
  assert.equal(store.get("thread-1"), null);
  store.set("thread-1", "uuid-1");
  assert.equal(store.get("thread-1"), "uuid-1");
  rmSync(dir, { recursive: true, force: true });
});

test("디렉토리가 없으면 만든다", () => {
  const { dir, path } = tempFile();
  const nested = join(dir, "a", "b", "sessions.json");
  const store = createSessionStore({ filePath: nested });
  store.set("thread-1", "uuid-1");
  assert.equal(createSessionStore({ filePath: nested }).get("thread-1"), "uuid-1");
  rmSync(dir, { recursive: true, force: true });
});
