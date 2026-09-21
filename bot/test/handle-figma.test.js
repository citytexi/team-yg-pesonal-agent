import { test } from "node:test";
import assert from "node:assert/strict";
import { createFigmaHandler, MAX_SUMMARY_INPUT } from "../src/handle-figma.js";

function harness({
  reportResult = { ok: true, text: "리포트 본문" },
  askResult = { ok: true, text: "요약 본문", sessionId: "s-1" },
  acquire,
  throwOnThread = false,
  throwOnPost = false,
} = {}) {
  const posted = [];
  const direct = [];
  const calls = [];
  let threadOpens = 0;
  let reportRuns = 0;
  let released = 0;

  const handle = createFigmaHandler({
    limiter: {
      acquire:
        acquire ??
        (() => ({
          ok: true,
          release() {
            released += 1;
          },
        })),
    },
    reportRunner: {
      run() {
        reportRuns += 1;
        return Promise.resolve(reportResult);
      },
    },
    runner: {
      ask(args) {
        calls.push(args);
        return Promise.resolve(askResult);
      },
    },
    randomUUID: () => "uuid-1",
    log: () => {},
  });

  const run = () =>
    handle({
      userId: "user-1",
      resolveThread: async () => {
        threadOpens += 1;
        if (throwOnThread) throw new Error("discord is down");
        return {
          threadId: "thread-1",
          postMessages: async (messages) => {
            if (throwOnPost) throw new Error("discord is down");
            posted.push(...messages);
          },
        };
      },
      replyDirect: async (text) => direct.push(text),
    });

  return {
    run,
    posted,
    direct,
    calls,
    threadOpens: () => threadOpens,
    reportRuns: () => reportRuns,
    released: () => released,
  };
}

test("리포트 원문을 먼저 올리고 그 뒤에 요약을 올린다", async () => {
  const h = harness();
  const outcome = await h.run();

  assert.deepEqual(outcome, { status: "reported" });
  assert.equal(h.posted[0], "리포트 본문", "원문이 첫 메시지여야 한다");
  assert.ok(h.posted.at(-1).includes("요약 본문"));
});

test("리포트 원문을 한 글자도 고치지 않는다", async () => {
  const raw = ":clipboard: Figma 코멘트 일일 리포트\n:red_circle: 미해결 항목 (2건)";
  const h = harness({ reportResult: { ok: true, text: raw } });
  await h.run();
  assert.equal(h.posted[0], raw);
});

test("요약은 새 세션으로, ask 스킬이 아닌 지시로 묻는다", async () => {
  const h = harness();
  await h.run();

  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].resume, false);
  assert.equal(h.calls[0].sessionId, "uuid-1");
  assert.ok(!/ask/.test(h.calls[0].systemPrompt), "위키 답변 규약을 요약에 쓰면 안 된다");
  assert.ok(h.calls[0].question.includes("리포트 본문"), "리포트를 프롬프트에 실어야 한다");
});

test("리포트가 너무 길면 요약에 넘기는 분량만 자른다", async () => {
  const huge = "가".repeat(MAX_SUMMARY_INPUT + 5000);
  const h = harness({ reportResult: { ok: true, text: huge } });
  await h.run();

  // posted 뒤쪽에는 요약 메시지가 붙으므로 앞부분만 원문과 대조한다.
  assert.ok(h.posted.join("").startsWith(huge), "게시되는 원문은 자르지 않는다");
  assert.ok(h.calls[0].question.length < huge.length, "요약 입력은 잘려야 한다");
});

test("리포트가 실패하면 그 사유를 알리고 claude 를 띄우지 않는다", async () => {
  const h = harness({ reportResult: { ok: false, reason: "missing-token", detail: "x" } });
  const outcome = await h.run();

  assert.deepEqual(outcome, { status: "failed", reason: "missing-token" });
  assert.equal(h.calls.length, 0);
  assert.equal(h.posted.length, 1);
  assert.match(h.posted[0], /FIGMA_TOKEN/);
});

test("요약이 실패해도 리포트는 남고 요약 실패만 알린다", async () => {
  const h = harness({ askResult: { ok: false, reason: "timeout", detail: "x" } });
  const outcome = await h.run();

  assert.deepEqual(outcome, { status: "reported" });
  assert.equal(h.posted[0], "리포트 본문");
  assert.match(h.posted.at(-1), /요약만 실패/);
});

test("한도에 걸리면 쓰레드도 열지 않고 스크립트도 띄우지 않는다", async () => {
  const h = harness({ acquire: () => ({ ok: false, reason: "daily" }) });
  const outcome = await h.run();

  assert.deepEqual(outcome, { status: "rejected", reason: "daily" });
  assert.equal(h.threadOpens(), 0);
  assert.equal(h.reportRuns(), 0);
  assert.equal(h.direct.length, 1);
});

test("쓰레드를 못 열면 delivery 로 끝내고 자리를 반납한다", async () => {
  const h = harness({ throwOnThread: true });
  const outcome = await h.run();

  assert.deepEqual(outcome, { status: "failed", reason: "delivery" });
  assert.equal(h.reportRuns(), 0);
  assert.equal(h.released(), 1);
});

test("게시가 실패하면 delivery 로 끝낸다", async () => {
  const h = harness({ throwOnPost: true });
  const outcome = await h.run();

  assert.deepEqual(outcome, { status: "failed", reason: "delivery" });
  assert.equal(h.released(), 1);
});

test("어떻게 끝나든 자리를 반납한다", async () => {
  const ok = harness();
  await ok.run();
  assert.equal(ok.released(), 1);

  const bad = harness({ reportResult: { ok: false, reason: "exit", detail: "x" } });
  await bad.run();
  assert.equal(bad.released(), 1);
});
