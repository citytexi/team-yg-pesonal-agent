import { test } from "node:test";
import assert from "node:assert/strict";
import { redactDetail } from "../src/redact-log.js";

test("detail 필드는 길이만 남기고 가린다", () => {
  const calls = [];
  const log = redactDetail((...args) => calls.push(args));
  log("claude failed", { threadId: "t1", reason: "parse", detail: "1990-05-15 07:30 남" });
  assert.deepEqual(calls, [["claude failed", { threadId: "t1", reason: "parse", detail: "<redacted 18 chars>" }]]);
});

test("detail 이 없거나 객체가 아닌 인자는 그대로 넘긴다", () => {
  const calls = [];
  const log = redactDetail((...args) => calls.push(args));
  log("plain", { threadId: "t1" }, "text");
  assert.deepEqual(calls, [["plain", { threadId: "t1" }, "text"]]);
});

test("원본 컨텍스트 객체를 바꾸지 않는다", () => {
  const ctx = { detail: "abc" };
  redactDetail(() => {})("m", ctx);
  assert.equal(ctx.detail, "abc");
});
