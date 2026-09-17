import { test } from "node:test";
import assert from "node:assert/strict";
import { createQuestionHandler } from "../src/handle-question.js";

function harness({
  askResults,
  existingSession = null,
  acquire,
  throwOnThread = false,
  throwOnPost = false,
} = {}) {
  const posted = [];
  const direct = [];
  const calls = [];
  const sessions = new Map();
  let threadOpens = 0;
  let released = 0;
  let storeBroken = false;

  if (existingSession) sessions.set("thread-1", existingSession);

  let uuidCounter = 0;
  const handle = createQuestionHandler({
    store: {
      get: (id) => sessions.get(id) ?? null,
      set: (id, value) => {
        if (storeBroken) throw new Error("disk full");
        sessions.set(id, value);
      },
      remove: (id) => sessions.delete(id),
    },
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
    runner: {
      ask(args) {
        calls.push(args);
        return Promise.resolve(askResults[calls.length - 1]);
      },
    },
    randomUUID: () => `new-uuid-${++uuidCounter}`,
    log: () => {},
  });

  const run = () =>
    handle({
      userId: "user-1",
      question: "질문",
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
    sessions,
    threadOpens: () => threadOpens,
    released: () => released,
    breakStore: () => {
      storeBroken = true;
    },
  };
}

test("첫 질문은 새 세션으로 묻고 답을 올린다", async () => {
  const h = harness({ askResults: [{ ok: true, text: "답변", sessionId: "s-1" }] });
  const outcome = await h.run();

  assert.deepEqual(outcome, { status: "answered" });
  assert.equal(h.calls[0].resume, false);
  assert.equal(h.calls[0].sessionId, "new-uuid-1");
  assert.deepEqual(h.posted, ["답변"]);
  assert.equal(h.sessions.get("thread-1"), "s-1");
});

test("세션이 있으면 resume 으로 묻는다", async () => {
  const h = harness({
    askResults: [{ ok: true, text: "답변", sessionId: "s-1" }],
    existingSession: "s-1",
  });
  await h.run();

  assert.equal(h.calls[0].resume, true);
  assert.equal(h.calls[0].sessionId, "s-1");
});

test("resume 이 exit 로 실패하면 새 세션으로 한 번 다시 묻는다", async () => {
  const h = harness({
    askResults: [
      { ok: false, reason: "exit", detail: "no such session" },
      { ok: true, text: "답변", sessionId: "s-2" },
    ],
    existingSession: "s-1",
  });
  const outcome = await h.run();

  assert.deepEqual(outcome, { status: "answered" });
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].resume, false);
  assert.ok(h.posted[0].includes("새로 시작"));
  assert.equal(h.sessions.get("thread-1"), "s-2");
});

test("재시도도 실패하면 실패로 끝낸다", async () => {
  const h = harness({
    askResults: [
      { ok: false, reason: "exit", detail: "x" },
      { ok: false, reason: "exit", detail: "y" },
    ],
    existingSession: "s-1",
  });
  const outcome = await h.run();

  assert.deepEqual(outcome, { status: "failed", reason: "exit" });
  assert.equal(h.calls.length, 2);
  assert.equal(h.posted.length, 1);
});

test("첫 질문 실패는 재시도하지 않는다", async () => {
  const h = harness({ askResults: [{ ok: false, reason: "exit", detail: "x" }] });
  const outcome = await h.run();

  assert.deepEqual(outcome, { status: "failed", reason: "exit" });
  assert.equal(h.calls.length, 1);
});

test("되물음이 empty 면 재시도하지 않고 세션을 지킨다", async () => {
  const h = harness({
    askResults: [{ ok: false, reason: "empty", detail: "blank" }],
    existingSession: "s-1",
  });
  const outcome = await h.run();

  assert.deepEqual(outcome, { status: "failed", reason: "empty" });
  assert.equal(h.calls.length, 1, "empty 는 재시도 대상이 아니다");
  assert.equal(h.sessions.get("thread-1"), "s-1", "멀쩡한 세션을 지우면 안 된다");
  assert.ok(!h.posted[0].includes("새로 시작"));
});

test("되물음이 parse 로 실패해도 재시도하지 않는다", async () => {
  const h = harness({
    askResults: [{ ok: false, reason: "parse", detail: "junk" }],
    existingSession: "s-1",
  });
  const outcome = await h.run();

  assert.deepEqual(outcome, { status: "failed", reason: "parse" });
  assert.equal(h.calls.length, 1);
  assert.equal(h.sessions.get("thread-1"), "s-1");
});

test("시간 초과면 세션을 지우고 재시도하지 않는다", async () => {
  const h = harness({
    askResults: [{ ok: false, reason: "timeout", detail: "x" }],
    existingSession: "s-1",
  });
  const outcome = await h.run();

  assert.deepEqual(outcome, { status: "failed", reason: "timeout" });
  assert.equal(h.sessions.has("thread-1"), false);
  assert.equal(h.calls.length, 1);
});

test("세션 저장이 실패해도 답은 전달된다", async () => {
  const h = harness({ askResults: [{ ok: true, text: "답변", sessionId: "s-1" }] });
  h.breakStore();
  const outcome = await h.run();

  assert.deepEqual(outcome, { status: "answered" });
  assert.deepEqual(h.posted, ["답변"], "저장이 실패해도 답은 나가야 한다");
});

test("쓰레드를 못 열면 delivery 로 끝내고 자리를 반납한다", async () => {
  const h = harness({ askResults: [], throwOnThread: true });
  const outcome = await h.run();

  assert.deepEqual(outcome, { status: "failed", reason: "delivery" });
  assert.equal(h.released(), 1);
  assert.equal(h.calls.length, 0);
});

test("답을 못 보내면 delivery 로 끝내고 자리를 반납한다", async () => {
  const h = harness({
    askResults: [{ ok: true, text: "답변", sessionId: "s-1" }],
    throwOnPost: true,
  });
  const outcome = await h.run();

  assert.deepEqual(outcome, { status: "failed", reason: "delivery" });
  assert.equal(h.released(), 1);
});

test("한도에 걸리면 쓰레드를 열지 않고 답글로 거절한다", async () => {
  const h = harness({
    askResults: [],
    acquire: () => ({ ok: false, reason: "daily" }),
  });
  const outcome = await h.run();

  assert.deepEqual(outcome, { status: "rejected", reason: "daily" });
  assert.equal(h.threadOpens(), 0, "거절이면 쓰레드를 만들지 않는다");
  assert.equal(h.calls.length, 0, "거절이면 claude 를 띄우지 않는다");
  assert.equal(h.posted.length, 0);
  assert.equal(h.direct.length, 1);
  assert.ok(h.direct[0].includes("한도"));
});

test("답이 나오든 실패하든 자리를 반납한다", async () => {
  const ok = harness({ askResults: [{ ok: true, text: "답변", sessionId: "s-1" }] });
  await ok.run();
  assert.equal(ok.released(), 1);

  const bad = harness({ askResults: [{ ok: false, reason: "exit", detail: "x" }] });
  await bad.run();
  assert.equal(bad.released(), 1);
});
