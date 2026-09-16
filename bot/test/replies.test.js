import { test } from "node:test";
import assert from "node:assert/strict";
import { threadName, rejectionText, failureText, answerMessages } from "../src/replies.js";

test("쓰레드 이름은 80자를 넘지 않는다", () => {
  assert.ok(threadName("가".repeat(200)).length <= 80);
});

test("쓰레드 이름의 개행을 공백으로 바꾼다", () => {
  assert.equal(threadName("첫 줄\n둘째 줄"), "첫 줄 둘째 줄");
});

test("빈 질문에도 이름이 있다", () => {
  assert.equal(threadName("   "), "위키 질문");
});

test("거절 사유마다 다른 문구를 쓴다", () => {
  const texts = ["daily", "user", "concurrent"].map(rejectionText);
  assert.equal(new Set(texts).size, 3);
  for (const text of texts) assert.ok(text.length > 0);
});

test("실패 사유마다 문구가 있다", () => {
  for (const reason of ["timeout", "exit", "parse", "error", "empty"]) {
    assert.ok(failureText(reason).length > 0);
  }
});

test("모르는 사유에도 문구를 준다", () => {
  assert.ok(failureText("unknown-reason").length > 0);
});

test("실패 문구에 경로나 스택을 넣지 않는다", () => {
  for (const reason of ["timeout", "exit", "parse", "error", "empty"]) {
    const text = failureText(reason);
    assert.ok(!text.includes("/"), `경로처럼 보이는 문구: ${text}`);
    assert.ok(!text.includes("Error:"), `스택처럼 보이는 문구: ${text}`);
  }
});

test("맥락이 끊기면 첫 조각에 안내를 붙인다", () => {
  const messages = answerMessages("답변", { resumeFailed: true });
  assert.ok(messages[0].includes("새로 시작"));
  assert.ok(messages[0].includes("답변"));
});

test("정상 답변에는 안내를 붙이지 않는다", () => {
  assert.deepEqual(answerMessages("답변", { resumeFailed: false }), ["답변"]);
});

test("긴 답변을 나눈다", () => {
  const messages = answerMessages(("가".repeat(99) + "\n").repeat(40), { resumeFailed: false });
  assert.ok(messages.length > 1);
  for (const message of messages) assert.ok(message.length <= 2000);
});
