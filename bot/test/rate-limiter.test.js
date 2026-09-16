import { test } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../src/rate-limiter.js";

const DAY = 24 * 60 * 60 * 1000;

function build(overrides = {}) {
  const state = { clock: Date.parse("2026-09-17T09:00:00Z") };
  const limiter = createRateLimiter({
    maxConcurrent: 2,
    perUserPerMin: 2,
    dailyQuota: 60,
    now: () => state.clock,
    ...overrides,
  });
  return { limiter, state };
}

test("첫 요청은 허용된다", () => {
  const { limiter } = build();
  const result = limiter.acquire("user-1");
  assert.equal(result.ok, true);
});

test("사용자 분당 한도를 넘으면 reason 이 user 다", () => {
  const { limiter } = build();
  limiter.acquire("user-1").release();
  limiter.acquire("user-1").release();
  assert.deepEqual(limiter.acquire("user-1"), { ok: false, reason: "user" });
});

test("분당 한도는 다른 사용자에게 옮지 않는다", () => {
  const { limiter } = build();
  limiter.acquire("user-1").release();
  limiter.acquire("user-1").release();
  assert.equal(limiter.acquire("user-2").ok, true);
});

test("1분이 지나면 사용자 한도가 풀린다", () => {
  const { limiter, state } = build();
  limiter.acquire("user-1").release();
  limiter.acquire("user-1").release();
  state.clock += 60001;
  assert.equal(limiter.acquire("user-1").ok, true);
});

test("동시 실행 한도를 넘으면 reason 이 concurrent 다", () => {
  const { limiter } = build({ perUserPerMin: 100 });
  const first = limiter.acquire("user-1");
  limiter.acquire("user-2");
  assert.deepEqual(limiter.acquire("user-3"), { ok: false, reason: "concurrent" });
  first.release();
  assert.equal(limiter.acquire("user-3").ok, true);
});

test("일일 한도를 넘으면 reason 이 daily 다", () => {
  const { limiter, state } = build({ dailyQuota: 2, perUserPerMin: 100 });
  limiter.acquire("user-1").release();
  limiter.acquire("user-1").release();
  assert.deepEqual(limiter.acquire("user-1"), { ok: false, reason: "daily" });
  state.clock += DAY;
  assert.equal(limiter.acquire("user-1").ok, true);
});

test("일일 한도는 사용자 한도보다 먼저 판정된다", () => {
  const { limiter } = build({ dailyQuota: 1, perUserPerMin: 1 });
  limiter.acquire("user-1").release();
  assert.deepEqual(limiter.acquire("user-1"), { ok: false, reason: "daily" });
});

test("release 를 두 번 불러도 자리가 늘지 않는다", () => {
  const { limiter } = build({ maxConcurrent: 1, perUserPerMin: 100 });
  const first = limiter.acquire("user-1");
  first.release();
  first.release();
  assert.equal(limiter.acquire("user-2").ok, true);
  assert.deepEqual(limiter.acquire("user-3"), { ok: false, reason: "concurrent" });
});

test("거절된 요청은 어떤 카운터도 올리지 않는다", () => {
  const { limiter } = build({ maxConcurrent: 1, perUserPerMin: 100, dailyQuota: 3 });
  limiter.acquire("user-1");
  assert.equal(limiter.acquire("user-2").ok, false);
  assert.equal(limiter.acquire("user-2").ok, false);
  assert.equal(limiter.used().daily, 1);
});
